"use strict";
// Reading and writing config.json as the rest of the server sees it.
//
// The store (store.js) only knows the file. The repository adds what every
// reader expects: retired settings are hidden and exactly one local host is
// always present.

// Retired settings are neither exposed nor copied back on save. An existing
// file stays readable without a destructive migration.
const RETIRED_KEYS = ["favicon", "faviconEnabled", "hostsDisplay", "webLinksCollapsed"];

// The machine running Dashmon is always listed as a host, with exactly one
// enabled "local" entry: the first enabled one, otherwise the first one.
function ensureLocalHost(config, { agentMode }) {
  config.hosts = Array.isArray(config.hosts) ? config.hosts : [];
  let local =
    config.hosts.find(
      host => host?.monitoring?.type === "local" && host.monitoring.enabled === true
    ) || config.hosts.find(host => host?.monitoring?.type === "local");
  if (!local) {
    const used = new Set(config.hosts.map(host => host?.id));
    let id = "dashmon-local";
    while (used.has(id)) id += "-local";
    local = {
      id,
      name: agentMode ? "Agent" : "Dashmon",
      icon: "fa-solid fa-server",
      monitoring: { type: "local" }
    };
    config.hosts.unshift(local);
  }
  for (const host of config.hosts) {
    if (host?.monitoring?.type === "local") host.monitoring.enabled = host === local;
  }
  return config;
}

function createConfigRepository({ store, agentMode }) {
  return {
    read() {
      const config = store.read();
      for (const key of RETIRED_KEYS) delete config[key];
      return ensureLocalHost(config, { agentMode });
    },
    write(config) {
      store.write(config);
    },
    // Identifier of the editable part of the config, used as ETag.
    revision(config) {
      return store.revision(config);
    },
    ensureLocalHost(config) {
      return ensureLocalHost(config, { agentMode });
    }
  };
}

module.exports = { createConfigRepository, ensureLocalHost };
