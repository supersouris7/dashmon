// Behaviour shared by the supervision cards: expanded state (a view
// preference saved at once), expand / collapse all, host colour.
import { selectedSupervisionInstanceId } from "../supervision.js";
import { state } from "../state.js";
import { saveViewPrefs } from "../view-prefs.js";
import { supervisionList, collapseAllBtn } from "../dom.js";
import { t } from "../i18n.js";
import { sanitizeTileColor } from "../config/sanitize.js";

export const EXPANDABLE_CARDS =
  ".supervision-card-smart,.supervision-card-host.has-details,.supervision-card-apt.has-details";

// A card is identified by instance and host: the same machine seen from the
// main dashboard and from an agent keeps two separate states.
export function cardKey(host) {
  return JSON.stringify([selectedSupervisionInstanceId(), host.id || ""]);
}

export function isExpanded(field, key) {
  return Array.isArray(state[field]) && state[field].includes(key);
}

// Saved at once: expanding a card does not wait for the settings Save button,
// since it is a preference of this screen, not configuration.
export function setExpanded(field, key, expanded) {
  const keys = new Set(Array.isArray(state[field]) ? state[field] : []);
  if (expanded) keys.add(key);
  else keys.delete(key);
  state[field] = [...keys].slice(0, 200);
  saveViewPrefs({ [field]: state[field] });
}

export function setAllSmartDetails(expanded) {
  // The visible keys of each type are collected in one pass, then the
  // preferences are written once: no localStorage write per card. Cards of other
  // instances are left untouched.
  const fields = {
    supervisionSmartExpanded: [],
    supervisionHostExpanded: [],
    supervisionAptExpanded: []
  };
  supervisionList.querySelectorAll(EXPANDABLE_CARDS).forEach(card => {
    card.classList.toggle("expanded", expanded);
    card.setAttribute("aria-expanded", String(expanded));
    if (card.dataset.smartKey) fields.supervisionSmartExpanded.push(card.dataset.smartKey);
    if (card.dataset.hostKey) fields.supervisionHostExpanded.push(card.dataset.hostKey);
    if (card.dataset.aptKey) fields.supervisionAptExpanded.push(card.dataset.aptKey);
  });
  for (const [field, keys] of Object.entries(fields)) {
    const merged = new Set(Array.isArray(state[field]) ? state[field] : []);
    for (const key of keys) {
      if (expanded) merged.add(key);
      else merged.delete(key);
    }
    state[field] = [...merged].slice(0, 200);
  }
  saveViewPrefs({
    supervisionSmartExpanded: state.supervisionSmartExpanded,
    supervisionHostExpanded: state.supervisionHostExpanded,
    supervisionAptExpanded: state.supervisionAptExpanded
  });
}

export function updateSmartCollapseButton() {
  if (state.page !== "supervision") return;
  const cards = [...supervisionList.querySelectorAll(EXPANDABLE_CARDS)];
  const expanded = cards.filter(card => card.classList.contains("expanded")).length;
  const collapsed = cards.length - expanded;
  const actionExpand = collapsed > expanded;
  collapseAllBtn.disabled = !cards.length;
  collapseAllBtn.title = actionExpand ? t("expandAll") : t("collapseAll");
  collapseAllBtn.setAttribute("aria-label", collapseAllBtn.title);
  collapseAllBtn.innerHTML = actionExpand
    ? '<i class="fa-solid fa-angles-down"></i>'
    : '<i class="fa-solid fa-angles-up"></i>';
}

export function toggleAllSmartDetails() {
  const cards = [...supervisionList.querySelectorAll(EXPANDABLE_CARDS)];
  if (!cards.length) return;
  const expanded = cards.filter(card => card.classList.contains("expanded")).length;
  setAllSmartDetails(cards.length - expanded > expanded);
  updateSmartCollapseButton();
}

export function applyHostColor(card, host) {
  const color = sanitizeTileColor(host && host.color);
  if (!color) return;
  card.classList.add("tinted");
  card.style.setProperty("--tile-color", color);
}
