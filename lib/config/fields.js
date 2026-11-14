"use strict";
// Validation of the configuration fields that have their own small schema:
// web link counters and host monitoring options.
const { sanitizeText, sanitizeUrl } = require("../sanitize");
const { sanitizePluginSettings } = require("./plugin-prefs");

const HOST_MONITORING_TYPES = new Set(["local"]);
const WEB_LINK_COUNTER_TYPES = new Set(["github", "dockerhub", "youtube"]);

function sanitizeLinkCounter(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!WEB_LINK_COUNTER_TYPES.has(type)) return null;
  const target = sanitizeText(raw.target, 200);
  return target ? { type, target } : null;
}
// Fortune Cookie bar, under the web links. Older configurations had it as a
// "special tile": that tile turns the bar on.
function sanitizeFortune(config) {
  if (typeof config.fortune === "boolean") return config.fortune;
  const tile = config.specialTile;
  return !!tile && typeof tile === "object" && tile.type === "fortune";
}
// Minutes between two automatic speed tests; 0 runs them on request only.
const SPEEDTEST_INTERVALS = Object.freeze([0, 15, 60, 360, 1440]);
const SPEEDTEST_DEFAULT_INTERVAL = 60;

// server: empty for Cloudflare, otherwise the folder of a LibreSpeed backend.
function sanitizeSpeedtest(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const interval = Number(src.interval);
  return {
    enabled: src.enabled !== false,
    interval: SPEEDTEST_INTERVALS.includes(interval) ? interval : SPEEDTEST_DEFAULT_INTERVAL,
    server: sanitizeUrl(String(src.server || "").trim()).slice(0, 300)
  };
}
// Monitoring of a host. Speed test and disk path belong to the core; every
// other card is a supervision plugin whose settings follow its manifest
// (plugin-prefs.js). schemas: [{ id, key, fields }] of the installed plugins,
// empty before their registry is loaded (settings are then preserved).
function sanitizeHostMonitoring(raw, schemas = []) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  if (raw.type && raw.type !== "local") return undefined;
  const type = HOST_MONITORING_TYPES.has(raw.type) ? raw.type : "local";
  const monitoring = { enabled: raw.enabled === true, type, path: sanitizeText(raw.path, 200) };
  // Speed test card: on by default, every hour, against Cloudflare.
  if (raw.speedtest && typeof raw.speedtest === "object" && !Array.isArray(raw.speedtest)) {
    const speedtest = sanitizeSpeedtest(raw.speedtest);
    if (!speedtest.enabled || speedtest.interval !== SPEEDTEST_DEFAULT_INTERVAL || speedtest.server)
      monitoring.speedtest = speedtest;
  }
  const plugins = sanitizePluginSettings(raw, schemas);
  Object.assign(monitoring, plugins);
  const meaningful = monitoring.path || monitoring.speedtest || Object.keys(plugins).length;
  return !monitoring.enabled && !meaningful ? undefined : monitoring;
}
module.exports = {
  HOST_MONITORING_TYPES,
  sanitizeLinkCounter,
  sanitizeFortune,
  sanitizeHostMonitoring,
  sanitizeSpeedtest,
  SPEEDTEST_INTERVALS,
  SPEEDTEST_DEFAULT_INTERVAL
};
