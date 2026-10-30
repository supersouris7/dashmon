// Schema of the dashboard config as the browser uses it: defaults and
// normalisation of everything received from the server or imported from a
// file. A widget config is derived from its manifest (widget-registry.js),
// never from a field list written here.
import {
  sanitizeText,
  sanitizeIconClass,
  sanitizeUrl,
  sanitizeTileColor,
  sanitizeImagePath,
  assignTileColors
} from "./sanitize.js";
import { formatCompactCount } from "../format.js";
import { clone } from "../util.js";
import { normalizeWidgetConfig } from "../widget-registry.js";

export const DEFAULT_CATEGORIES = [
  { name: "Infrastructure", icon: "fa-solid fa-server" },
  { name: "Applications", icon: "fa-solid fa-cubes" },
  { name: "Administration", icon: "fa-solid fa-gear" }
];

// A dashboard is a named tab. Each category belongs to exactly one dashboard
// (mandatory dashboardId): that link decides which sections appear on which
// tab. The id "main" is reserved for the default dashboard so that migrating
// existing configs stays stable.
export const DEFAULT_DASHBOARDS = [{ id: "main", name: "Dashboard", icon: "fa-solid fa-grip" }];

// Reserved id: "supervision" is a separate page, never a dashboard.
export const RESERVED_DASHBOARD_IDS = Object.freeze(["supervision"]);

// No example host or service: the config is the user's own, empty on a new
// install.
export const DEFAULT_HOSTS = [];

export const DEFAULT_SERVICES = [];

export const DEFAULT_WEB_LINKS = [
  { name: "YouTube", url: "https://www.youtube.com", icon: "fa-brands fa-youtube" },
  { name: "Outlook", url: "https://outlook.office.com", icon: "fa-solid fa-envelope" },
  { name: "Google Drive", url: "https://drive.google.com", icon: "fa-brands fa-google-drive" },
  { name: "GitHub", url: "https://github.com", icon: "fa-brands fa-github" }
];

export const WEB_LINK_COLORS = Object.freeze({
  dark: "#272c33",
  red: "#d63b3b",
  blue: "#1868e0",
  green: "#0b8337",
  orange: "#b35a05",
  purple: "#7a3fc9"
});

export function normalizeWebLinksColor(value) {
  if (value === "pastel-red") return "red";
  return Object.hasOwn(WEB_LINK_COLORS, value) ? value : "dark";
}

// The banner text is always white: the colours above are dark enough to keep
// it readable.
export function webLinksColors(value) {
  return { background: WEB_LINK_COLORS[normalizeWebLinksColor(value)], foreground: "#ffffff" };
}

export function normalizeCollapsed(collapsed) {
  if (!collapsed || typeof collapsed !== "object" || Array.isArray(collapsed)) return {};
  const out = { ...collapsed };
  // Legacy cleanup: unprefixed keys (category:X, host:X as is) are duplicated
  // by the prefixed keys, which win; they are removed.
  for (const key of Object.keys(out)) {
    if (!key.startsWith("category:") && !key.startsWith("host:")) {
      if (out[`category:${key}`] !== undefined || out[`host:${key}`] !== undefined) {
        delete out[key];
      }
    }
  }
  return out;
}

// View preferences describe how THIS screen looks at the dashboard, not the
// config itself. They are stored in the browser (see view-prefs.js) and
// normalised here with exactly the same rules as the server config, so that a
// value tampered with in the browser cannot break the rendering.
export const VIEW_PREF_KEYS = Object.freeze([
  "viewMode",
  "sortMode",
  "groupMode",
  "openMode",
  "smallIcons",
  "collapsed",
  "webLinksHidden",
  "page",
  "dashboardId",
  "supervisionInstanceId",
  "supervisionSmartExpanded",
  "supervisionHostExpanded",
  "supervisionAptExpanded",
  "categoryColumns",
  "tileColumns",
  "supervisionColumns"
]);

// Grid density, set in Settings > Appearance: "auto" (as many as fit) or a
// fixed number of columns from 2 to 5. Narrow screens cap it (base.css).
export function normalizeGridColumns(value) {
  return ["2", "3", "4", "5"].includes(String(value)) ? String(value) : "auto";
}

