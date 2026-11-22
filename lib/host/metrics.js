"use strict";
// Metrics of the machine running Dashmon, as served to the supervision page
// (and, in agent mode, to the main dashboard): CPU, RAM, disk, temperature
// and speed test, plus the reports of the supervision plugins under
// plugins.<id> (lib/supervisions/core.js).
//
// CPU, RAM and disk are percentages (0..100), temperature is in degrees. An
// unavailable metric is null (shown as "—"): zero is a measurement, its
// absence is not, and mixing them up would make a host look idle.
//
// Results are cached for the refresh interval, so several open tabs share one
// measurement and the plugins run once per interval.

const { apiError } = require("../http/api-errors");
const { createLocalMetrics } = require("./local-metrics");
const {
  readExpectedVersions,
  readInstalledVersions,
  outdatedScripts
} = require("./script-versions");
const path = require("path");
const { createSpeedtest } = require("./speedtest");
const { sanitizeText } = require("../sanitize");
const agentProtocol = require("../agent/protocol");
const { releaseLabel } = require("../version");

function positiveInteger(value, max) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return Math.min(n, max);
}

function localHostOf(config) {
  const hosts = Array.isArray(config?.hosts) ? config.hosts : [];
  return hosts.find(host => host?.monitoring?.type === "local" && host.monitoring.enabled === true);
}

// supervisionCore: plugin cards (lib/supervisions/core.js); optional, so a
// test can build the metrics without plugins.
function createHostMetrics({ settings, readConfig, agentId, log, supervisionCore = null }) {
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
  // Script versions this image ships (deploy/ is copied into the image), for
  // the plugins whose report comes from a host script. Read once the plugins
  // are loaded, at the first collection.
  let expectedScripts = null;
  function scriptVersions() {
    const scripts = supervisionCore ? supervisionCore.scripts() : {};
    const names = [...new Set(Object.values(scripts))];
    if (!expectedScripts)
      expectedScripts = readExpectedVersions(path.join(settings.rootDir, "deploy"), names);
    const installed = readInstalledVersions(
      path.join(settings.dataDir, "installed-scripts.json"),
      names
    );
    return { scripts, installed };
  }

  function hostReport(host) {
    const monitoring = host.monitoring || {};
    const identity = {
      id: sanitizeText(host.id, 64),
      name: sanitizeText(host.name, 100) || "Hote",
      type: "local"
    };
    try {
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
        speedtest: speedtest.report()
      };
    } catch (error) {
      return { ...identity, ok: false, error: error.message };
    }
  }

  // Reports of the supervision plugins, under plugins.<id>: their own
  // namespace, so a plugin can never overwrite a core field. scriptUpdates
  // names the cards whose report comes from an older host script:
  // { "apt-updates": "apt-updates" } (plugin id -> script).
  async function withPlugins(report, host) {
    if (!supervisionCore || !report.ok) return report;
    const plugins = await supervisionCore.collect(host);
    const { scripts, installed } = scriptVersions();
    return {
      ...report,
      plugins,
      scriptUpdates: outdatedScripts(plugins, scripts, expectedScripts, installed)
    };
  }

  // Only the enabled local host is measured: it is the machine running Dashmon.
  async function collect(config) {
    const localHost = localHostOf(config);
    const results = localHost ? [await withPlugins(hostReport(localHost), localHost)] : [];
    if (!settings.agentMode) return { hosts: results };

    // An agent adds the protocol envelope read by the main dashboard.
    const collectedAt = new Date().toISOString();
    const ok = results.length > 0 && results.every(result => result.ok);
    if (ok) lastSuccessAt = collectedAt;
    return {
      hosts: results,
      protocol: agentProtocol.PROTOCOL,
      agent: {
        id: agentId,
        capabilities: agentProtocol.CAPABILITIES,
        version: { version: releaseLabel(settings.release), commit: settings.commit || "" }
      },
      collection: {
        status: ok ? "available" : "unavailable",
        collectedAt,
        lastSuccessAt,
        maxAgeMs: settings.hostMetricsInterval * 3
      }
    };
  }

  // Requests arriving during a collection share it: plugins run once.
  let inflight = null;
  let generation = 0;

  // Express handler shared by the routes that serve these metrics.
  async function handle(_req, res) {
    res.set("Cache-Control", "no-store");
    if (cache.payload && Date.now() - cache.ts < settings.hostMetricsInterval) {
      return res.json(cache.payload);
    }

    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return res.status(500).json({ ...apiError("config_read_failed") });
    }
    try {
      if (!inflight) {
        const started = generation;
        inflight = collect(config)
          .then(payload => {
            // A settings change during the collection: do not cache it.
            if (started === generation) cache = { ts: Date.now(), payload };
            return payload;
          })
          .finally(() => {
            inflight = null;
          });
      }
      res.json(await inflight);
    } catch (error) {
      log.error("Collecting host metrics failed:", error);
      res.status(500).json({ ...apiError("metrics_read_failed") });
    }
  }

  // Called after a settings change so that the next request measures again.
  function invalidate() {
    generation++;
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
