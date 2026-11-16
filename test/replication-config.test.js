"use strict";
const assert = require("assert");
const { createReplicationConfig } = require("../lib/agent/replication-config");
const sanitizeText = (value, max) =>
  String(value == null ? "" : value)
    .trim()
    .slice(0, max);
const sanitizeUrl = value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (_error) {
    return "";
  }
};
const { sanitizeReplication, sanitizeSyncUrl } = createReplicationConfig({
  sanitizeUrl,
  sanitizeText,
  defaultName: "Dashmon"
});
assert.equal(sanitizeSyncUrl("https://exemple.lan"), "https://exemple.lan/");
assert.equal(sanitizeSyncUrl("https://exemple.lan/?option=1"), "");
assert.equal(sanitizeSyncUrl("https://exemple.lan/#fragment"), "");
assert.equal(sanitizeSyncUrl("file:///etc/config"), "");
const result = sanitizeReplication({
  instanceName: " Dashboard ",
  secondaries: ["https://exemple.lan", "https://exemple.lan/", "file:///etc/config"],
  agentNames: { "https://exemple.lan": "Agent", "https://autre.exemple.lan": "ignore" },
  agentIcons: { "https://exemple.lan": "FA-Solid FA-Server", "https://autre.exemple.lan": "x" },
  agentHosts: { "https://exemple.lan": "host", "https://autre.exemple.lan": "ignore" }
});
assert.deepEqual(result, {
  role: "primary",
  instanceName: "Dashboard",
  secondaries: ["https://exemple.lan/"],
  agentNames: { "https://exemple.lan/": "Agent" },
  agentIcons: { "https://exemple.lan/": "fa-solid fa-server" },
  agentHosts: { "https://exemple.lan/": "host" }
});
// A tab icon that is not a class list falls back to a safe icon.
assert.equal(
  sanitizeReplication({
    secondaries: ["https://exemple.lan"],
    agentIcons: { "https://exemple.lan": '"><img src=x>' }
  }).agentIcons["https://exemple.lan/"],
  "fa-solid fa-folder"
);
assert.deepEqual(sanitizeReplication(null), {
  role: "primary",
  instanceName: "Dashmon",
  secondaries: [],
  agentNames: {},
  agentIcons: {},
  agentHosts: {}
});
console.log("PASS pairage : validation et normalisation de la configuration");
