"use strict";
// Host network throughput: parsing, baseline, restarts, filtering, peak.
const assert = require("assert");
const {
  createNetworkSampler,
  defaultSource,
  interfaceKind,
  isPlumbing,
  parseNetDev
} = require("../lib/host/network");

const HEADER =
  "Inter-|   Receive                                                |  Transmit\n" +
  " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n";
const line = (name, rx, tx) => `  ${name}: ${rx} 10 0 0 0 0 0 0 ${tx} 10 0 0 0 0 0 0\n`;
const dev = counters =>
  HEADER +
  Object.entries(counters)
    .map(([name, [rx, tx]]) => line(name, rx, tx))
    .join("");

// Parsing: receive is the 1st field, transmit the 9th.
assert.deepEqual(parseNetDev(dev({ eth0: [1000, 2000] })), [{ name: "eth0", rx: 1000, tx: 2000 }]);
assert.deepEqual(parseNetDev("garbage\n  x: 1 2\n"), []);

// Kinds and exclusions.
assert.equal(interfaceKind("eth0"), "physical");
assert.equal(interfaceKind("wlan0"), "physical");
assert.equal(interfaceKind("wg0"), "vpn");
assert.equal(interfaceKind("br0"), "other");
for (const name of ["lo", "veth12ab", "docker0", "br-0a1b2c", "virbr0", "cni0"])
  assert.ok(isPlumbing(name), name);
assert.ok(!isPlumbing("eth0") && !isPlumbing("wg0") && !isPlumbing("local0"));

// Source: the mounted host file, or /proc/net/dev outside a container; never
// the container's own counters.
const exists = file => file === "/host/net/dev";
assert.equal(
  defaultSource({
    hostFile: "/host/net/dev",
    runningInDocker: true,
    filesystem: { existsSync: exists }
  }).file,
  "/host/net/dev"
);
assert.equal(
  defaultSource({ hostFile: "/none", runningInDocker: false, filesystem: { existsSync: exists } })
    .file,
  "/proc/net/dev"
);
assert.equal(
  defaultSource({ hostFile: "/none", runningInDocker: true, filesystem: { existsSync: exists } })
    .file,
  ""
);

// Sampler driven by a fake clock and fake counters.
let counters = {};
let monotonic = 0;
let wall = 1_700_000_000_000;
const sampler = createNetworkSampler({
  source: { file: "/host/net/dev" },
  read: () => dev(counters),
  monotonic: () => monotonic,
  wallClock: () => wall
});
const tick = (ms, next) => {
  monotonic += ms;
  wall += ms;
  counters = next;
  sampler.sample();
};

tick(0, { lo: [5, 5], eth0: [1000, 500], wg0: [0, 0], br0: [0, 0], veth1: [9, 9] });
let report = sampler.report();
// First reading: baseline only, no rate.
assert.equal(report.available, true);
assert.deepEqual(
  report.interfaces.map(item => [item.name, item.rx]),
  [
    ["eth0", null],
    ["wg0", null]
  ]
);
// Plumbing never listed, other interfaces offered for the settings.
assert.deepEqual(report.detected, ["br0", "eth0", "wg0"]);

// 10 s later: 100 kB received, 20 kB sent on eth0.
tick(10000, { eth0: [101000, 20500], wg0: [5000, 1000], br0: [0, 0] });
report = sampler.report();
const eth0 = report.interfaces.find(item => item.name === "eth0");
assert.equal(eth0.rx, 10000);
assert.equal(eth0.tx, 2000);
assert.equal(eth0.totalRx, 101000);
assert.equal(eth0.kind, "physical");
assert.equal(report.interfaces.find(item => item.name === "wg0").kind, "vpn");

// The wall clock jumps back an hour (NTP): rates still follow the monotonic
// clock.
wall -= 3600000;
tick(10000, { eth0: [201000, 40500], wg0: [5000, 1000], br0: [0, 0] });
assert.equal(sampler.report().interfaces.find(item => item.name === "eth0").rx, 10000);

// Interface restarted: counters back near zero, no absurd peak, new baseline.
tick(10000, { eth0: [300, 100], wg0: [5000, 1000], br0: [0, 0] });
report = sampler.report();
assert.equal(report.interfaces.find(item => item.name === "eth0").rx, null);
assert.equal(report.interfaces.find(item => item.name === "eth0").history.length, 0);
tick(10000, { eth0: [5300, 1100], wg0: [5000, 1000], br0: [0, 0] });
assert.equal(sampler.report().interfaces.find(item => item.name === "eth0").rx, 500);

// Peak over the kept history, and an explicit selection.
tick(10000, { eth0: [105300, 1100], wg0: [5000, 1000], br0: [0, 0] });
report = sampler.report(["eth0", "br0"]);
assert.deepEqual(
  report.interfaces.map(item => item.name),
  ["br0", "eth0"]
);
assert.equal(report.interfaces.find(item => item.name === "eth0").peakRx, 10000);

// History is bounded to one hour.
const long = createNetworkSampler({
  source: { file: "x" },
  read: () => dev(counters),
  monotonic: () => monotonic,
  wallClock: () => wall,
  historyMs: 30000
});
counters = { eth0: [0, 0] };
for (let i = 0; i < 10; i++) {
  monotonic += 10000;
  wall += 10000;
  counters = { eth0: [i * 1000, 0] };
  long.sample();
}
assert.ok(long.report().interfaces[0].history.length <= 4);

// No mounted file in a container: unavailable, with the reason to show.
const missing = createNetworkSampler({ source: { file: "" } });
assert.deepEqual(missing.report(), {
  available: false,
  reason: "no_host_counters",
  interfaces: []
});
// Unreadable file: said so, not a zero rate.
const broken = createNetworkSampler({
  source: { file: "x" },
  read: () => {
    throw Object.assign(new Error("no"), { code: "EACCES" });
  }
});
broken.sample();
assert.equal(broken.report().reason, "unreadable");

console.log("PASS reseau : compteurs de l'hote, horloge monotone, redemarrages, filtres");
