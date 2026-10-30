// Dashboard rendering: which services are visible (dashboard, search, special
// tile), how they are grouped (category or host), and the collapse and status
// updates. Cards, sections, web links and toolbar buttons live in dashboard/.
import { state, getCategory, compareServices, FALLBACK_HOST } from "./state.js";
import { sanitizeUrl, sanitizeTileColor } from "./config/sanitize.js";
import { normalize } from "./util.js";
import { t } from "./i18n.js";
import { effectiveStatus, statusIcon } from "./status.js";
import { dashboard, searchInput, collapseAllBtn } from "./dom.js";
import { updateWebLinkCounters, renderWebLinks } from "./dashboard/web-links.js";
import {
  statusTitle,
  applyWidgetStatus,
  tileColorFor,
  createFortuneCard,
  createCard
} from "./dashboard/cards.js";
import { createSection, reorderDashboardSections } from "./dashboard/sections.js";

// Active dashboard, bounded to an existing id: a preference from another
// browser pointing at a deleted dashboard must not empty the screen.
export function currentDashboardId() {
  return state.dashboards.some(d => d.id === state.dashboardId)
    ? state.dashboardId
    : state.dashboards[0]?.id || "";
}

// A dashboard groups categories; a category belongs to one dashboard. A
// service is visible when its category belongs to the active dashboard. An
// empty or unknown category falls back to the first dashboard, so a badly
// categorised service never disappears.
function categoryDashboardId(name) {
  const category = state.categories.find(c => c.name === name);
  return category ? category.dashboardId : state.dashboards[0]?.id || "";
}

function serviceInDashboard(service) {
  return categoryDashboardId(service.category) === currentDashboardId();
}

function serviceMatchesQuery(service) {
  if (!serviceInDashboard(service)) return false;
  const query = normalize(searchInput.value);
  if (!query) return true;
  return [service.name, service.category, service.host, service.url].some(value =>
    normalize(value).includes(query)
  );
}

function groupFallbackName() {
  return state.groupMode === "host" ? FALLBACK_HOST : "Autres";
}

export function groupLabel(name) {
  return state.groupMode === "host" && name === FALLBACK_HOST ? t("noHost") : name;
}

// Special tile: one per dashboard, placed in the chosen category. When
// grouping by host it joins the "no host" group. It follows the search and the
// active dashboard like services do.
function specialTileVisible() {
  if (!state.specialTile) return false;
  if (categoryDashboardId(state.specialTile.category) !== currentDashboardId()) return false;
  const query = normalize(searchInput.value);
  if (!query) return true;
  return normalize(state.specialTile.category).includes(query);
}

function specialGroupName() {
  if (!specialTileVisible()) return "";
  return state.groupMode === "host" ? FALLBACK_HOST : state.specialTile.category || "Autres";
}

function createSpecialCard() {
  const tile = state.specialTile;
  if (!tile) return null;
  if (tile.type === "fortune") return createFortuneCard(tile.type);
  return null;
}

// Colour of the special tile in the flat view: same rule as services,
// resolved on the group hosting it.
function specialTileColor() {
  if (state.groupMode === "host") {
    const host = state.hosts.find(item => item.name === FALLBACK_HOST);
    return sanitizeTileColor((host || {}).color);
  }
  return sanitizeTileColor((getCategory(state.specialTile.category) || {}).color);
}

function getVisibleGroupNames() {
  const filtered = state.services.filter(serviceMatchesQuery);
  const field = state.groupMode === "host" ? "host" : "category";
  const names = [
    ...new Set(filtered.map(service => (service[field] || "").trim() || groupFallbackName()))
  ];
  const extra = specialGroupName();
  if (extra && !names.includes(extra)) names.push(extra);
  return names;
}