// Expanded tiles are stored as a list of keys (instance + host), never as a
// free structure: tampered storage can neither inject HTML nor grow without
// limit.
export function normalizeExpandedKeys(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const key = item.trim().slice(0, 200);
    if (!key || out.includes(key)) continue;
    out.push(key);
    if (out.length >= 200) break;
  }
  return out;
}

export function normalizeViewPrefs(cfg = {}) {
  return {
    viewMode: ["rows", "columns", "plain"].includes(cfg.viewMode) ? cfg.viewMode : "columns",
    openMode: cfg.openMode === "new" ? "new" : "same",
    groupMode: cfg.groupMode === "host" ? "host" : "category",
    sortMode: cfg.sortMode === "usage" ? "usage" : "alphabetical",
    page: cfg.page === "supervision" ? "supervision" : "dashboard",
    // Active dashboard: validated later against the config's dashboards (only
    // the raw preference is known here).
    dashboardId:
      typeof cfg.dashboardId === "string" && cfg.dashboardId.trim()
        ? cfg.dashboardId.trim().slice(0, 64)
        : "",
    supervisionInstanceId:
      typeof cfg.supervisionInstanceId === "string" && cfg.supervisionInstanceId.trim()
        ? cfg.supervisionInstanceId.trim().slice(0, 200)
        : "local",
    smallIcons: cfg.smallIcons === true,
    webLinksHidden: cfg.webLinksHidden === true,
    collapsed: normalizeCollapsed(cfg.collapsed),
    supervisionSmartExpanded: normalizeExpandedKeys(cfg.supervisionSmartExpanded),
    supervisionHostExpanded: normalizeExpandedKeys(cfg.supervisionHostExpanded),
    supervisionAptExpanded: normalizeExpandedKeys(cfg.supervisionAptExpanded),
    categoryColumns: normalizeGridColumns(cfg.categoryColumns),
    tileColumns: normalizeGridColumns(cfg.tileColumns),
    supervisionColumns: normalizeGridColumns(cfg.supervisionColumns)
  };
}

// Special tiles of the dashboard: only one can be active at a time, hence a
// single object rather than a list. "fortune" is the only one so far.
export const SPECIAL_TILE_TYPES = Object.freeze(["fortune"]);

// The category is mandatory: without one, the first defined category is
// used, or "Autres" when there is none. A special tile of unknown type is
// ignored rather than rendered anyhow.
export function normalizeSpecialTile(raw, categories) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = typeof raw.type === "string" ? raw.type : "";
  if (!SPECIAL_TILE_TYPES.includes(type)) return null;
  const names = (Array.isArray(categories) ? categories : [])
    .map(cat => cat && cat.name)
    .filter(Boolean);
  const category = sanitizeText(raw.category, 100) || names[0] || "Autres";
  return { type, category };
}

// Counters of the web links banner: a link may show a public number (GitHub
// stars, Docker Hub pulls, YouTube subscribers) next to its name. The allowed
// types are exactly the widgets able to provide that number. Must stay
// identical to WEB_LINK_COUNTER_TYPES in lib/config/fields.js.
export const LINK_COUNTER_TYPES = Object.freeze(["github", "dockerhub", "youtube"]);

// The target (repository or channel) is mandatory: a counter without target
// measures nothing, so it is ignored rather than showing a misleading number.
export function normalizeLinkCounter(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!LINK_COUNTER_TYPES.includes(type)) return null;
  const target = sanitizeText(raw.target, 200);
  if (!target) return null;
  return { type, target };
}

// Field of the status entry holding the number to show, per counter type.
// This is the contract of the matching widget backends: GitHub publishes
// "value" (the chosen metric), Docker Hub "pulls", YouTube "subscribers".
// Returns null when the number is unavailable.
export function linkCounterValue(counter, status) {
  if (!counter || !status || status.ok !== true) return null;
  const field =
    counter.type === "dockerhub" ? "pulls" : counter.type === "youtube" ? "subscribers" : "value";
  const value = Number(status[field]);
  return Number.isFinite(value) ? value : null;
}

