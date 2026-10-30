// Widget registry, browser side.
//
// The browser knows no widget by name: it fetches the list published by the
// server (GET /api/widgets), then dynamically loads each widget's renderer
// (GET /widget-client/<id>.js). Adding a widget to Dashmon never requires
// changing render.js, editor.js or state.js.
//
// Three guarantees:
//   1. resilience: a missing or failing widget never breaks the dashboard;
//   2. security: the client module has no access to the server config or to
//      secrets; it only receives the status computed by the widget's server.js;
//   3. declarative schema: the config shape comes from the manifest published
//      by the server; this module only interprets that metadata.

import fr from "./i18n/fr.json" with { type: "json" };
import en from "./i18n/en.json" with { type: "json" };
import { formatters } from "./format.js";

// Prefix of the secrets stored by the server, encrypted or masked (never
// re-encrypted here).
const SECRET_PREFIX = "aes1.";

const metas = new Map();
const renderers = new Map();
let loaded = false;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value, max) {
  const limit = Number(max) > 0 ? Number(max) : 200;
  return String(value == null ? "" : value)
    .trim()
    .slice(0, limit);
}

// --- Loading ---------------------------------------------------------------

// Loads the registry and the renderers. Never throws: on failure it goes on
// with an empty registry (existing widgets then show as "unavailable" rather
// than breaking the whole dashboard).
export async function loadWidgetRegistry() {
  loaded = true;
  let list = [];
  try {
    const response = await fetch("/api/widgets", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    list = await response.json();
  } catch (error) {
    console.error("Registre des widgets indisponible", error);
    return [];
  }
  if (!Array.isArray(list)) return [];

  const styles = [];
  const loads = list
    .map(meta => {
      if (!meta || !meta.id) return null;
      metas.set(meta.id, meta);
      if (meta.hasCss) styles.push({ id: meta.id, version: meta.version || "" });
      return import(
        "/widget-client/" +
          encodeURIComponent(meta.id) +
          ".js?v=" +
          encodeURIComponent(meta.version || "")
      )
        .then(module => {
          // The manifest version is part of the URL: without it the URL stays the same
          // after a widget update and the browser may serve the old code for as long as
          // it is cached. A fixed widget must show at once, so a new version means a new
          // URL.
          if (typeof module.render === "function" || typeof module.element === "function") {
            renderers.set(meta.id, module);
          }
        })
        .catch(error => {
          // Widget without renderer, or failing module: the config stays editable, only
          // the tile display stays neutral.
          console.warn("Widget renderer unavailable:", meta.id, error);
        });
    })
    .filter(Boolean);
  await Promise.all(loads);
  injectStyles(styles);
  return [...metas.keys()];
}

function injectStyles(entries) {
  if (typeof document === "undefined" || !entries.length) return;
  const present = new Set(
    [...document.querySelectorAll("link[data-widget-style]")].map(link => link.dataset.widgetStyle)
  );
  for (const entry of entries) {
    const id = entry.id;
    if (present.has(id)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.widgetStyle = id;
    // Same cache busting as for the module: the manifest version in the URL,
    // otherwise a fixed stylesheet may stay cached.
    link.href =
      "/widget-client/" +
      encodeURIComponent(id) +
      ".css?v=" +
      encodeURIComponent(entry.version || "");
    document.head.appendChild(link);
  }
}

// --- Metadata --------------------------------------------------------------

export function isRegistryLoaded() {
  return loaded;
}

export function listWidgetMetas() {
  // An internal (hidden) plugin is part of the engine, not a user choice: it
  // appears in no menu.
  return [...metas.values()].filter(meta => !meta.hidden);
}

export function getWidgetMeta(id) {
  return metas.get(String(id || "")) || null;
}

export function hasWidget(id) {
  return metas.has(String(id || ""));
}

// Finds a widget from the title typed in the editor. Spaces, accents and case
// do not count: "Me Tube" suggests "MeTube".
function normalizedWidgetName(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function suggestedWidgetId(title) {
  const wanted = normalizedWidgetName(title);
  if (!wanted) return "";
  const match = listWidgetMetas().find(meta => {
    const labels = Object.values(meta.label || {});
    return [meta.id, ...labels].some(name => normalizedWidgetName(name) === wanted);
  });
  return match ? match.id : "";
}

// Display label of the widget (editor menu, tile).
export function widgetLabel(meta, lang) {
  if (!meta) return "";
  const label = meta.label || {};
  return label[lang] || label.fr || label.en || meta.id;
}

// Translated label declared in manifest.json -> strings.<lang>.<key>. When
// the key does not exist the value is used as is, so a third party can write
// "label": "My field" without a translation pack.
export function widgetString(meta, key, lang) {
  const pack = (meta && meta.strings) || {};
  const table = pack[lang] || pack.fr || pack.en || {};
  return table[key] || key;
}

export function fieldLabel(meta, field, lang) {
  return widgetString(meta, field.label || field.key, lang);
}

export function fieldPlaceholder(meta, field, lang) {
  return field.placeholder ? widgetString(meta, field.placeholder, lang) : "";
}

// Long tooltip of a field, if the manifest declares one.
export function fieldTitle(meta, field, lang) {
  const title = field.title;
  if (!title) return "";
  return typeof title === "string" ? title : title[lang] || title.fr || title.en || "";
}

// Fields visible for a given config ("when" rule of the manifest).
export function visibleFields(meta, config) {
  if (!meta || !Array.isArray(meta.config)) return [];
  const values = config || {};
  return meta.config.filter(field => {
    if (!field.when || !field.when.key) return true;
    return str(values[field.when.key], 100) === str(field.when.equals, 100);
  });
}

// --- Configuration ---------------------------------------------------------

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

export { isEncryptedSecret };

// Local schema interpreter. The server remains the authority (GET /api/config
// returns an already normalised config): these functions serve the editor and
// the state normalisation, not security validation.
function normalizeWith(meta, widget) {
  const out = { type: meta.id };
  for (const field of meta.config || []) {
    const raw = widget[field.key] === undefined ? field.default : widget[field.key];
    if (field.type === "checkbox") {
      out[field.key] = raw === true || raw === "true" || raw === "on" || raw === 1;
    } else if (field.type === "number") {
      let n = Number(raw);
      if (!Number.isFinite(n)) n = Number(field.default) || 0;
      out[field.key] = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
    } else if (field.type === "select") {
      const wanted = str(raw, 100);
      const known = (field.options || []).some(option => option.value === wanted);
      out[field.key] = known ? wanted : str(field.default, 100);
    } else {
      // A secret stored by the server (encrypted or masked) is kept as is: the
      // browser holds no key and never sends a stored secret back in clear.
      out[field.key] = isEncryptedSecret(raw) ? raw : str(raw, field.maxLength);
    }
  }
  // "key" is not a configuration field: it is the status key published by the
  // server in GET /api/config. It must survive normalisation, otherwise the tile
  // no longer finds its cache entry. That goes unnoticed for widgets keyed per
  // service (their key is their URL) while widgets keyed by config (Docker) stay
  // empty.
  const publishedKey = str(widget.key, 200);
  if (publishedKey) out.key = publishedKey;
  return out;
}

// New config of a widget (manifest defaults).
export function defaultWidgetConfig(id) {
  const meta = getWidgetMeta(id);
  if (!meta) return { type: String(id || "") };
  return normalizeWith(meta, {});
}

// Type change in the editor: start again from the defaults and keep only the
// shared keys, so never another widget's secret.
export function inheritWidgetConfig(id, previous) {
  const meta = getWidgetMeta(id);
  if (!meta) return { type: String(id || "") };
  const next = normalizeWith(meta, {});
  if (isPlainObject(previous) && previous.type === id) {
    for (const field of meta.config || []) {
      if (previous[field.key] !== undefined) next[field.key] = previous[field.key];
    }
  }
  return next;
}

// Normalisation of a config received from the server. Safety rule: an unknown
// widget is NEVER trimmed. When the registry is unavailable, the config is kept
// as is rather than losing the user's settings on the next save.
export function normalizeWidgetConfig(widget) {
  if (!isPlainObject(widget) || !widget.type) return null;
  const meta = getWidgetMeta(widget.type);
  if (!meta) return Object.assign({}, widget);
  return normalizeWith(meta, widget);
}

// --- Status ----------------------------------------------------------------

// Status key: published by the server (GET /api/config -> widget.key) so the
// browser never rebuilds it and both sides cannot diverge. No special case per
// type here.
export function widgetStatusKey(service) {
  if (service && service.widget && service.widget.key) return service.widget.key;
  return (service && service.url) || "";
}

// Renders a tile, delegated to the widget renderer. Never throws: an exception
// in a third-party renderer degrades the tile, never the dashboard.
// Network failures: the target did not answer at all.
const UNREACHABLE =
  /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|ECONNRESET|EAI_AGAIN|timeout|socket hang up|link-local/i;

export function renderWidget(service, info, lang) {
  const activeLang = lang === "en" ? "en" : "fr";
  const meta = getWidgetMeta(service && service.widget && service.widget.type);
  const label = widgetLabel(meta, activeLang);

  // A failed check looks the same on every tile, whatever the widget: a yellow
  // "!" and one word ("unreachable" or "error"), the cause in the tooltip.
  const failure = info && typeof info.error === "string" ? info.error.trim() : "";
  if (failure) {
    const texts = activeLang === "en" ? en : fr;
    return {
      badge: UNREACHABLE.test(failure) ? texts.widgetUnreachable : texts.widgetError,
      badgeClass: "error",
      icon: "fa-solid fa-circle-exclamation",
      time: "",
      timeClass: "",
      title: `${label || "?"} : ${failure.slice(0, 200)}`
    };
  }
  const fmt = formatters(activeLang);
  const fallback = title => ({
    badge: info ? (label || "?") + " -" : "-",
    badgeClass: "pending",
    time: "",
    timeClass: "",
    title: title || label
  });

  if (!meta) return fallback(info ? "Widget indisponible" : "");
  const module = renderers.get(meta.id);
  if (!module) return fallback(info ? "Renderer indisponible" : "");

  const ctx = {
    info: info || null,
    config: (service && service.widget) || {},
    lang: activeLang,
    t: key => widgetString(meta, key, activeLang),
    formatDateTime: fmt.formatDateTime,
    formatNumber: fmt.formatNumber,
    formatCompactNumber: fmt.formatCompactNumber,
    formatCompactCount: fmt.formatCompactCount
  };

  try {
    // Fully custom rendering: the widget returns its own DOM node.
    if (typeof module.element === "function") {
      const node = module.element(ctx);
      if (node) return { element: node, title: node.title || "" };
    }
    const view = module.render(ctx);
    if (!isPlainObject(view)) return fallback("Rendu invalide");
    return {
      badge: view.badge == null ? "" : String(view.badge),
      badgeClass: view.badgeClass ? String(view.badgeClass) : "",
      time: view.time == null ? "" : String(view.time),
      timeClass: view.timeClass ? String(view.timeClass) : "",
      title: view.title ? String(view.title) : label
    };
  } catch (error) {
    console.error("Widget rendering failed:", meta.id, error);
    return fallback("Erreur de rendu");
  }
}
