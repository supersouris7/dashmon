// Dashboard rendering: which services are visible (dashboard, search), how
// they are grouped (category or host), and the collapse and status
// updates. Cards, sections, web links and toolbar buttons live in dashboard/.
import {
  state,
  getDashboard,
  compareServices,
  serviceMatchesSearch,
  FALLBACK_HOST
} from "./state.js";
import { sanitizeUrl } from "./config/sanitize.js";
import { normalize } from "./util.js";
import { t } from "./i18n.js";
import { effectiveStatus, statusIcon } from "./status.js";
import { dashboard, searchInput, searchStatus, collapseAllBtn } from "./dom.js";
import { updateWebLinkCounters, renderWebLinks } from "./dashboard/web-links.js";
import { statusTitle, applyWidgetStatus, tileColorFor, createCard } from "./dashboard/cards.js";
import { createSection } from "./dashboard/sections.js";
import { layoutColumns } from "./dashboard/columns-layout.js";
import { searchQuery } from "./dashboard/query.js";
import { updateFortuneBar } from "./dashboard/fortune-bar.js";

// Actions of the welcome shown on an empty dashboard, provided by app.js.
let welcomeActions = null;
export function setWelcomeActions(actions) {
  welcomeActions = actions;
}

// First screen of a new install: what Dashmon is for and the two ways to
// start, adding an application or loading the example.
function createWelcome() {
  const welcome = document.createElement("section");
  welcome.className = "empty welcome";
  const title = document.createElement("h2");
  title.textContent = t("welcomeTitle");
  const text = document.createElement("p");
  text.textContent = t("welcomeText");
  const actions = document.createElement("div");
  actions.className = "action-group";
  for (const [key, icon, action, primary] of [
    ["welcomeAdd", "fa-plus", "openSettings", true],
    ["welcomeDemo", "fa-wand-magic-sparkles", "loadDemo", false]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn" + (primary ? " primary" : "");
    button.dataset.welcome = action;
    const glyph = document.createElement("i");
    glyph.className = "fa-solid " + icon;
    glyph.setAttribute("aria-hidden", "true");
    button.append(glyph, document.createTextNode(" " + t(key)));
    button.addEventListener("click", () => welcomeActions?.[action]());
    actions.appendChild(button);
  }
  welcome.append(title, text, actions);
  return welcome;
}

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

// A search looks through every dashboard, not only the active one.
function serviceMatchesQuery(service) {
  const query = searchQuery();
  return query ? serviceMatchesSearch(service, query) : serviceInDashboard(service);
}

function groupFallbackName() {
  return state.groupMode === "host" ? FALLBACK_HOST : "Autres";
}

function getVisibleGroupNames() {
  const filtered = state.services.filter(serviceMatchesQuery);
  const field = state.groupMode === "host" ? "host" : "category";
  const names = [
    ...new Set(filtered.map(service => (service[field] || "").trim() || groupFallbackName()))
  ];
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
  drawDashboard();
  layoutColumns();
}

function drawDashboard() {
  renderWebLinks();
  updateFortuneBar();
  dashboard.dataset.view = state.viewMode;
  dashboard.dataset.categoryColumns = state.categoryColumns;
  dashboard.dataset.tileColumns = state.tileColumns;
  dashboard.classList.toggle("small-icons", state.smallIcons);

  const filtered = state.services.filter(serviceMatchesQuery);

  dashboard.innerHTML = "";
  announceSearch(filtered.length);

  if (!state.services.length && !searchQuery()) {
    dashboard.appendChild(createWelcome());
    return;
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = searchQuery()
      ? t("searchNoResult").replace("{query}", searchInput.value.trim())
      : t("noServices");
    dashboard.appendChild(empty);
    return;
  }

  if (state.viewMode === "plain") {
    const cards = document.createElement("div");
    cards.className = "cards";

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
      const section = createSection(hostName, items, "host", updateCollapseAllButton);
      section.dataset.rank = String(index);
      dashboard.appendChild(section);
    });
  } else {
    sortGroupNames(getVisibleGroupNames()).forEach((categoryName, index) => {
      const items = filtered.filter(s => (s.category || "Autres") === categoryName);
      const section = createSection(categoryName, items, "category", updateCollapseAllButton);
      section.dataset.rank = String(index);
      markOtherDashboard(section, categoryName);
      dashboard.appendChild(section);
    });
  }

  updateCollapseAllButton();
}

// Screen readers hear the number of results; nothing is said without a search.
function announceSearch(count) {
  searchStatus.textContent = !searchQuery()
    ? ""
    : !count
      ? t("searchNoResult").replace("{query}", searchInput.value.trim())
      : count === 1
        ? t("searchResultOne")
        : t("searchResults").replace("{count}", String(count));
}

// A search result from another dashboard names it in its section header.
function markOtherDashboard(section, categoryName) {
  const id = categoryDashboardId(categoryName);
  if (!searchQuery() || id === currentDashboardId()) return;
  const badge = document.createElement("span");
  badge.className = "section-dashboard";
  badge.textContent = getDashboard(id).name;
  section.querySelector(".category-name").after(badge);
}

function getActiveGroupEntries() {
  if (state.viewMode === "plain") return [];

  return sortGroupNames(getVisibleGroupNames()).map(name => ({
    name,
    key: `${state.groupMode}:${name}`
  }));
}

// During a search every section is open, whatever its saved state.
function isGroupCollapsed(entry) {
  if (searchQuery()) return false;
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
