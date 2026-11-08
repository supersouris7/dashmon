// Entry point: start-up, main menu, dialogs (editor, appearance) and global
// events.
import { state } from "./state.js";
import { normalizeConfig, normalizeViewPrefs, normalizeGridColumns } from "./config/normalize.js";
import { isTypingTarget } from "./util.js";
import { patchConfig, saveConfig, setConfigRevision } from "./api.js";
import { withDemo } from "./config/demo.js";
import { loadViewPrefs, pickViewPrefs, saveViewPrefs } from "./view-prefs.js";
import {
  render,
  getCollapseAllState,
  updateCollapseAllButton,
  updateStatusIndicators,
  setWelcomeActions
} from "./render.js";
import {
  updateViewButton,
  updateIconsButton,
  updateOpenModeMenu,
  updateGroupModeMenu,
  updateSortModeMenu,
  setGroupMode
} from "./dashboard/view-controls.js";
import { t, resolveLanguage } from "./i18n.js";
import {
  applyLanguage,
  setThemeLabelsUpdater,
  setCollapseButtonUpdater,
  setSupervisionUpdater,
  setPageSwitchUpdater
} from "./language-ui.js";
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
import { openEditor, requestCloseEditor, dismissConfirm } from "./editor.js";
import { confirmDanger } from "./editor/confirm.js";
import { renderHostEditor } from "./editor/hosts.js";
import { renderDashboardEditor } from "./editor/dashboards.js";
import { renderCategoryEditor } from "./editor/categories.js";
import { renderWebLinksEditor } from "./editor/web-links.js";
import { renderServiceEditor } from "./editor/services.js";
import { closeImageLibrary } from "./images.js";
import { loadWidgetRegistry } from "./widget-registry.js";
import { menuRightOffset } from "./toolbar.js";
import { updateFortuneBar, showFortuneAgain } from "./dashboard/fortune-bar.js";
import {
  searchInput,
  searchBtn,
  searchClearBtn,
  dashboard,
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
  fortuneSelect,
  languageSelect,
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
    state.fortune = cfg.fortune;
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
    state.supervisionDirectoryExpanded = viewPrefs.supervisionDirectoryExpanded;
    state.supervisionAptExpanded = viewPrefs.supervisionAptExpanded;
    state.supervisionOpencodeExpanded = viewPrefs.supervisionOpencodeExpanded;
    state.supervisionClaudeExpanded = viewPrefs.supervisionClaudeExpanded;
    state.supervisionSpeedtestExpanded = viewPrefs.supervisionSpeedtestExpanded;
    state.categoryColumns = viewPrefs.categoryColumns;
    state.tileColumns = viewPrefs.tileColumns;
    state.supervisionColumns = viewPrefs.supervisionColumns;
    // The active dashboard comes from the preference, bounded to the config's
    // list: a preference whose dashboard was deleted falls back to the first one.
    state.dashboardId = cfg.dashboards.some(d => d.id === viewPrefs.dashboardId)
      ? viewPrefs.dashboardId
      : cfg.dashboards[0]?.id || state.dashboardId;
    state.theme = cfg.theme;
    state.languageSetting = cfg.language;
    state.language = resolveLanguage(cfg.language);
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
  const rect = document.querySelector(".toolbar").getBoundingClientRect();
  const bottom = Math.max(rect.bottom, 0);
  document.documentElement.style.setProperty("--toolbar-h", bottom + "px");
}

const toolbar = document.querySelector(".toolbar");
const searchBox = document.getElementById("searchBox");
// The search is a magnifier button at the head of the actions: it opens a line
// of its own under the toolbar, at full width. Closing it clears the filter, so
// no tile stays hidden by a search that can no longer be seen.
function setSearchOpen(open) {
  searchBox.hidden = !open;
  searchBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    searchInput.focus();
    return;
  }
  if (searchBox.contains(document.activeElement)) searchBtn.focus();
  if (searchInput.value) {
    clearTimeout(renderTimer);
    searchInput.value = "";
    searchBox.classList.remove("has-value");
    render();
  }
}
searchBtn.addEventListener("click", () => setSearchOpen(searchBox.hidden));
function updateToolbarLayout() {
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
headerObserver.observe(document.querySelector(".toolbar"));
const toolbarObserver = new ResizeObserver(updateToolbarLayout);
toolbarObserver.observe(toolbar);

// No settings on a phone: the entry is hidden (settings-tools.css, same width),
// and settings left open close when the screen becomes that narrow.
const PHONE = window.matchMedia("(max-width: 599px)");
PHONE.addEventListener("change", event => {
  if (event.matches && modalBackdrop.classList.contains("show")) requestCloseEditor();
});

function openSettings() {
  closeTopMenu();
  if (PHONE.matches) return;
  if ([...themeSelect.options].some(option => option.value === state.theme)) {
    themeSelect.value = state.theme;
  }
  languageSelect.value = state.languageSetting;
  fortuneSelect.value = state.fortune ? "on" : "off";
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

// Welcome of an empty dashboard: the example is added and saved at once, there
// is nothing to overwrite.
setWelcomeActions({
  openSettings,
  loadDemo() {
    Object.assign(state, withDemo(state, state.language));
    render();
    saveConfig(true);
  }
});

menuRefreshBtn.addEventListener("click", () => {
  closeTopMenu();
  showFortuneAgain();
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

// Fortune Cookie bar: a shared setting, applied at once like the theme.
fortuneSelect.addEventListener("change", () => {
  state.fortune = fortuneSelect.value === "on";
  updateFortuneBar();
  patchConfig({ fortune: state.fortune });
});

languageSelect.addEventListener("change", () => {
  state.languageSetting = ["fr", "en"].includes(languageSelect.value) ? languageSelect.value : "";
  state.language = resolveLanguage(state.languageSetting);
  applyLanguage();
  updateViewButton();
  updateIconsButton();
  updateStatusIndicators();
  renderServiceEditor();
  renderCategoryEditor();
  renderDashboardEditor();
  renderHostEditor();
  renderWebLinksEditor();
  updateFortuneBar();
  patchConfig({ language: state.languageSetting });
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
  searchBox.classList.toggle("has-value", searchInput.value.length > 0);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
});
searchClearBtn.addEventListener("click", () => {
  clearTimeout(renderTimer);
  searchInput.value = "";
  searchBox.classList.remove("has-value");
  render();
  searchInput.focus();
});
// Enter opens the service when the search leaves only one.
searchInput.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing || !searchInput.value.trim()) return;
  event.preventDefault();
  clearTimeout(renderTimer);
  render();
  const cards = dashboard.querySelectorAll("a.card");
  if (cards.length === 1 && cards[0].getAttribute("href") !== "#") cards[0].click();
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

  const shortcut =
    (e.key === "/" && !isTypingTarget(document.activeElement)) ||
    (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey);
  if (shortcut && state.page === "dashboard" && !modalBackdrop.classList.contains("show")) {
    e.preventDefault();
    setSearchOpen(true);
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
