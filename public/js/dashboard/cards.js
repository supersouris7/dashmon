// Dashboard tiles: service cards (icon, title, status pill, widget) and the
// fortune tile.
import { t } from "../i18n.js";
import { state, FALLBACK_HOST, getCategory, serviceUsageKey } from "../state.js";
import { effectiveStatus, statusIcon } from "../status.js";
import { renderWidget, hasWidget, widgetStatusKey } from "../widget-registry.js";
import { sanitizeTileColor } from "../config/sanitize.js";
import { fortuneText, loadFortunes, pickFortune } from "../fortune.js";
import { bumpUsage } from "../api.js";

export function safeHref(url) {
  return /^https?:\/\//.test(url) ? url : "#";
}

export function statusTitle(monitor, info) {
  if (!info) return t("statusPending");
  const state = effectiveStatus(monitor, info);
  if (state === "up") return `${t("statusUp")} · ${info.ms} ms`;
  if (state === "soft") return `${t("statusSoftDown")} · ${info.error || t("statusNoResponse")}`;
  return `${t("statusDown")} · ${info.error || t("statusNoResponse")}`;
}

// Widget part of a tile: the work is done by the widget renderer
// (widgets/<id>/client.mjs), loaded dynamically by the registry. No special
// case here: adding a widget never edits this file.
export function applyWidgetStatus(wrap, service, info) {
  const view = renderWidget(service, info, state.language);
  if (view.element) {
    // Custom rendering: the widget provides its own DOM node.
    wrap.replaceChildren(view.element);
    wrap.title = view.title || "";
    return;
  }
  const badge = wrap.querySelector(".widget-badge");
  const time = wrap.querySelector(".widget-time");
  if (!badge || !time) return;
  badge.className = "widget-badge" + (view.badgeClass ? " " + view.badgeClass : "");
  badge.textContent = view.badge || "—";
  if (view.icon) {
    // The word goes in its own span: narrow tiles hide it and keep the icon
    // (components.css), so the application name keeps its room.
    const text = document.createElement("span");
    text.className = "widget-badge-text";
    text.textContent = badge.textContent;
    badge.replaceChildren(text);
    const icon = document.createElement("i");
    icon.className = view.icon;
    icon.setAttribute("aria-hidden", "true");
    badge.prepend(icon);
  }
  time.className = "widget-time" + (view.timeClass ? " " + view.timeClass : "");
  time.textContent = view.time || "";
  wrap.title = view.title || "";
}

// Tile colour in the flat view: there is no section to inherit from. The rule
// stays the one of the active mode (host colour when grouping by host,
// category colour otherwise) so switching modes keeps the colours.
export function tileColorFor(service) {
  const name = (service && ((service.host || "").trim() || FALLBACK_HOST)) || "";
  const target =
    state.groupMode === "host"
      ? state.hosts.find(host => host.name === name)
      : getCategory((service && service.category) || "");
  return sanitizeTileColor((target || {}).color);
}

// Tile icon: PNG from the library, or a cube when the image is missing.
export function appendTileIcon(card, service) {
  if (!service.icon) {
    const fallback = document.createElement("div");
    fallback.className = "service-fallback";
    fallback.innerHTML = '<i class="fa-solid fa-cube"></i>';
    card.appendChild(fallback);
    return;
  }
  const icon = document.createElement("img");
  icon.className = "fortune-icon";
  icon.src = service.icon;
  icon.alt = "";
  icon.onerror = () => {
    icon.remove();
    const fallback = document.createElement("div");
    fallback.className = "service-fallback";
    fallback.innerHTML = '<i class="fa-solid fa-cube"></i>';
    card.prepend(fallback);
  };
  card.appendChild(icon);
}

