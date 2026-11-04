"use strict";
// Network throughput of the host, from the kernel counters (/proc/net/dev).
//
// In Docker the container only sees its own network namespace. The host
// counters are reached by mounting one file of the host, read-only:
//   - /proc/1/net/dev:/host/net/dev:ro
// (PID 1 of the host lives in the host namespace). Nothing else of the host is
// exposed. Outside Docker, /proc/net/dev already is the host.
//
// A sampler reads the counters every 10 s in the background:
//   - intervals come from the monotonic clock, never from the wall clock,
//     which NTP or a manual change may move;
//   - the first reading of an interface only sets the baseline;
//   - a counter going backwards (interface restarted, counter reset) starts
//     the computation again instead of showing an absurd peak;
//   - one hour of rates is kept in memory for the graph and the peak.

const fs = require("fs");

const SAMPLE_INTERVAL = 10000;
const HISTORY_MS = 60 * 60 * 1000;
const MAX_INTERFACES = 32;

// Interfaces shown when the host settings select none: physical cards and
// VPN tunnels.
const PHYSICAL = /^(eth|en|wl|ww|usb|em\d|p\d)/;
const VPN = /^(wg|tun|tailscale|zt|nordlynx|proton)/;
// Never offered: loopback and the plumbing of containers and virtual machines.
const PLUMBING =
  /^(lo$|veth|docker|br-|virbr|vnet|cni|flannel|cali|weave|kube|vxlan|cilium|lxc|dummy|ifb|sit|ip6tnl|gre|erspan|ip_vti|ip6_vti|nlmon|bonding_masters)/;

function interfaceKind(name) {
  if (VPN.test(name)) return "vpn";
  if (PHYSICAL.test(name)) return "physical";
  return "other";
}

function isPlumbing(name) {
  return PLUMBING.test(name);
}

// "  eth0: 123 4 0 0 0 0 0 0 456 7 ..." -> { name, rx, tx } (bytes).
function parseNetDev(text) {
  const list = [];
  for (const line of String(text || "").split("\n")) {
    const match = /^\s*([^:\s]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const fields = match[2].trim().split(/\s+/).map(Number);
    if (fields.length < 9 || !Number.isFinite(fields[0]) || !Number.isFinite(fields[8])) continue;
    list.push({ name: match[1].slice(0, 32), rx: fields[0], tx: fields[8] });
  }
  return list;
}

// Default source: the host file mounted into the container, otherwise this
// process's own namespace when it is not a container.
function defaultSource({ hostFile, runningInDocker, filesystem = fs }) {
  if (hostFile && filesystem.existsSync(hostFile)) return { file: hostFile, scope: "host" };
  if (!runningInDocker) return { file: "/proc/net/dev", scope: "host" };
  return { file: "", scope: "container" };
}

function monotonicMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function createNetworkSampler({
  source,
  read = file => fs.readFileSync(file, "utf8"),
  monotonic = monotonicMs,
  wallClock = Date.now,
  intervalMs = SAMPLE_INTERVAL,
  historyMs = HISTORY_MS
}) {
  // name -> { rx, tx, at (monotonic), rate: {rx, tx} | null, history: [[time, rx, tx]], totals }
  const interfaces = new Map();
  let lastError = "";
  let timer = null;

  function sample() {
    if (!source.file) return;
    let list;
    try {
      list = parseNetDev(read(source.file));
      lastError = "";
    } catch (error) {
      lastError = error.code || "unreadable";
      return;
    }
    const now = monotonic();
    const time = wallClock();
    const seen = new Set();
    for (const item of list.slice(0, 256)) {
      if (isPlumbing(item.name)) continue;
      seen.add(item.name);
      const entry = interfaces.get(item.name);
      if (!entry) {
        if (interfaces.size >= MAX_INTERFACES) continue;
        // First reading: a baseline only, no rate yet.
        interfaces.set(item.name, { rx: item.rx, tx: item.tx, at: now, rate: null, history: [] });
        continue;
      }
      const elapsed = (now - entry.at) / 1000;
      const restarted = item.rx < entry.rx || item.tx < entry.tx;
      if (restarted) {
        // Interface restarted or counters reset: start again from here.
        entry.rate = null;
        entry.history = [];
      } else if (elapsed > 0) {
        const rate = {
          rx: (item.rx - entry.rx) / elapsed,
          tx: (item.tx - entry.tx) / elapsed
        };
        entry.rate = rate;
        entry.history.push([time, Math.round(rate.rx), Math.round(rate.tx)]);
      }
      entry.rx = item.rx;
      entry.tx = item.tx;
      entry.at = now;
      const cutoff = time - historyMs;
      while (entry.history.length && entry.history[0][0] < cutoff) entry.history.shift();
    }
    // A vanished interface starts from a new baseline if it comes back.
    for (const name of [...interfaces.keys()]) if (!seen.has(name)) interfaces.delete(name);
  }

  function start() {
    if (timer || !source.file) return;
    sample();
    timer = setInterval(sample, intervalMs);
    timer.unref?.();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  // Report of the selected interfaces (all physical and VPN ones when the
  // selection is empty), plus every name a user may pick in the settings.
  function report(selected = []) {
    if (!source.file) return { available: false, reason: "no_host_counters", interfaces: [] };
    if (lastError) return { available: false, reason: "unreadable", interfaces: [] };
    const names = [...interfaces.keys()].sort();
    const wanted = selected.length
      ? names.filter(name => selected.includes(name))
      : names.filter(name => interfaceKind(name) !== "other");
    return {
      available: true,
      intervalMs,
      detected: names,
      interfaces: wanted.map(name => {
        const entry = interfaces.get(name);
        const peak = entry.history.reduce(
          (max, [, rx, tx]) => ({ rx: Math.max(max.rx, rx), tx: Math.max(max.tx, tx) }),
          { rx: 0, tx: 0 }
        );
        return {
          name,
          kind: interfaceKind(name),
          rx: entry.rate ? Math.round(entry.rate.rx) : null,
          tx: entry.rate ? Math.round(entry.rate.tx) : null,
          peakRx: entry.history.length ? peak.rx : null,
          peakTx: entry.history.length ? peak.tx : null,
          totalRx: entry.rx,
          totalTx: entry.tx,
          history: entry.history.slice()
        };
      })
    };
  }

  return { sample, start, stop, report };
}

module.exports = {
  SAMPLE_INTERVAL,
  HISTORY_MS,
  createNetworkSampler,
  defaultSource,
  interfaceKind,
  isPlumbing,
  parseNetDev
};
