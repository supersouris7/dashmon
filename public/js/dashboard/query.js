// What the dashboard shows depends on the search box and the grouping mode:
// both are read here, by the renderer and by the sections it builds.
import { state, FALLBACK_HOST } from "../state.js";
import { foldText } from "../util.js";
import { t } from "../i18n.js";
import { searchInput } from "../dom.js";

export function searchQuery() {
  return foldText(searchInput.value);
}

export function groupLabel(name) {
  return state.groupMode === "host" && name === FALLBACK_HOST ? t("noHost") : name;
}
