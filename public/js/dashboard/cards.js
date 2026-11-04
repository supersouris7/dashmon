// Dashboard tiles: service cards (icon, title, status pill, widget).
import { t } from "../i18n.js";
import { state, FALLBACK_HOST, getCategory, serviceUsageKey } from "../state.js";
import { effectiveStatus, statusIcon } from "../status.js";
import { renderWidget, hasWidget, widgetStatusKey } from "../widget-registry.js";
import { sanitizeTileColor } from "../config/sanitize.js";
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
