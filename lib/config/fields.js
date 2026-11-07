"use strict";
// Validation of the configuration fields that have their own small schema:
// web link counters and host monitoring options.
const { sanitizeText, sanitizeUrl } = require("../sanitize");

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
function sanitizeHostMonitoring(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  if (raw.type && raw.type !== "local") return undefined;
  const type = HOST_MONITORING_TYPES.has(raw.type) ? raw.type : "local";
  const monitoring = { enabled: raw.enabled === true, type, path: sanitizeText(raw.path, 200) };
  const wg =
    type === "local" &&
    raw.wireguard &&
    typeof raw.wireguard === "object" &&
    !Array.isArray(raw.wireguard)
      ? raw.wireguard
      : null;
  if (wg) {
    const wireguard = { enabled: wg.enabled !== false, interface: sanitizeText(wg.interface, 50) };
    if (!wireguard.enabled || wireguard.interface) monitoring.wireguard = wireguard;
  }
  const source =
    raw.smart && typeof raw.smart === "object" && !Array.isArray(raw.smart) ? raw.smart : null;
  if (source) {
    const disks = Array.isArray(source.disks)
      ? [...new Set(source.disks.map(value => sanitizeText(value, 100)).filter(Boolean))].slice(
          0,
          20
        )
      : [];
    const smart = { enabled: source.enabled !== false, disks };
    if (!smart.enabled || smart.disks.length) monitoring.smart = smart;
  }
  // Speed test card: on by default, every hour, against Cloudflare.
  if (raw.speedtest && typeof raw.speedtest === "object" && !Array.isArray(raw.speedtest)) {
    const speedtest = sanitizeSpeedtest(raw.speedtest);
    if (!speedtest.enabled || speedtest.interval !== SPEEDTEST_DEFAULT_INTERVAL || speedtest.server)
      monitoring.speedtest = speedtest;
  }
  if (raw.aptUpdates && typeof raw.aptUpdates === "object" && !Array.isArray(raw.aptUpdates)) {
    const aptUpdates = { enabled: raw.aptUpdates.enabled !== false };
    if (!aptUpdates.enabled) monitoring.aptUpdates = aptUpdates;
  }
  if (raw.opencode && typeof raw.opencode === "object" && !Array.isArray(raw.opencode)) {
    if (raw.opencode.enabled === false) monitoring.opencode = { enabled: false };
  }
  if (raw.claude && typeof raw.claude === "object" && !Array.isArray(raw.claude)) {
    if (raw.claude.enabled === false) monitoring.claude = { enabled: false };
  }
  if (
    raw.directorySizes &&
    typeof raw.directorySizes === "object" &&
    !Array.isArray(raw.directorySizes)
  ) {
    if (raw.directorySizes.enabled === false) monitoring.directorySizes = { enabled: false };
  }
  const meaningful =
    monitoring.directorySizes ||
    monitoring.path ||
    monitoring.wireguard ||
    monitoring.smart ||
    monitoring.speedtest ||
    monitoring.aptUpdates ||
    monitoring.opencode ||
    monitoring.claude;
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
