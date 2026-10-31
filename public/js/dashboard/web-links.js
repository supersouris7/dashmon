// Web links banner under the toolbar, styled like a tile: links and their
// counters. It cannot be closed from the banner; Settings > Appearance turns
// it on or off for this browser.
import { linkCounterValue, compactCount } from "../config/normalize.js";
import { state } from "../state.js";
import { webLinksSection, webLinksList, webLinksEnabledSelect } from "../dom.js";
import { safeHref } from "./cards.js";
import { sanitizeIconClass } from "../config/sanitize.js";
import { t } from "../i18n.js";
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
  webLinksSection.style.display = state.webLinks.length && !state.webLinksHidden ? "flex" : "none";
  webLinksEnabledSelect.value = state.webLinksHidden ? "off" : "on";
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

webLinksEnabledSelect.addEventListener("change", () => {
  state.webLinksHidden = webLinksEnabledSelect.value === "off";
  saveViewPrefs({ webLinksHidden: state.webLinksHidden });
  updateWebLinksAppearance();
});