// Fortune tile: no title, no pill, no link. The icon and the quote of the day
// are enough; a click draws another quote for the day. "key" is the stable
// identity of the tile (here the special type).
export function createFortuneCard(key) {
  const card = document.createElement("div");
  card.className = "card fortune";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.title = t("fortuneHint");

  // Same treatment as a service icon: `.service-icon` without background or
  // border, unlike `.service-fallback`, which frames a glyph.
  const icon = document.createElement("img");
  icon.className = "service-icon";
  icon.src = "images/fortunecookie.png";
  icon.alt = "Fortune Cookie";
  icon.onerror = () => {
    icon.remove();
    const fallback = document.createElement("div");
    fallback.className = "service-fallback";
    fallback.innerHTML = '<i class="fa-solid fa-cookie-bite"></i>';
    card.prepend(fallback);
  };
  card.appendChild(icon);

  const text = document.createElement("div");
  text.className = "fortune-text";
  card.appendChild(text);

  const paint = () => {
    text.textContent = fortuneText(key, state.language);
  };
  paint();

  // The quotes load asynchronously: on the first render the list may be empty,
  // and the tile fills itself as soon as the file arrives.
  loadFortunes().then(() => {
    if (card.isConnected) paint();
  });

  const confetti = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const colors = ["#ff8a1f", "#ff4d6d", "#3cf59b", "#6d8ed1", "#d76cff"];
    for (let index = 0; index < 28; index++) {
      const particle = document.createElement("i");
      particle.className = "fortune-confetti";
      particle.style.left = `${18 + Math.round(Math.random() * 64)}%`;
      particle.style.top = `${18 + Math.round(Math.random() * 62)}%`;
      particle.style.setProperty("--x", `${Math.round((Math.random() - 0.5) * 460)}px`);
      particle.style.setProperty("--y", `${Math.round((Math.random() - 0.45) * 300)}px`);
      particle.style.setProperty("--r", `${Math.round((Math.random() - 0.5) * 540)}deg`);
      particle.style.setProperty("--size", `${8 + Math.round(Math.random() * 6)}px`);
      particle.style.background = colors[index % colors.length];
      particle.style.color = colors[index % colors.length];
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
      card.appendChild(particle);
    }
  };

  const next = event => {
    if (event) event.preventDefault();
    text.textContent = pickFortune(key, state.language);
    confetti();
  };
  card.addEventListener("click", next);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    next(event);
  });

  return card;
}

export function createCard(service) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = safeHref(service.url);
  if (!service.url) {
    card.addEventListener("click", e => e.preventDefault());
  } else {
    card.addEventListener("click", () => bumpUsage(serviceUsageKey(service)));
  }
  if (state.openMode === "new") {
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  }

  appendTileIcon(card, service);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = service.name || t("unnamedService");
  card.appendChild(title);

  // The widget-<id> class stays: it carries the widget's CSS specifics (e.g.
  // Docker's bold second line) without the core knowing the widget.
  if (service.widget && hasWidget(service.widget.type)) {
    const wrap = document.createElement("div");
    wrap.className = `widget-status widget-${service.widget.type}`;
    wrap.dataset.url = widgetStatusKey(service);
    wrap._service = service;
    const badge = document.createElement("span");
    badge.className = "widget-badge pending";
    const time = document.createElement("span");
    time.className = "widget-time";
    wrap.append(badge, time);
    applyWidgetStatus(wrap, service, state.serviceStatus[wrap.dataset.url]);
    card.appendChild(wrap);
  } else if (service.monitor !== false && service.url) {
    const status = document.createElement("span");
    const serviceState = effectiveStatus(service.monitor, state.serviceStatus[service.url]);
    status.className = `service-status ${serviceState}`;
    status.dataset.url = service.url;
    if (service.monitor === "soft") status.dataset.soft = "1";
    status.title = statusTitle(service.monitor, state.serviceStatus[service.url]);
    const icon = document.createElement("i");
    icon.className = statusIcon(serviceState);
    status.appendChild(icon);
    card.appendChild(status);
  }

  return card;
}
