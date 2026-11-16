import { sanitizeUrl } from "../config/sanitize.js";

// Rows keep incomplete fields while editing; only valid pairings are
// serialised into the configuration.
export function agentUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "http://" + raw;
  const url = sanitizeUrl(candidate);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.username || parsed.password || parsed.search || parsed.hash ? "" : parsed.href;
  } catch (_error) {
    return "";
  }
}
export function replicationEntries(replication) {
  return (replication.secondaries || []).map(url => ({
    url,
    name: (replication.agentNames || {})[url] || "",
    host: (replication.agentHosts || {})[url] || ""
  }));
}
export function serializeReplicationEntries(entries, validHostIds) {
  const urls = [],
    names = {},
    hosts = {};
  for (const entry of entries) {
    const url = agentUrl(entry.url);
    if (!url) continue;
    if (!urls.includes(url)) urls.push(url);
    const name = String(entry.name || "").trim();
    if (name) names[url] = name;
    const host = String(entry.host || "").trim();
    if (host && validHostIds.has(host)) hosts[url] = host;
  }
  return { secondaries: urls.slice(0, 20), agentNames: names, agentHosts: hosts };
}