function sortGroupNames(names) {
  const reference = state.groupMode === "host" ? state.hosts : state.categories;
  return names.sort((a, b) => {
    const ia = reference.findIndex(item => item.name === a);
    const ib = reference.findIndex(item => item.name === b);
    if (ia === -1 && ib === -1) return normalize(a).localeCompare(normalize(b), "fr");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function render() {
  renderWebLinks();
  dashboard.dataset.view = state.viewMode;
  dashboard.classList.toggle("small-icons", state.smallIcons);

  const filtered = state.services.filter(serviceMatchesQuery);
  const specialGroup = specialGroupName();
  const special = specialGroup ? createSpecialCard() : null;

  dashboard.innerHTML = "";

  if (!filtered.length && !special) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noServices");
    dashboard.appendChild(empty);
    return;
  }

  if (state.viewMode === "plain") {
    const cards = document.createElement("div");
    cards.className = "cards";

    if (special) {
      const color = specialTileColor();
      if (color) {
        special.classList.add("tinted");
        special.style.setProperty("--tile-color", color);
      }
      cards.appendChild(special);
    }

    [...filtered].sort(compareServices).forEach(service => {
      const card = createCard(service);
      // Flat view: the tile carries its own colour, having no section.
      const color = tileColorFor(service);
      if (color) {
        card.classList.add("tinted");
        card.style.setProperty("--tile-color", color);
      }
      cards.appendChild(card);
    });

    dashboard.appendChild(cards);
    return;
  }

  if (state.groupMode === "host") {
    sortGroupNames(getVisibleGroupNames()).forEach((hostName, index) => {
      const items = filtered.filter(s => ((s.host || "").trim() || FALLBACK_HOST) === hostName);
      const section = createSection(
        hostName,
        items,
        "host",
        specialGroup === hostName ? special : null
      );
      section.dataset.rank = String(index);
      dashboard.appendChild(section);
    });
  } else {
    sortGroupNames(getVisibleGroupNames()).forEach((categoryName, index) => {
      const items = filtered.filter(s => (s.category || "Autres") === categoryName);
      const section = createSection(
        categoryName,
        items,
        "category",
        specialGroup === categoryName ? special : null
      );
      section.dataset.rank = String(index);
      dashboard.appendChild(section);
    });
  }

  reorderDashboardSections(false);
  updateCollapseAllButton();
}

function getActiveGroupEntries() {
  if (state.viewMode === "plain") return [];

  return sortGroupNames(getVisibleGroupNames()).map(name => ({
    name,
    key: `${state.groupMode}:${name}`
  }));
}

function isGroupCollapsed(entry) {
  return state.collapsed[entry.key] ?? state.collapsed[entry.name] ?? false;
}

export function getCollapseAllState() {
  const entries = getActiveGroupEntries();
  const collapsedCount = entries.filter(isGroupCollapsed).length;
  const expandedCount = entries.length - collapsedCount;

  return {
    entries,
    collapsedCount,
    expandedCount,
    majorityCollapsed: collapsedCount > expandedCount
  };
}

export function updateCollapseAllButton() {
  const info = getCollapseAllState();

  collapseAllBtn.disabled = info.entries.length === 0;

  const actionExpand = info.majorityCollapsed;
  collapseAllBtn.title = actionExpand ? t("expandAll") : t("collapseAll");
  collapseAllBtn.setAttribute("aria-label", collapseAllBtn.title);
  collapseAllBtn.innerHTML = actionExpand
    ? '<i class="fa-solid fa-angles-down"></i>'
    : '<i class="fa-solid fa-angles-up"></i>';
}

export function updateStatusIndicators() {
  document.querySelectorAll(".service-status[data-url]").forEach(status => {
    const info = state.serviceStatus[status.dataset.url];
    if (!info) return;
    const monitor = status.dataset.soft === "1" ? "soft" : "full";
    const serviceState = effectiveStatus(monitor, info);
    status.className = `service-status ${serviceState}`;
    const icon = status.querySelector("i");
    if (icon) icon.className = statusIcon(serviceState);
    status.title = statusTitle(monitor, info);
  });
  document.querySelectorAll(".widget-status[data-url]").forEach(wrap => {
    const info = state.serviceStatus[wrap.dataset.url];
    if (!info) return;
    const service =
      wrap._service ||
      state.services.find(s => s.url === wrap.dataset.url) ||
      state.services.find(s => (sanitizeUrl(s.url) || s.url) === wrap.dataset.url);
    applyWidgetStatus(wrap, service, info);
  });
  updateWebLinkCounters();
}
