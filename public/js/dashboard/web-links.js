// Web links banner above the toolbar: links, their counters, colour, and the
// hide / restore buttons.
import {
  linkCounterValue,
  compactCount,
  webLinksColors,
  WEB_LINK_COLORS,
  normalizeWebLinksColor
} from "../config/normalize.js";
import { state } from "../state.js";
import {
  webLinksSection,
  restoreWebLinksBtn,
  webLinksColorChoices,
  webLinksList,
  hideWebLinksBtn
} from "../dom.js";
import { safeHref } from "./cards.js";
import { sanitizeIconClass } from "../config/sanitize.js";
import { t } from "../i18n.js";
import { patchConfig } from "../api.js";
import { saveViewPrefs } from "../view-prefs.js";

// Number shown in the banner: "(3000)" when the counter is available, nothing
// otherwise. Raw number without thousands separator, to stay compact. The link
// name stays alone until the measurement arrives, rather than show a
// misleading zero.
function linkCounterText(link) {
  if (!link.counter) return "";
  const value = linkCounterValue(link.counter, state.serviceStatus[link.url]);
  return value == null ? "" : `(${compactCount(value)})`;
}

export function updateWebLinkCounters() {
  document.querySelectorAll(".web-link-counter[data-url]").forEach(counter => {
    const link = state.webLinks.find(item => item.url === counter.dataset.url);
    counter.textContent = link ? linkCounterText(link) : "";
  });
}

export function updateWebLinksAppearance() {
  const { background, foreground } = webLinksColors(state.webLinksColor);
  for (const element of [webLinksSection, restoreWebLinksBtn]) {
    element.style.backgroundColor = background;
    element.style.color = foreground;
  }
  for (const choice of webLinksColorChoices.querySelectorAll("[data-color]")) {
    const active = choice.dataset.color === state.webLinksColor;
    choice.style.backgroundColor = WEB_LINK_COLORS[choice.dataset.color] || "transparent";
    choice.classList.toggle("is-active", active);
    choice.setAttribute("aria-checked", String(active));
  }
  webLinksSection.style.display = state.webLinks.length && !state.webLinksHidden ? "flex" : "none";
  restoreWebLinksBtn.hidden = !state.webLinks.length || !state.webLinksHidden;
}

export function renderWebLinks() {
  updateWebLinksAppearance();
  webLinksList.innerHTML = "";

  if (!state.webLinks.length) {
    return;
  }

  state.webLinks.forEach(link => {
    const a = document.createElement("a");
    a.className = "web-link";
    a.href = safeHref(link.url);
    a.target = state.openMode === "new" ? "_blank" : "_self";
    if (state.openMode === "new") a.rel = "noopener noreferrer";
    a.title = link.url || link.name || "";
    a.addEventListener("click", e => e.stopPropagation());

    const icon = document.createElement("span");
    icon.className = "web-link-icon";
    icon.innerHTML = `<i class="${sanitizeIconClass(link.icon)}"></i>`;
    a.appendChild(icon);

    const name = document.createElement("span");
    name.className = "web-link-name";
    name.textContent = link.name || t("unnamedLink");
    a.appendChild(name);

    if (link.counter) {
      const counter = document.createElement("span");
      counter.className = "web-link-counter";
      counter.dataset.url = link.url;
      counter.textContent = linkCounterText(link);
      a.appendChild(counter);
    }

    webLinksList.appendChild(a);
  });
}

webLinksColorChoices.addEventListener("click", event => {
  const choice = event.target.closest("[data-color]");
  if (!choice) return;
  state.webLinksColor = normalizeWebLinksColor(choice.dataset.color);
  updateWebLinksAppearance();
  patchConfig({ webLinksColor: state.webLinksColor });
});

hideWebLinksBtn.addEventListener("click", () => {
  state.webLinksHidden = true;
  saveViewPrefs({ webLinksHidden: true });
  updateWebLinksAppearance();
  restoreWebLinksBtn.focus();
});

restoreWebLinksBtn.addEventListener("click", () => {
  state.webLinksHidden = false;
  saveViewPrefs({ webLinksHidden: false });
  updateWebLinksAppearance();
  hideWebLinksBtn.focus();
});
