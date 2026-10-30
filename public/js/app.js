// Entry point: start-up, main menu, dialogs (editor, appearance) and global
// events.
import { state } from "./state.js";
import { normalizeConfig, normalizeViewPrefs, normalizeGridColumns } from "./config/normalize.js";
import { isTypingTarget } from "./util.js";
import { patchConfig, setConfigRevision } from "./api.js";
import { loadViewPrefs, pickViewPrefs, saveViewPrefs } from "./view-prefs.js";
import {
  render,
  getCollapseAllState,
  updateCollapseAllButton,
  updateStatusIndicators
} from "./render.js";
import {
  updateViewButton,
  updateIconsButton,
  updateOpenModeMenu,
  updateGroupModeMenu,
  updateSortModeMenu,
  setGroupMode
} from "./dashboard/view-controls.js";
import {
  t,
  applyLanguage,
  setThemeLabelsUpdater,
  setCollapseButtonUpdater,
  setSupervisionUpdater,
  setPageSwitchUpdater
} from "./i18n.js";
import {
  loadThemes,
  applyTheme,
  setTheme,
  currentTheme,
  downloadTheme,
  importThemeFile,
  deleteCustomTheme,
  applyThemeLabels
} from "./themes.js";
import { startStatusLoop, setupVisibilityPause, manualRefresh } from "./metrics.js";
import { renderSupervision } from "./supervision.js";
import { toggleAllSmartDetails } from "./supervision/cards.js";
import { renderPageSwitch, setPage } from "./pages.js";
import { openEditor, requestCloseEditor, dismissConfirm, confirmDanger } from "./editor.js";
import { renderHostEditor } from "./editor/hosts.js";
import { renderDashboardEditor } from "./editor/dashboards.js";
import { renderCategoryEditor } from "./editor/categories.js";
import { renderWidgetsEditor } from "./editor/widgets.js";
import { renderWebLinksEditor } from "./editor/web-links.js";
import { renderServiceEditor } from "./editor/services.js";
import { closeImageLibrary } from "./images.js";
import { loadWidgetRegistry } from "./widget-registry.js";
import { hideToolbarSearch, menuRightOffset } from "./toolbar.js";
import {
  searchInput,
  viewBtn,
  iconsBtn,
  collapseAllBtn,
  moreBtn,
  topMenu,
  openModeSelect,
  groupCategoryBtn,
  groupHostBtn,
  sortAlphabeticalBtn,
  sortUsageBtn,
  menuSettingsBtn,
  menuRefreshBtn,
  menuLogoutBtn,
  themeSelect,
  languageSelect,
  webLinksSection,
  restoreWebLinksBtn,
  resetUsageBtn,
  importThemeBtn,
  exportThemeBtn,
  deleteThemeBtn,
  themeImportInput,
  modalBackdrop,
  imageLibrary
} from "./dom.js";

setThemeLabelsUpdater(applyThemeLabels);
setCollapseButtonUpdater(updateCollapseAllButton);
setSupervisionUpdater(renderSupervision);
setPageSwitchUpdater(renderPageSwitch);
window.addEventListener("dashmon:config-conflict", () => alert(t("configConflict")));

