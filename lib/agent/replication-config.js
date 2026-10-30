"use strict";

// Pairing settings (config.replication): the agents this dashboard reads
// metrics from. Names and host links are only kept for URLs that are in the
// list of agents authorised by the user.
function createReplicationConfig({ sanitizeUrl, sanitizeText, defaultName }) {
  function sanitizeSyncUrl(value) {
    const url = sanitizeUrl(value);
    if (!url) return "";
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.href;
    } catch (_error) {
      return "";
    }
  }

  function sanitizeReplication(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const role = "primary";
    const instanceName = sanitizeText(source.instanceName, 100) || defaultName || "Dashmon";
    const secondaries = Array.isArray(source.secondaries)
      ? [...new Set(source.secondaries.map(sanitizeSyncUrl).filter(Boolean))].slice(0, 20)
      : [];
    function associated(rawValues, maxLength) {
      const values =
        rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? rawValues : {};
      const result = {};
      for (const [url, value] of Object.entries(values)) {
        const normalized = sanitizeSyncUrl(url);
        const text = sanitizeText(value, maxLength);
        if (normalized && text && secondaries.includes(normalized)) result[normalized] = text;
      }
      return result;
    }
    return {
      role,
      instanceName,
      secondaries,
      agentNames: associated(source.agentNames, 100),
      agentHosts: associated(source.agentHosts, 64)
    };
  }
  return { sanitizeSyncUrl, sanitizeReplication };
}

module.exports = { createReplicationConfig };
