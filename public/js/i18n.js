// fr/en UI translations with injection hooks for dependent modules.
import { state } from "./state.js";
import fr from "./i18n/fr.json" with { type: "json" };
import en from "./i18n/en.json" with { type: "json" };
import {
  menuEditBtn,
  menuSupervisionBtn,
  menuAppearanceBtn,
  appearanceTitle,
  themeFieldLabel,
  languageFieldLabel,
  usageFieldLabel,
  resetUsageBtn,
  appearanceDoneBtn,
  appearanceCloseBtn,
  searchInput,
  topMenu,
  modalBackdrop,
  groupCategoryBtn,
  groupHostBtn,
  sortMenuLabel,
  sortAlphabeticalBtn,
  sortUsageBtn,
  editorTitle,
  closeBtn,
  editorSearch,
  cancelBtn,
  saveBtn,
  imageLibraryTitle,
  widgetConfigTitle,
  closeImageLibraryBtn,
  menuRefreshBtn,
  menuLogoutBtn,
  hideWebLinksBtn,
  restoreWebLinksBtn
} from "./dom.js";

// Interface texts, one JSON file per language: easy to read, complete or
// translate without touching code. Both files must have the same keys
// (checked by test/frontend.test.js); a missing text falls back to French,
// then to the key itself.
const UI_TEXT = { fr, en };

export function t(key) {
  return UI_TEXT[state.language]?.[key] || UI_TEXT.fr[key] || key;
}

export function applyLanguage() {
  document.documentElement.lang = state.language;

  const editLabel = menuEditBtn.querySelector("span:nth-child(2)");
  if (editLabel) editLabel.textContent = t("editDashboard");

  const supervisionLabel = menuSupervisionBtn.querySelector("span:nth-child(2)");
  if (supervisionLabel) supervisionLabel.textContent = t("menuSupervision");

  const appearanceLabel = menuAppearanceBtn.querySelector("span:nth-child(2)");
  if (appearanceLabel) appearanceLabel.textContent = t("editTheme");

  const refreshLabel = menuRefreshBtn.querySelector("span:nth-child(2)");
  if (refreshLabel) refreshLabel.textContent = t("menuRefresh");

  const logoutLabel = menuLogoutBtn.querySelector("span:nth-child(2)");
  if (logoutLabel) logoutLabel.textContent = t("logout");

  appearanceTitle.textContent = t("editTheme");
  themeFieldLabel.textContent = t("theme");
  languageFieldLabel.textContent = t("language");
  usageFieldLabel.textContent = t("usageLabel");
  resetUsageBtn.querySelector("span").textContent = t("resetUsage");
  appearanceDoneBtn.textContent = t("close");
  appearanceCloseBtn.title = t("close");
  searchInput.placeholder = t("search");
  for (const [button, key] of [
    [hideWebLinksBtn, "hideWebLinks"],
    [restoreWebLinksBtn, "restoreWebLinks"]
  ]) {
    button.title = t(key);
    button.setAttribute("aria-label", t(key));
  }
  document.getElementById("supportLabel").textContent = t("support");

  const labels = [...topMenu.querySelectorAll(".top-menu-label")];
  if (labels[0]) labels[0].textContent = t("groupBy");

  const menuSpans = [
    [groupCategoryBtn, "category"],
    [groupHostBtn, "host"],
    [sortAlphabeticalBtn, "alphabetical"],
    [sortUsageBtn, "usage"]
  ];
  menuSpans.forEach(([btn, key]) => {
    const span = btn.querySelector("span");
    if (span) span.textContent = t(key);
  });

  sortMenuLabel.textContent = t("sort");

  if (collapseButtonUpdater) {
    collapseButtonUpdater();
  }

  editorTitle.textContent = t(
    modalBackdrop.dataset.mode === "supervision" ? "editSupervisionTitle" : "editDashboardTitle"
  );
  closeBtn.title = t("close");
  editorSearch.placeholder = t("searchEditor");

  const editorLabels = [
    ["editorTabApplications", "tabApplications"],
    ["editorTabCategories", "tabCategories"],
    ["editorTabDashboards", "tabDashboards"],
    ["editorTabHosts", "tabHosts"],
    ["editorTabPairing", "tabPairing"],
    ["editorTabWireguard", "tabWireguard"],
    ["editorTabSmart", "tabSmart"],
    ["editorTabAptUpdates", "tabAptUpdates"],
    ["editorTabWebLinks", "tabWebLinks"],
    ["editorTabWidgets", "tabWidgets"],
    ["editorTabImages", "tabImages"],
    ["editorTabImportExport", "tabImportExport"],
    ["addServiceLabel", "addApplication"],
    ["addCategoryLabel", "addCategory"],
    ["addDashboardLabel", "addDashboard"],
    ["addHostLabel", "addHost"],
    ["addWebLinkLabel", "addWebLink"],
    ["importConfigLabel", "importBtn"],
    ["exportConfigLabel", "exportBtn"],
    ["uploadPngLabel", "importBtn"],
    ["manageUploadLabel", "addImages"],
    ["manageDeleteLabel", "deleteSelection"],
    ["widgetConfigSaveLabel", "widgetConfigSaveLabel"]
  ];
  editorLabels.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  });

  document.getElementById("manageUploadHint").textContent = t("pngOnlyHint");
  document.getElementById("uploadPngHint").textContent = t("pngOnlyHint");
  document.getElementById("importExportHint").textContent = t("importExportHint");

  cancelBtn.textContent = t("cancelBtn");
  saveBtn.textContent = t("saveBtn");
  imageLibraryTitle.textContent = t("imageLibraryTitle");
  widgetConfigTitle.textContent = t("widgetConfigTitle");
  closeImageLibraryBtn.title = t("close");

  const manageLabels = [
    ["themeManageLabel", "manageThemes"],
    ["importThemeBtnLabel", "importBtn"],
    ["exportThemeBtnLabel", "exportBtn"],
    ["deleteThemeBtnLabel", "deleteLabel"]
  ];
  manageLabels.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  });

  const appearanceLabels = [
    ["openModeFieldLabel", "openModeFieldLabel"],
    ["openModeOptionSame", "sameTab"],
    ["openModeOptionNew", "newTab"],
    ["webLinksColorLabel", "webLinksColorLabel"]
  ];
  appearanceLabels.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  });

  // Colours are chosen as swatches: the name is a label, not visible text.
  ["Dark", "Red", "Blue", "Green", "Orange", "Purple"].forEach(name => {
    const el = document.getElementById("webLinksColor" + name);
    if (!el) return;
    const label = t("webLinksColor" + name);
    el.title = label;
    el.setAttribute("aria-label", label);
  });

  const pageSwitch = document.getElementById("pageSwitchGroup");
  if (pageSwitch) pageSwitch.setAttribute("aria-label", t("pageSwitch"));

  if (applyThemeLabels) {
    applyThemeLabels();
  }
  if (supervisionUpdater) {
    supervisionUpdater();
  }
  if (pageSwitchUpdater) {
    pageSwitchUpdater();
  }
}

let applyThemeLabels = null;

export function setThemeLabelsUpdater(fn) {
  applyThemeLabels = fn;
}

let supervisionUpdater = null;

export function setSupervisionUpdater(fn) {
  supervisionUpdater = fn;
}

let pageSwitchUpdater = null;

export function setPageSwitchUpdater(fn) {
  pageSwitchUpdater = fn;
}

let collapseButtonUpdater = null;

export function setCollapseButtonUpdater(fn) {
  collapseButtonUpdater = fn;
}