async function loadConfig() {
  try {
    // Cache-busting parameter: some reverse proxies ignore Cache-Control and serve
    // the old configuration again after a deletion.
    const response = await fetch("/api/config?_=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    setConfigRevision(response.headers.get("ETag"));

    const cfg = normalizeConfig(await response.json());
    state.services = cfg.services;
    state.categories = cfg.categories;
    state.dashboards = cfg.dashboards;
    state.hosts = cfg.hosts;
    state.replication = cfg.replication;
    state.specialTile = cfg.specialTile;
    // Screen layout: this browser wins; the server config only provides the
    // initial value (first load, or a brand new browser).
    const viewPrefs = normalizeViewPrefs(Object.assign(pickViewPrefs(cfg), loadViewPrefs()));
    state.collapsed = viewPrefs.collapsed;
    state.viewMode = viewPrefs.viewMode;
    state.openMode = viewPrefs.openMode;
    state.groupMode = viewPrefs.groupMode;
    state.sortMode = viewPrefs.sortMode;
    state.smallIcons = viewPrefs.smallIcons;
    state.webLinksHidden = viewPrefs.webLinksHidden;
    state.page = viewPrefs.page;
    state.supervisionInstanceId = viewPrefs.supervisionInstanceId;
    state.supervisionSmartExpanded = viewPrefs.supervisionSmartExpanded;
    state.supervisionHostExpanded = viewPrefs.supervisionHostExpanded;
    state.supervisionAptExpanded = viewPrefs.supervisionAptExpanded;
    state.categoryColumns = viewPrefs.categoryColumns;
    state.tileColumns = viewPrefs.tileColumns;
    state.supervisionColumns = viewPrefs.supervisionColumns;
    // The active dashboard comes from the preference, bounded to the config's
    // list: a preference whose dashboard was deleted falls back to the first one.
    state.dashboardId = cfg.dashboards.some(d => d.id === viewPrefs.dashboardId)
      ? viewPrefs.dashboardId
      : cfg.dashboards[0]?.id || state.dashboardId;
    state.webLinksColor = cfg.webLinksColor;
    state.theme = cfg.theme;
    state.language = cfg.language;
    state.usageCounts = cfg.usageCounts;
    state.webLinks = cfg.webLinks;
    state.webLinksSeedVersion = cfg.webLinksSeedVersion;
  } catch (error) {
    console.error("Chargement de config.json impossible", error);
  }

  updateViewButton();
  updateIconsButton();
  updateOpenModeMenu();
  updateGroupModeMenu();
  updateSortModeMenu();
  applyTheme();
  applyLanguage();
  render();
  setPage(state.page);
  setToolbarHeight();
}

function closeTopMenu() {
  topMenu.classList.remove("show");
  moreBtn.setAttribute("aria-expanded", "false");
}

function setOpenMode(mode) {
  state.openMode = mode;
  updateOpenModeMenu();
  openModeSelect.value = mode;
  render();
  saveViewPrefs({ openMode: mode });
}

function setToolbarHeight() {
  const linksHeight = Math.max(
    webLinksSection.getBoundingClientRect().height,
    restoreWebLinksBtn.getBoundingClientRect().height
  );
  document.documentElement.style.setProperty("--web-links-h", linksHeight + "px");
  const rect = document.querySelector(".toolbar").getBoundingClientRect();
  const bottom = Math.max(linksHeight, rect.bottom, 0);
  document.documentElement.style.setProperty("--toolbar-h", bottom + "px");
}

const toolbar = document.querySelector(".toolbar");
const pageSwitch = document.getElementById("pageSwitchGroup");
const searchBox = searchInput.closest(".search-box");
function updateToolbarLayout() {
  const styles = getComputedStyle(toolbar);
  const gap = parseFloat(styles.columnGap) || 0;
  const available =
    toolbar.clientWidth -
    (parseFloat(styles.paddingLeft) || 0) -
    (parseFloat(styles.paddingRight) || 0);
  const buttons = [...pageSwitch.children].filter(button => button.getClientRects().length);
  const nav =
    buttons.reduce((sum, button) => sum + button.getBoundingClientRect().width, 0) +
    Math.max(0, buttons.length - 1) * (parseFloat(getComputedStyle(pageSwitch).columnGap) || 0);
  const actions = [viewBtn, iconsBtn, collapseAllBtn, moreBtn].filter(
    button => button.getClientRects().length
  );
  const actionWidth = actions.reduce(
    (sum, button) => sum + button.getBoundingClientRect().width,
    0
  );
  const compact =
    window.innerWidth > 800 &&
    hideToolbarSearch(available, nav, actionWidth, gap * (actions.length + 1));
  toolbar.classList.toggle("compact-search", compact);
  // Never leave an invisible filter active after a resize.
  if ((compact || window.innerWidth <= 800) && searchInput.value) {
    searchInput.value = "";
    searchBox.classList.remove("has-value");
    if (state.page === "dashboard") render();
  }
  if (topMenu.classList.contains("show")) positionTopMenu();
}
function positionTopMenu() {
  topMenu.style.right = "0px";
  const rect = topMenu.getBoundingClientRect();
  topMenu.style.right = menuRightOffset(rect.left, rect.right, window.innerWidth) + "px";
}
window.addEventListener("resize", () => {
  updateToolbarLayout();
  setToolbarHeight();
});
window.addEventListener("scroll", setToolbarHeight, { passive: true });
const headerObserver = new ResizeObserver(setToolbarHeight);
for (const element of [webLinksSection, restoreWebLinksBtn, document.querySelector(".toolbar")])
  headerObserver.observe(element);
const toolbarObserver = new ResizeObserver(updateToolbarLayout);
toolbarObserver.observe(toolbar);
toolbarObserver.observe(pageSwitch);
new MutationObserver(updateToolbarLayout).observe(pageSwitch, { childList: true });

// No settings on a phone: the entry is hidden (components.css, same width),
// and settings left open close when the screen becomes that narrow.
const PHONE = window.matchMedia("(max-width: 700px)");
PHONE.addEventListener("change", event => {
  if (event.matches && modalBackdrop.classList.contains("show")) requestCloseEditor();
});

function openSettings() {
  closeTopMenu();
  if (PHONE.matches) return;
  if ([...themeSelect.options].some(option => option.value === state.theme)) {
    themeSelect.value = state.theme;
  }
  languageSelect.value = state.language;
  openModeSelect.value = state.openMode === "new" ? "new" : "same";
  gridSelects.forEach(select => (select.value = state[select.dataset.gridPref]));
  updateThemeManageUI();
  openEditor();
}

function updateThemeManageUI() {
  const theme = currentTheme();
  const custom = Boolean(theme && !theme.native);
  deleteThemeBtn.disabled = !custom;
  exportThemeBtn.disabled = !theme;
}

moreBtn.addEventListener("click", e => {
  e.stopPropagation();
  const open = topMenu.classList.toggle("show");
  moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionTopMenu();
});

topMenu.addEventListener("click", e => e.stopPropagation());
groupCategoryBtn.addEventListener("click", () => setGroupMode("category"));
groupHostBtn.addEventListener("click", () => setGroupMode("host"));

sortAlphabeticalBtn.addEventListener("click", () => {
  state.sortMode = "alphabetical";
  updateSortModeMenu();
  render();
  saveViewPrefs({ sortMode: "alphabetical" });
  closeTopMenu();
});

sortUsageBtn.addEventListener("click", () => {
  state.sortMode = "usage";
  updateSortModeMenu();
  render();
  saveViewPrefs({ sortMode: "usage" });
  closeTopMenu();
});

viewBtn.addEventListener("click", () => {
  if (state.viewMode === "rows") {
    state.viewMode = "columns";
  } else if (state.viewMode === "columns") {
    state.viewMode = "plain";
  } else {
    state.viewMode = "rows";
  }

  updateViewButton();
  render();
  saveViewPrefs({ viewMode: state.viewMode });
});

collapseAllBtn.addEventListener("click", () => {
  if (state.page === "supervision") {
    toggleAllSmartDetails();
    return;
  }
  const info = getCollapseAllState();
  if (!info.entries.length) return;

  const shouldCollapse = !info.majorityCollapsed;

  info.entries.forEach(entry => {
    state.collapsed[entry.key] = shouldCollapse;
    delete state.collapsed[entry.name];
  });

  render();
  saveViewPrefs({ collapsed: state.collapsed });
});

menuSettingsBtn.addEventListener("click", openSettings);

menuRefreshBtn.addEventListener("click", () => {
  closeTopMenu();
  manualRefresh();
});

menuLogoutBtn.addEventListener("click", async () => {
  closeTopMenu();
  try {
    await fetch("/logout", { method: "POST" });
  } finally {
    window.location.replace("/login");
  }
});

themeSelect.addEventListener("change", () => {
  setTheme(themeSelect.value);
  updateThemeManageUI();
});

languageSelect.addEventListener("change", () => {
  state.language = languageSelect.value === "en" ? "en" : "fr";
  applyLanguage();
  updateViewButton();
  updateIconsButton();
  updateStatusIndicators();
  renderServiceEditor();
  renderCategoryEditor();
  renderDashboardEditor();
  renderHostEditor();
  renderWebLinksEditor();
  renderWidgetsEditor();
  patchConfig({ language: state.language });
});

// This button is the only control of the small icons mode.
iconsBtn.addEventListener("click", () => {
  state.smallIcons = !state.smallIcons;
  render();
  updateIconsButton();
  saveViewPrefs({ smallIcons: state.smallIcons });
});

openModeSelect.addEventListener("change", () => setOpenMode(openModeSelect.value));

// Grid density: a view preference of this browser, applied at once.
const gridSelects = [...document.querySelectorAll("select[data-grid-pref]")];
gridSelects.forEach(select =>
  select.addEventListener("change", () => {
    const key = select.dataset.gridPref;
    state[key] = normalizeGridColumns(select.value);
    saveViewPrefs({ [key]: state[key] });
    render();
    renderSupervision();
  })
);

resetUsageBtn.addEventListener("click", async () => {
  const confirmed = await confirmDanger({
    title: t("resetUsageConfirmTitle"),
    message: t("resetUsageConfirmMessage"),
    confirmLabel: t("resetUsageConfirm")
  });
  if (!confirmed) return;
  state.usageCounts = {};
  render();
  patchConfig({ usageCounts: {} });
});

importThemeBtn.addEventListener("click", () => themeImportInput.click());

themeImportInput.addEventListener("change", async () => {
  const file = themeImportInput.files?.[0];
  themeImportInput.value = "";
  if (!file) return;
  try {
    const theme = await importThemeFile(file);
    themeSelect.value = theme.id;
    applyThemeLabels();
    updateThemeManageUI();
  } catch (error) {
    console.error(error);
    alert("Import du thème impossible.");
  }
});

exportThemeBtn.addEventListener("click", () => {
  const theme = currentTheme();
  if (theme) downloadTheme(theme);
});

deleteThemeBtn.addEventListener("click", async () => {
  const theme = currentTheme();
  if (!theme || theme.native) return;
  if (!confirm(`Supprimer le thème « ${theme.name || theme.id} » ?`)) return;
  try {
    await deleteCustomTheme(theme.id);
    applyThemeLabels();
    updateThemeManageUI();
  } catch (error) {
    console.error(error);
    alert("Suppression du thème impossible.");
  }
});

let renderTimer = null;
searchInput.addEventListener("input", () => {
  searchInput.closest(".search-box").classList.toggle("has-value", searchInput.value.length > 0);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
});

document.addEventListener("click", closeTopMenu);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeTopMenu();
    document.querySelectorAll(".icon-picker.open").forEach(p => p.classList.remove("open"));
    if (imageLibrary.classList.contains("show")) {
      closeImageLibrary();
      return;
    }
    if (document.getElementById("confirmBackdrop").classList.contains("show")) {
      dismissConfirm();
      return;
    }
    if (modalBackdrop.classList.contains("show")) requestCloseEditor();
    return;
  }

  if (
    e.key === "/" &&
    state.page === "dashboard" &&
    searchInput.getClientRects().length &&
    !isTypingTarget(document.activeElement) &&
    !modalBackdrop.classList.contains("show")
  ) {
    e.preventDefault();
    searchInput.focus();
  }
});

async function init() {
  try {
    // The registry MUST be loaded before the config: state normalisation and the
    // first render rely on the widget schemas.
    await Promise.all([loadThemes(), loadWidgetRegistry()]);
    await loadConfig();
    setupVisibilityPause();
    startStatusLoop();
  } finally {
    requestAnimationFrame(() => document.body.classList.add("app-ready"));
  }
}

init();
