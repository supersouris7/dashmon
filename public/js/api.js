// Server API: reading and writing the configuration (with debounced saves).
import { state } from "./state.js";

let configSaveTimer;
let configSaveChain = Promise.resolve();
let configPatchTimer;
let pendingConfigPatch = {};
let configRevision = "";
export function setConfigRevision(value) {
  configRevision = String(value || "");
}
export let configConflict = false;

export function saveConfig(immediate = false, { replaceUsage = false } = {}) {
  clearTimeout(configSaveTimer);

  const run = () => {
    // Deliberately no collapsed / viewMode / sortMode / groupMode / openMode /
    // smallIcons / webLinksHidden: the screen layout lives in the browser
    // (view-prefs.js) and is neither read nor written by the server. The PUT carries
    // the configuration and the appearance preferences.
    const payload = JSON.stringify({
      services: state.services,
      categories: state.categories,
      dashboards: state.dashboards,
      hosts: state.hosts,
      replication: state.replication,
      specialTile: state.specialTile,
      theme: state.theme,
      language: state.language,
      usageCounts: state.usageCounts,
      webLinks: state.webLinks,
      webLinksColor: state.webLinksColor,
      webLinksSeedVersion: state.webLinksSeedVersion
    });
    configSaveChain = configSaveChain
      .catch(() => {})
      .then(async () => {
        configConflict = false;
        const response = await fetch("/api/config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(configRevision ? { "If-Match": configRevision } : {}),
            ...(replaceUsage ? { "X-Dashmon-Replace-Usage": "1" } : {})
          },
          body: payload
        });
        if (response.status === 412) configConflict = true;
        if (!response.ok) throw new Error("HTTP " + response.status);
        setConfigRevision(response.headers.get("ETag"));
        return true;
      })
      .catch(error => {
        console.error("Enregistrement de config.json impossible", error);
        return false;
      });
    return configSaveChain;
  };

  if (immediate) return run();
  configSaveTimer = setTimeout(run, 120);
  return configSaveChain;
}

// Partial update (PATCH) for light toggles and selects: avoids writing the
// whole config.json on every click.
export function patchConfig(patch, immediate = false) {
  clearTimeout(configPatchTimer);
  // Several settings changed in quick succession must all survive the debounce.
  // Top-level fields are replaced, as in the PATCH API.
  pendingConfigPatch = { ...pendingConfigPatch, ...patch };
  const run = () => {
    const payload = JSON.stringify(pendingConfigPatch);
    pendingConfigPatch = {};
    configSaveChain = configSaveChain
      .catch(() => {})
      .then(async () => {
        const response = await fetch("/api/config", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(configRevision ? { "If-Match": configRevision } : {})
          },
          body: payload
        });
        if (response.status === 412) {
          window.dispatchEvent(new Event("dashmon:config-conflict"));
          throw new Error("HTTP 412");
        }
        if (!response.ok) throw new Error("HTTP " + response.status);
        setConfigRevision(response.headers.get("ETag"));
      })
      .catch(error => console.error("Mise à jour de config.json impossible", error));
    return configSaveChain;
  };
  if (immediate) return run();
  configPatchTimer = setTimeout(run, 150);
  return configSaveChain;
}

export async function fetchConfig() {
  // Cache-busting parameter: some reverse proxies ignore Cache-Control and serve
  // the old configuration again after a deletion.
  const response = await fetch("/api/config?_=" + Date.now(), { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

export async function putConfig(body) {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
}

// Click counter: local increment plus a light request that survives page
// navigation (the big PUT /api/config would be cut off by the click).
export function bumpUsage(key) {
  if (!key) return;
  state.usageCounts[key] = Number(state.usageCounts[key] || 0) + 1;
  const payload = JSON.stringify({ key });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/usage", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch (_error) {
    saveConfig(true);
  }
}
