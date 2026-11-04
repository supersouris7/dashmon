"use strict";
const assert = require("assert");
const { createConfigNormalizer } = require("../lib/config/normalize");
const normalize = createConfigNormalizer({
  serializeWidget: value => value || null,
  sanitizeReplication: value => value || {}
});
const config = normalize({
  dashboards: [{ id: "first", name: "Principal" }],
  categories: [{ name: "Divers", dashboardId: "first", color: "#AABBCC" }],
  hosts: [
    {
      id: "host",
      name: "Machine",
      tabIcon: "fa-solid fa-house",
      monitoring: { type: "local", enabled: true }
    },
    { id: "other", name: "Autre", tabIcon: "", monitoring: { type: "local", enabled: false } }
  ],
  specialTile: { type: "fortune", category: "Divers" },
  webLinks: [{ name: "Lien", url: "https://exemple.lan" }],
  usageCounts: { item: 3.9 },
  language: "fr",
  collapsed: { open: false, closed: true, nested: { deep: true }, text: "yes" },
  theme: "x".repeat(500)
});
// Only boolean collapsed flags are kept; the theme name is bounded.
assert.deepEqual(config.collapsed, { open: false, closed: true });
assert.equal(config.theme.length, 64);
assert.equal(config.categories[0].dashboardId, "first");
assert.equal(config.categories[0].color, "#aabbcc");
assert.equal(config.hosts[0].monitoring.enabled, true);
// Tab icon of the local supervision tab: kept when set, absent otherwise.
assert.equal(config.hosts[0].tabIcon, "fa-solid fa-house");
assert.equal("tabIcon" in config.hosts[1], false);
assert.equal(config.fortune, true);
assert.equal("specialTile" in config, false);
assert.equal(config.webLinks[0].url, "https://exemple.lan/");
assert.equal(config.usageCounts.item, 3);
assert.equal(config.language, "fr");
assert.equal(normalize({}).dashboards[0].id, "main");
console.log("PASS configuration : normalisation du tableau de bord");