// The banner stays narrow: beyond 999 the number is compacted with a suffix,
// k for thousands and M for millions. 109 stays "109", 3000 becomes "3k",
// 64600000 becomes "64.6M".
export function compactCount(value) {
  return formatCompactCount(value);
}

// Dashboards: there is always at least one tab. A missing or reserved id gets
// a generated one, and duplicates are dropped so that state.dashboardId
// designates a single entry. The default "main" dashboard is recreated when
// none is declared.
export function normalizeDashboards(raw) {
  const seen = new Set();
  const list = (Array.isArray(raw) ? raw : [])
    .map(item => ({
      id: sanitizeText(item && item.id, 64),
      name: sanitizeText(item && item.name, 100),
      icon: sanitizeIconClass(item && item.icon)
    }))
    .filter(item => item.name)
    .map(item => {
      let id = item.id;
      if (!id || RESERVED_DASHBOARD_IDS.includes(id) || seen.has(id))
        id = "dashboard-" + Math.random().toString(36).slice(2, 10);
      seen.add(id);
      return { id, name: item.name, icon: item.icon || "fa-solid fa-grip" };
    });
  if (!list.length) return clone(DEFAULT_DASHBOARDS);
  return list;
}

// Local supervision only: other machines are read through their agents.
export const HOST_MONITORING_TYPES = Object.freeze(["local"]);

export function normalizeHostMonitoring(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.type === "proxmox") return null;
  const type = HOST_MONITORING_TYPES.includes(raw.type) ? raw.type : "local";
  return {
    enabled: raw.enabled === true,
    type,
    url: sanitizeUrl(raw.url),
    node: sanitizeText(raw.node, 50),
    path: sanitizeText(raw.path, 200),
    tokenIdEnv: sanitizeText(raw.tokenIdEnv, 100),
    tokenSecretEnv: sanitizeText(raw.tokenSecretEnv, 100),
    wireguard:
      type === "local" ? normalizeWireguardPrefs(raw.wireguard) : { enabled: true, interface: "" },
    smart: normalizeSmartPrefs(raw.smart),
    aptUpdates: normalizeAptUpdatesPrefs(raw.aptUpdates)
  };
}

// Display preference of a host's WireGuard peers. When absent, the section is
// shown as soon as the local dump has data; an optional interface filter
// shows a single tunnel.
export function normalizeWireguardPrefs(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    enabled: src.enabled !== false,
    interface: sanitizeText(src.interface, 50)
  };
}

// SMART preference: section shown by default, with an optional filter on
// device names (`/dev/sda`, `/dev/nvme0`, ...).
export function normalizeSmartPrefs(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const disks = Array.isArray(src.disks)
    ? [...new Set(src.disks.map(value => sanitizeText(value, 100)).filter(Boolean))].slice(0, 20)
    : [];
  return { enabled: src.enabled !== false, disks };
}

export function normalizeAptUpdatesPrefs(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return { enabled: src.enabled !== false };
}

