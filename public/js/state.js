// Shared application state: the config received from the server, the editor
// drafts (edit*) and the view preferences, plus lookups on them.
//
// How the config is validated lives in config/normalize.js.
import { normalize } from "./util.js";
import { DEFAULT_DASHBOARDS } from "./config/normalize.js";

// Stable, language-independent label of the group of services without a
// host: the collapsed keys rely on it. Displayed through t("noHost").
export const FALLBACK_HOST = "Sans hôte";

export const state = {
  services: [],
  categories: [],
  dashboards: [],
  hosts: [],
  replication: {
    role: "primary",
    instanceName: "Dashmon",
    secondaries: [],
    agentNames: {},
    agentHosts: {}
  },
  collapsed: {},
  supervisionSmartExpanded: [],
  supervisionHostExpanded: [],
  supervisionAptExpanded: [],
  viewMode: "columns",
  // Grid density (view preferences): "auto" or 2 to 5 columns.
  categoryColumns: "auto",
  tileColumns: "auto",
  supervisionColumns: "auto",
  page: "dashboard",
  dashboardId: "main",
  supervisionInstanceId: "local",
  openMode: "same",
  groupMode: "category",
  theme: "dark",
  language: "en",
  sortMode: "alphabetical",
  usageCounts: {},
  webLinks: [],
  webLinksColor: "dark",
  webLinksHidden: false,
  webLinksSeedVersion: 0,
  smallIcons: false,
  editServices: [],
  editCategories: [],
  editDashboards: [],
  editHosts: [],
  editWebLinks: [],
  specialTile: null,
  editSpecialTile: null,
  serviceStatus: {},
  statusTimer: null,
  // Last host metrics reading (GET /api/host-metrics) and its refresh timer,
  // active only on the supervision page.
  hostMetrics: null,
  hostMetricsError: false,
  hostMetricsTimer: null,
  themes: { native: [], custom: [] }
};

export function serviceUsageKey(service) {
  return service.url || `${service.name || ""}|${service.host || ""}|${service.category || ""}`;
}

export function compareServices(a, b) {
  if (state.sortMode === "usage") {
    const usageA = Number(state.usageCounts[serviceUsageKey(a)] || 0);
    const usageB = Number(state.usageCounts[serviceUsageKey(b)] || 0);
    if (usageA !== usageB) return usageB - usageA;
  }
  return normalize(a.name).localeCompare(normalize(b.name), "fr");
}

export function getCategory(name) {
  return state.categories.find(c => c.name === name) || { name, icon: "fa-solid fa-folder" };
}

// Dashboard by id. An unknown id (preference from another browser, deleted
// dashboard) falls back to the first dashboard, which always exists.
export function getDashboard(id) {
  return state.dashboards.find(d => d.id === id) || state.dashboards[0] || DEFAULT_DASHBOARDS[0];
}
