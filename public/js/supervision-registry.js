// Supervision plugin registry, browser side.
//
// Same model as the tile widgets (widget-registry.js): the browser knows no
// supervision plugin by name. It fetches the list published by the server
// (GET /api/supervisions), then loads each card renderer
// (GET /supervision-client/<id>.js). Adding a card never requires changing
// supervision.js, the editor or the translations.
//
// A missing or failing renderer never breaks the page: its card is simply not
// drawn, the other cards keep working.

import { widgetLabel, widgetString } from "./widget-registry.js";

const metas = new Map();
const renderers = new Map();

// Loads the registry and the renderers. Never throws: on failure the page
// goes on without plugin cards.
export async function loadSupervisionRegistry() {
  let list;
  try {
    const response = await fetch("/api/supervisions", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    list = await response.json();
  } catch (error) {
    console.warn("Supervision plugin registry unavailable", error);
    return [];
  }
  if (!Array.isArray(list)) return [];
  const styles = [];
  await Promise.all(
    list.map(meta => {
      if (!meta || !meta.id) return null;
      metas.set(meta.id, meta);
      if (meta.hasCss) styles.push(meta);
      if (!meta.hasClient) return null;
      // The manifest version is part of the URL: a new version of a plugin is
      // a new URL, never an old cached module.
      return import(
        "/supervision-client/" +
          encodeURIComponent(meta.id) +
          ".js?v=" +
          encodeURIComponent(meta.version || "")
      )
        .then(module => {
          if (typeof module.card === "function" || typeof module.element === "function")
            renderers.set(meta.id, module);
        })
        .catch(error => console.warn("Supervision card renderer unavailable:", meta.id, error));
    })
  );
  injectStyles(styles);
  return [...metas.keys()];
}

function injectStyles(list) {
  if (typeof document === "undefined") return;
  for (const meta of list) {
    if (document.querySelector(`link[data-supervision-style="${CSS.escape(meta.id)}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.supervisionStyle = meta.id;
    link.href =
      "/supervision-client/" +
      encodeURIComponent(meta.id) +
      ".css?v=" +
      encodeURIComponent(meta.version || "");
    document.head.appendChild(link);
  }
}

// Installed plugins, sorted by id: the order of their cards and settings.
export function listSupervisionPlugins() {
  return [...metas.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function supervisionRenderer(id) {
  return renderers.get(String(id || "")) || null;
}

export function pluginLabel(meta, lang) {
  return widgetLabel(meta, lang);
}

export function pluginString(meta, key, lang) {
  return widgetString(meta, key, lang);
}

// Test hook: registers a plugin without the network.
export function registerSupervisionPlugin(meta, module) {
  metas.set(meta.id, meta);
  if (module) renderers.set(meta.id, module);
}