export function normalizeConfig(cfg = {}) {
  const normalizedServices = Array.isArray(cfg.services) ? clone(cfg.services) : [];
  const derivedHosts = [
    ...new Set(normalizedServices.map(service => (service.host || "").trim()).filter(Boolean))
  ].map(name => ({ name, icon: "fa-solid fa-server" }));
  // Dashboards: ordered list feeding the tabs. An empty, duplicated or reserved
  // ("supervision") id is replaced by a generated one.
  const normalizedDashboards = normalizeDashboards(cfg.dashboards);
  const dashboardIds = new Set(normalizedDashboards.map(d => d.id));
  const defaultDashboardId = normalizedDashboards[0].id;
  const normalizedCategories = (
    Array.isArray(cfg.categories) ? clone(cfg.categories) : clone(DEFAULT_CATEGORIES)
  ).map(cat => ({
    name: sanitizeText(cat.name, 100),
    icon: sanitizeIconClass(cat.icon),
    color: sanitizeTileColor(cat.color),
    dashboardId: dashboardIds.has(sanitizeText(cat.dashboardId, 64))
      ? sanitizeText(cat.dashboardId, 64)
      : defaultDashboardId
  }));
  const normalized = {
    ...normalizeViewPrefs(cfg),
    services: normalizedServices.map(svc => ({
      name: sanitizeText(svc.name, 100),
      host: sanitizeText(svc.host, 100),
      category: sanitizeText(svc.category, 100),
      url: sanitizeUrl(svc.url),
      icon: sanitizeImagePath(svc.icon),
      monitor: svc.monitor === false ? false : svc.monitor === "soft" ? "soft" : true,
      // Normalisation driven by the widget schema (manifest). An unknown widget is
      // kept as is: settings are never lost.
      widget: normalizeWidgetConfig(svc.widget)
    })),
    categories: normalizedCategories,
    dashboards: normalizedDashboards,
    // Single special tile of the dashboard (quote of the day...), placed in a
    // category. Absent: none.
    specialTile: normalizeSpecialTile(cfg.specialTile, normalizedCategories),
    hosts:
      Array.isArray(cfg.hosts) && cfg.hosts.length
        ? cfg.hosts.map(host => ({
            id: sanitizeText(host.id, 64),
            name: sanitizeText(host.name, 100),
            icon: sanitizeIconClass(host.icon),
            color: sanitizeTileColor(host.color),
            monitoring: normalizeHostMonitoring(host.monitoring)
          }))
        : derivedHosts.map(host => ({
            ...host,
            id: host.id || "host-" + Math.random().toString(36).slice(2, 10)
          })),
    replication: {
      role: "primary",
      instanceName: sanitizeText(cfg.replication?.instanceName, 100) || "Dashmon",
      secondaries: Array.isArray(cfg.replication?.secondaries)
        ? [
            ...new Set(cfg.replication.secondaries.map(value => sanitizeUrl(value)).filter(Boolean))
          ].slice(0, 20)
        : [],
      agentNames:
        cfg.replication?.agentNames &&
        typeof cfg.replication.agentNames === "object" &&
        !Array.isArray(cfg.replication.agentNames)
          ? Object.fromEntries(
              Object.entries(cfg.replication.agentNames)
                .map(([url, name]) => [sanitizeUrl(url), sanitizeText(name, 100)])
                .filter(([url, name]) => url && name)
            )
          : {},
      // Each pairing points to a host of the editor: its colour and icon dress the
      // remote tile. The match uses the stable id, never the name.
      agentHosts:
        cfg.replication?.agentHosts &&
        typeof cfg.replication.agentHosts === "object" &&
        !Array.isArray(cfg.replication.agentHosts)
          ? Object.fromEntries(
              Object.entries(cfg.replication.agentHosts)
                .map(([url, hostId]) => [sanitizeUrl(url), sanitizeText(hostId, 64)])
                .filter(([url, hostId]) => url && hostId)
            )
          : {}
    },
    theme: typeof cfg.theme === "string" && cfg.theme.trim() ? cfg.theme.trim() : "dark",
    language: cfg.language === "en" ? "en" : "fr",
    usageCounts:
      cfg.usageCounts && typeof cfg.usageCounts === "object" && !Array.isArray(cfg.usageCounts)
        ? cfg.usageCounts
        : {},
    webLinks: (Array.isArray(cfg.webLinks) ? clone(cfg.webLinks) : clone(DEFAULT_WEB_LINKS)).map(
      link => ({
        name: sanitizeText(link.name, 100),
        url: sanitizeUrl(link.url),
        icon: sanitizeIconClass(link.icon),
        counter: normalizeLinkCounter(link.counter)
      })
    ),
    webLinksSeedVersion: Number.isFinite(Number(cfg.webLinksSeedVersion))
      ? Number(cfg.webLinksSeedVersion)
      : 0,
    webLinksColor: normalizeWebLinksColor(cfg.webLinksColor)
  };
  // Categories and hosts each have THEIR OWN palette: a host colour may
  // legitimately equal a category colour. Both lists are processed separately,
  // without a shared set: linking them would force changing a colour on one
  // side whenever the other changes.
  assignTileColors(normalized.categories, new Set());
  assignTileColors(normalized.hosts, new Set());
  return normalized;
}
