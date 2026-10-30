"use strict";
const crypto = require("crypto");
const {
  sanitizeText,
  sanitizeColor,
  sanitizeUrl,
  sanitizeIconClass,
  sanitizeImagePath
} = require("../sanitize");
const { sanitizeLinkCounter, sanitizeSpecialTile, sanitizeHostMonitoring } = require("./fields");

// Schema of the main dashboard configuration: every saved config goes through
// here and only the known, validated fields come out. Widgets and pairing are
// injected, so the general schema does not depend on their implementation.
// Collapsed sections: { section key: true | false }. An explicit false matters
// (it overrides an older key stored under the section name), so both values
// are kept; anything else is dropped, and the map is bounded.
function sanitizeCollapsed(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key, value]) => typeof value === "boolean" && key.length <= 200)
      .slice(0, 500)
  );
}

function createConfigNormalizer({ serializeWidget, sanitizeReplication }) {
  return function buildConfigOutput(config) {
    const dashboards = (Array.isArray(config.dashboards) ? config.dashboards : [])
      .slice(0, 20)
      .map(d => ({
        id: sanitizeText(d && d.id, 64),
        name: sanitizeText(d && d.name, 100),
        icon: sanitizeIconClass(d && d.icon)
      }))
      .filter(d => d.name)
      .reduce((list, d) => {
        let id = d.id;
        if (!id || id === "supervision" || list.some(item => item.id === id))
          id = "dashboard-" + crypto.randomBytes(4).toString("hex");
        list.push({ id, name: d.name, icon: d.icon });
        return list;
      }, []);
    if (!dashboards.length)
      dashboards.push({ id: "main", name: "Dashboard", icon: "fa-solid fa-grip" });
    const dashboardIds = new Set(dashboards.map(d => d.id));
    const categories = Array.isArray(config.categories)
      ? config.categories.slice(0, 50).map(cat => ({
          name: sanitizeText(cat.name, 100),
          icon: sanitizeIconClass(cat.icon),
          color: sanitizeColor(cat.color),
          dashboardId: dashboardIds.has(sanitizeText(cat.dashboardId, 64))
            ? sanitizeText(cat.dashboardId, 64)
            : dashboards[0].id
        }))
      : [];
    return {
      services: Array.isArray(config.services)
        ? config.services.slice(0, 200).map(svc => ({
            name: sanitizeText(svc.name, 100),
            host: sanitizeText(svc.host, 100),
            category: sanitizeText(svc.category, 100),
            url: sanitizeUrl(svc.url),
            icon: sanitizeImagePath(svc.icon),
            monitor: svc.monitor === false ? false : svc.monitor === "soft" ? "soft" : true,
            widget: serializeWidget(svc.widget)
          }))
        : [],
      categories,
      dashboards,
      specialTile: sanitizeSpecialTile(config.specialTile, categories),
      replication: sanitizeReplication(config.replication),
      hosts: Array.isArray(config.hosts)
        ? config.hosts.slice(0, 51).map(host => ({
            id: sanitizeText(host.id, 64) || "host-" + crypto.randomBytes(6).toString("hex"),
            name: sanitizeText(host.name, 100),
            icon: sanitizeIconClass(host.icon),
            color: sanitizeColor(host.color),
            monitoring: sanitizeHostMonitoring(host.monitoring)
          }))
        : [],
      collapsed: sanitizeCollapsed(config.collapsed),
      viewMode: ["rows", "columns", "plain"].includes(config.viewMode)
        ? config.viewMode
        : "columns",
      openMode: config.openMode === "new" ? "new" : "same",
      groupMode: config.groupMode === "host" ? "host" : "category",
      // A theme id (see lib/themes.js): a short name.
      theme:
        typeof config.theme === "string" && config.theme.trim()
          ? config.theme.trim().slice(0, 64)
          : "dark",
      language: config.language === "fr" ? "fr" : "en",
      sortMode: config.sortMode === "usage" ? "usage" : "alphabetical",
      usageCounts:
        config.usageCounts &&
        typeof config.usageCounts === "object" &&
        !Array.isArray(config.usageCounts)
          ? Object.fromEntries(
              Object.entries(config.usageCounts)
                .slice(0, 500)
                .map(([key, value]) => {
                  const n = Number(value);
                  return [
                    String(key).slice(0, 200),
                    Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
                  ];
                })
            )
          : {},
      webLinks: Array.isArray(config.webLinks)
        ? config.webLinks.slice(0, 100).map(link => ({
            name: sanitizeText(link.name, 100),
            url: sanitizeUrl(link.url),
            icon: sanitizeIconClass(link.icon),
            counter: sanitizeLinkCounter(link.counter)
          }))
        : [],
      webLinksSeedVersion: Number.isFinite(Number(config.webLinksSeedVersion))
        ? Number(config.webLinksSeedVersion)
        : 0,
      webLinksColor:
        config.webLinksColor === "pastel-red"
          ? "red"
          : ["dark", "red", "blue", "green", "orange", "purple"].includes(config.webLinksColor)
            ? config.webLinksColor
            : "dark",
      smallIcons: config.smallIcons === true
    };
  };
}
module.exports = { createConfigNormalizer };
