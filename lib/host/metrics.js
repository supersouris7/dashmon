"use strict";
// Metrics of the machine running Dashmon, as served to the supervision page
// (and, in agent mode, to the main dashboard).
//
// CPU, RAM and disk are percentages (0..100), temperature is in degrees. An
// unavailable metric is null (shown as "—"): zero is a measurement, its
// absence is not, and mixing them up would make a host look idle.
//
// Results are cached for the refresh interval, so several open tabs share one
// measurement. All readings are synchronous (/proc, /sys, small report files).

const { createLocalMetrics } = require("./local-metrics");
const { readAptUpdatesReport } = require("./apt-report");
const { readSmartDump } = require("./smart-report");
const { readWireguardDump } = require("./wireguard-report");
const { readUsageReport } = require("./usage-report");
const { createSpeedtest } = require("./speedtest");
const { sanitizeText } = require("../sanitize");
const agentProtocol = require("../agent/protocol");

function positiveInteger(value, max) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return Math.min(n, max);
}

// The reports are optional files written by the deploy/ scripts; each host
// setting can hide them or keep only one interface / some disks.
function filteredReports(monitoring, wireguardDump, smartDump) {
  let wireguard =
    monitoring.wireguard?.enabled === false ? null : wireguardDump?.interfaces || null;
  if (monitoring.wireguard?.interface && wireguard) {
    wireguard = wireguard.filter(item => item.interface === monitoring.wireguard.interface);
  }
  let smart = monitoring.smart?.enabled === false ? null : smartDump?.disks || null;
  if (monitoring.smart?.disks?.length && smart) {
    smart = smart.filter(item => monitoring.smart.disks.includes(item.device));
  }
  return { wireguard, smart };
}

function localHostOf(config) {
  const hosts = Array.isArray(config?.hosts) ? config.hosts : [];
  return hosts.find(host => host?.monitoring?.type === "local" && host.monitoring.enabled === true);
}

function createHostMetrics({ settings, readConfig, agentId, log }) {
  const local = createLocalMetrics({ sanitizeText });
  let cache = { ts: 0, payload: null };
  // Speed test of the local host, run in the background on its schedule.
  const speedtest = createSpeedtest({
    file: settings.speedtestFile,
    scheduled: settings.speedtestSchedule,
    readPrefs: () => {
      const host = localHostOf(readConfig());
      return host ? host.monitoring.speedtest || {} : null;
    },
    onResult: () => invalidate(),
    log
  });
  speedtest.start();
  let lastSuccessAt = null;

  function hostReport(host) {
    const monitoring = host.monitoring || {};
    const identity = {
      id: sanitizeText(host.id, 64),
      name: sanitizeText(host.name, 100) || "Hote",
      type: "local"
    };
    try {
      const wireguardDump = readWireguardDump(settings.wireguardDumpFile);
      const smartDump = readSmartDump(settings.smartDumpFile);
      const { wireguard, smart } = filteredReports(monitoring, wireguardDump, smartDump);
      const details = local.localSystemDetails();
      return {
        ...identity,
        ok: true,
        cpu: local.localCpuPercent(),
        ram: local.localRamPercent(),
        temperature: local.localTemperature(),
        disk: local.localDiskPercent(monitoring.path),
        os: sanitizeText(details.os, 200),
        cpuModel: sanitizeText(details.cpuModel, 200),
        cpuCores: positiveInteger(details.cpuCores, 1024),
        ramTotal: positiveInteger(details.ramTotal, Number.MAX_SAFE_INTEGER),
        wireguard: wireguard || null,
        wireguardFetchedAt: wireguardDump?.fetchedAt || null,
        smart: smart || null,
        smartFetchedAt: smartDump?.fetchedAt || null,
        aptUpdates:
          monitoring.aptUpdates?.enabled !== false
            ? readAptUpdatesReport(settings.aptUpdatesReportFile) || null
            : null,
        opencode:
          monitoring.opencode?.enabled !== false
            ? readUsageReport(settings.opencodeReportFile) || null
            : null,
        claude:
          monitoring.claude?.enabled !== false
            ? readUsageReport(settings.claudeReportFile) || null
            : null,
        speedtest: speedtest.report()
      };
    } catch (error) {
      return { ...identity, ok: false, error: error.message };
    }
  }

  // Only the enabled local host is measured: it is the machine running Dashmon.
  function collect(config) {
    const localHost = localHostOf(config);
    const results = localHost ? [hostReport(localHost)] : [];
    if (!settings.agentMode) return { hosts: results };

    // An agent adds the protocol envelope read by the main dashboard.
    const collectedAt = new Date().toISOString();
    const ok = results.length > 0 && results.every(result => result.ok);
    if (ok) lastSuccessAt = collectedAt;
    return {
      hosts: results,
      protocol: agentProtocol.PROTOCOL,
      agent: { id: agentId, capabilities: agentProtocol.CAPABILITIES },
      collection: {
        status: ok ? "available" : "unavailable",
        collectedAt,
        lastSuccessAt,
        maxAgeMs: settings.hostMetricsInterval * 3
      }
    };
  }

  // Express handler shared by the routes that serve these metrics.
  function handle(_req, res) {
    res.set("Cache-Control", "no-store");
    if (cache.payload && Date.now() - cache.ts < settings.hostMetricsInterval) {
      return res.json(cache.payload);
    }

    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return res.status(500).json({ error: "Lecture de config.json impossible" });
    }
    try {
      const payload = collect(config);
      cache = { ts: Date.now(), payload };
      res.json(payload);
    } catch (error) {
      log.error("Collecting host metrics failed:", error);
      res.status(500).json({ error: "Lecture des mesures impossible" });
    }
  }

  // Called after a settings change so that the next request measures again.
  function invalidate() {
    cache = { ts: 0, payload: null };
  }

  // POST of the supervision page: one test now, answered once it is over.
  async function runSpeedtest(_req, res) {
    res.set("Cache-Control", "no-store");
    const outcome = speedtest.runNow();
    if (outcome.status === 404) return res.status(404).json({ error: "speedtest_disabled" });
    if (outcome.status === 429) {
      res.set("Retry-After", String(outcome.retryAfter));
      return res.status(429).json({ error: "speedtest_too_soon" });
    }
    const result = await outcome.result;
    res.json({ result });
  }

  return { handle, invalidate, runSpeedtest, speedtest };
}

module.exports = { createHostMetrics };
