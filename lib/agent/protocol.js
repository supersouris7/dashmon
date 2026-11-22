"use strict";
// Contract of the metrics an agent sends to the main dashboard, and how the
// dashboard judges a response (available, stale, unavailable).

// 1.1: hosts may carry plugins.<id>, the reports of supervision plugins.
// 1.2: the former built-in reports (aptUpdates, smart, wireguard...) are
//      plugin reports too; a 1.0/1.1 agent still sends them as host fields,
//      which the supervision page reads (public/js/supervision/legacy.js).
// 1.3: agent.version = { version, commit }, the build the agent runs.
const PROTOCOL = { major: 1, minor: 3 };
const CAPABILITIES = [
  "host-metrics",
  "wireguard",
  "smart",
  "directory-sizes",
  "apt-updates",
  "opencode",
  "claude",
  "speedtest",
  "supervision-plugins"
];

// The contract only grows: a peer sending no protocol is a legacy agent.
function assess(payload, { now = Date.now(), lastSuccessAt = null } = {}) {
  if (!payload || !Array.isArray(payload.hosts))
    return { status: "unavailable", reason: "invalid_response", lastSuccessAt };
  if (payload.protocol == null) {
    return {
      status: "available",
      legacy: true,
      collectedAt: null,
      lastSuccessAt: new Date(now).toISOString()
    };
  }
  if (
    !payload.protocol ||
    payload.protocol.major !== PROTOCOL.major ||
    !Number.isInteger(payload.protocol.minor) ||
    payload.protocol.minor < 0
  ) {
    return { status: "unavailable", reason: "incompatible_protocol", lastSuccessAt };
  }
  const collection = payload.collection;
  const collected = Date.parse(collection?.collectedAt);
  const maxAge = Number(collection?.maxAgeMs);
  if (
    !payload.agent ||
    typeof payload.agent.id !== "string" ||
    !payload.agent.id ||
    !Array.isArray(payload.agent.capabilities) ||
    !collection ||
    !Number.isFinite(collected) ||
    !Number.isFinite(maxAge) ||
    maxAge < 5000 ||
    maxAge > 10800000 ||
    !["available", "unavailable"].includes(collection.status)
  ) {
    return { status: "unavailable", reason: "invalid_response", lastSuccessAt };
  }
  if (collection.status === "unavailable")
    return {
      status: "unavailable",
      reason: "collection_failed",
      collectedAt: collection.collectedAt,
      lastSuccessAt
    };
  const stale = collected > now + 300000 || now - collected > maxAge;
  return {
    status: stale ? "stale" : "available",
    legacy: false,
    collectedAt: collection.collectedAt,
    lastSuccessAt:
      typeof collection.lastSuccessAt === "string" &&
      Number.isFinite(Date.parse(collection.lastSuccessAt))
        ? collection.lastSuccessAt
        : lastSuccessAt,
    protocol: payload.protocol,
    agent: payload.agent
  };
}

const COMMIT = /^[0-9a-f]{7,40}$/;
const LABEL = /^[0-9A-Za-z.+-]{1,40}$/;

// Does the agent run the same build as this dashboard? null when it does or
// when it cannot be told (a build without commit, on either side, is a local
// development build: no false alarm). "unknown": the agent sends no version,
// so it predates protocol 1.3. "different": both builds, to update the older.
function compareVersion(own, agentVersion) {
  const ownCommit = String(own?.commit || "");
  if (!COMMIT.test(ownCommit)) return null;
  const self = { version: String(own.version || ""), commit: ownCommit.slice(0, 7) };
  if (!agentVersion || typeof agentVersion !== "object") return { status: "unknown", own: self };
  const commit = typeof agentVersion.commit === "string" ? agentVersion.commit : "";
  if (!COMMIT.test(commit)) return null;
  if (commit.slice(0, 7) === self.commit) return null;
  const version =
    typeof agentVersion.version === "string" && LABEL.test(agentVersion.version)
      ? agentVersion.version
      : "";
  return { status: "different", own: self, agent: { version, commit: commit.slice(0, 7) } };
}

module.exports = { PROTOCOL, CAPABILITIES, assess, compareVersion };
