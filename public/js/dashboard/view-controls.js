// State of the toolbar and menu buttons: view mode, icon size, open mode,
// grouping and sorting.
import {
  viewBtn,
  iconsBtn,
  openModeSelect,
  groupCategoryBtn,
  groupHostBtn,
  sortAlphabeticalBtn,
  sortUsageBtn
} from "../dom.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { render } from "../render.js";
import { saveViewPrefs } from "../view-prefs.js";

export function updateViewButton() {
  const icon = viewBtn.querySelector("i");

  if (state.viewMode === "rows") {
    icon.className = "fa-solid fa-bars";
    viewBtn.title = t("viewRows");
  } else if (state.viewMode === "columns") {
    icon.className = "fa-solid fa-table-columns";
    viewBtn.title = t("viewColumns");
  } else {
    icon.className = "fa-solid fa-border-all";
    viewBtn.title = t("viewPlain");
  }
}

// This button sets the icon size. Its label states the current size and its
// glyph shows the action, like the view button: arrows point in when icons
// shrink and out when they grow.
export function updateIconsButton() {
  const icon = iconsBtn.querySelector("i");
  const label = state.smallIcons ? t("smallIconsOptionOn") : t("smallIconsOptionOff");
  icon.className = state.smallIcons
    ? "fa-solid fa-down-left-and-up-right-to-center"
    : "fa-solid fa-expand-alt";
  iconsBtn.title = label;
  iconsBtn.setAttribute("aria-label", label);
  iconsBtn.setAttribute("aria-pressed", state.smallIcons ? "true" : "false");
}

export function updateOpenModeMenu() {
  openModeSelect.value = state.openMode === "new" ? "new" : "same";
}

export function updateGroupModeMenu() {
  groupCategoryBtn.classList.toggle("active", state.groupMode === "category");
  groupHostBtn.classList.toggle("active", state.groupMode === "host");
}

export function updateSortModeMenu() {
  sortAlphabeticalBtn.classList.toggle("active", state.sortMode === "alphabetical");
  sortUsageBtn.classList.toggle("active", state.sortMode === "usage");
}

export function setGroupMode(mode) {
  state.groupMode = mode === "host" ? "host" : "category";
  updateGroupModeMenu();
  render();
  saveViewPrefs({ groupMode: state.groupMode });
}
