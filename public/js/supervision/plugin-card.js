// Card of a supervision plugin (supervisions/<id>/, docs/EXTENDING.md).
//
// The plugin's client module turns its report into a descriptor, bounded by
// cardView() (plugin-view.js, no DOM); this module draws the card with the
// same frame, health line, colours and expand behaviour as the built-in cards.
// The plugin never touches the DOM, unless it exports element(ctx) for a fully
// custom body: the frame stays the core's.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { element } from "../element.js";
import { formatters } from "../format.js";
import { relativeAge, reportDateText } from "./format.js";
import { pluginLabel, pluginString } from "../supervision-registry.js";
import { LEVELS, cardView } from "./plugin-view.js";

function rowList(list, className) {
  const box = element("div", className);
  for (const row of list) {
    const line = element("div");
    const value = element("span", row.tone ? "is-" + row.tone : "", row.value);
    line.append(element("span", "", row.label), value);
    box.appendChild(line);
  }
  return box;
}

function body(card, view) {
  if (view.status || view.summary) {
    const health = element("div", "supervision-health");
    const state = element("span", "supervision-health-state");
    const level = LEVELS[view.status || "unknown"];
    const icon = element("i", level.icon);
    icon.setAttribute("aria-hidden", "true");
    state.append(icon, element("strong", "", view.summary));
    health.appendChild(state);
    card.classList.add("is-" + level.level);
    card.appendChild(health);
  }
  if (view.value) {
    const summary = element("div", "supervision-plugin-value");
    summary.append(element("strong", "", view.value));
    if (view.unit) summary.append(element("span", "", view.unit));
    card.appendChild(summary);
  }
  if (view.rows.length) card.appendChild(rowList(view.rows, "supervision-plugin-rows"));
  if (view.note) card.appendChild(element("p", "supervision-plugin-note", view.note));
  if (view.details.length) card.appendChild(rowList(view.details, "supervision-plugin-details"));
}

function makeExpandable(card, key) {
  card.dataset.pluginKey = key;
  card.classList.add("has-details");
  const expanded = isExpanded("supervisionPluginExpanded", key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded("supervisionPluginExpanded", key, open);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
}

// Context given to the plugin's card(ctx) / element(ctx).
export function cardContext(meta, report, host, lang) {
  const fmt = formatters(lang);
  return {
    report,
    host: { id: host.id || "", name: host.name || "" },
    lang,
    t: key => pluginString(meta, key, lang),
    formatDateTime: fmt.formatDateTime,
    formatNumber: fmt.formatNumber,
    formatCompactNumber: fmt.formatCompactNumber,
    // Seconds since the epoch -> "3 min ago" / readable date.
    relativeAge: seconds => relativeAge(Date.now() / 1000 - Number(seconds)),
    reportDate: reportDateText
  };
}

// The card element, or null when the plugin has nothing to draw or fails:
// a broken plugin only loses its own card.
export function pluginCard(host, meta, module, report, lang) {
  const ctx = cardContext(meta, report, host, lang);
  let custom = null;
  let view = null;
  try {
    if (typeof module.element === "function") custom = module.element(ctx);
    else view = cardView(module.card(ctx));
  } catch (error) {
    console.error("Supervision card rendering failed:", meta.id, error);
    return null;
  }
  if (custom && !(typeof Node !== "undefined" && custom instanceof Node)) custom = null;
  if (!custom && !view) return null;

  const card = element("article", "supervision-card supervision-card-plugin");
  card.classList.add("supervision-card-plugin-" + meta.id);
  applyHostColor(card, host);
  const head = element("div", "supervision-head");
  const icon = element("i", meta.icon || "fa-solid fa-puzzle-piece");
  icon.setAttribute("aria-hidden", "true");
  head.append(icon, element("span", "supervision-name", pluginLabel(meta, lang)));
  card.appendChild(head);

  if (custom) {
    card.appendChild(custom);
    return card;
  }
  body(card, view);
  if (view.details.length) {
    const chevron = element("i", "fa-solid fa-chevron-down supervision-smart-chevron");
    chevron.setAttribute("aria-hidden", "true");
    head.appendChild(chevron);
    makeExpandable(card, JSON.stringify([...JSON.parse(cardKey(host)), meta.id]));
  }
  return card;
}
