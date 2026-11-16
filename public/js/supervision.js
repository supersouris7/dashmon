// Supervision page: CPU, RAM, temperature and disk of the monitored hosts,
// plus the agents' metrics. Rendering is pure (it reads state.hostMetrics); the
// network read lives in refreshHostMetrics, triggered when the page opens and
// by a timer. Each card type has its own module in supervision/.
import { t } from "./i18n.js";
import { state } from "./state.js";
import { sanitizeTileColor } from "./config/sanitize.js";
import { supervisionList, supervisionPage } from "./dom.js";
import { updateSmartCollapseButton } from "./supervision/cards.js";
import { selectedSupervisionInstanceId } from "./supervision/instances.js";
import { hostCard } from "./supervision/host-card.js";
import { layoutMasonry } from "./supervision/masonry.js";
import { speedtestCard } from "./supervision/speedtest-card.js";
import { scriptNotice } from "./supervision/script-notice.js";
import { restore, selectionInside, snapshot } from "./supervision/preserve.js";
import { pluginCard } from "./supervision/plugin-card.js";
import { withPluginReports } from "./supervision/legacy.js";
import {
  listSupervisionPlugins,
  pluginHostPrefs,
  supervisionRenderer
} from "./supervision-registry.js";

// Why an agent tab has no data, when the main dashboard knows.
const OFFLINE_REASONS = {
  incompatible_protocol: "agentIncompatible",
  already_paired: "agentAlreadyPaired",
  unauthorized: "agentUnauthorized"
};

// A card whose report comes from an older host script ends with the command
// that updates it (metrics.scriptUpdates, keyed by plugin id).
function withScriptNotice(card, metrics, id) {
  const notice = scriptNotice(metrics, id);
  if (notice) card.appendChild(notice);
  return card;
}

// Interval injected by the server (HOST_METRICS_INTERVAL). HTML served
// without substitution (tests, local file) falls back to 60 s.
function metricsInterval() {
  if (typeof document === "undefined") return 60000;
  const meta = document.querySelector('meta[name="host-metrics-interval"]');
  const value = Number(meta && meta.content);
  return Number.isFinite(value) && value >= 5000 ? Math.min(value, 3600000) : 60000;
}
const HOST_METRICS_INTERVAL = metricsInterval();
let remoteInstances = [];

export function agentHostMetrics(url) {
  return remoteInstances.find(instance => instance.url === url)?.hosts?.[0];
}

export function renderSupervision() {
  supervisionList.replaceChildren();
  const activeInstance = selectedSupervisionInstanceId();

  // The title is no longer shown: the navigation already names the instance.
  // The section keeps an accessible name for screen readers.
  supervisionPage.setAttribute("aria-label", t("supervisionTitle"));

  const selected =
    activeInstance === "local"
      ? null
      : remoteInstances.find(instance => instance.id === activeInstance) || {
          id: activeInstance,
          hosts: null
        };
  if (selected?.error) {
    const status = document.createElement("p");
    status.className = "supervision-empty";
    status.textContent = t(OFFLINE_REASONS[selected.reason] || "agentOffline");
    supervisionList.append(status);
    updateSmartCollapseButton();
    return;
  }
  // A remote instance can be opened before its first metrics arrive: it then
  // shows the loading state rather than a false empty page.
  if (selected && !Array.isArray(selected.hosts)) {
    const status = document.createElement("p");
    status.className = "supervision-empty";
    status.textContent = t("supervisionLoading");
    supervisionList.append(status);
    updateSmartCollapseButton();
    return;
  }
  if (selected?.status === "stale") {
    const warning = document.createElement("p");
    warning.className = "supervision-empty";
    warning.textContent = t("agentStale");
    supervisionList.append(warning);
  }
  const agentHosts = state.replication?.agentHosts || {};
  const monitored = selected
    ? selected.hosts.map(metric => {
        // The pairing points to a host of the inventory: its colour and icon dress
        // the remote tile, as for a local host. A missing or deleted reference falls
        // back to the default icon.
        const hostId = agentHosts[selected.id];
        const linked = hostId ? state.hosts.find(host => host.id === hostId) : null;
        return {
          id: metric.id,
          name: metric.name || linked?.name || t("hostName"),
          icon: "fa-solid fa-microchip",
          color: sanitizeTileColor(linked?.color),
          monitoring: { enabled: true, type: metric.type },
          agentUrl: selected.url
        };
      })
    : state.hosts.filter(host => host.monitoring && host.monitoring.enabled === true);
  // No monitored host: explain where to enable supervision rather than show a
  // silent empty grid.
  if (!monitored.length) {
    const empty = document.createElement("p");
    empty.className = "supervision-empty";
    empty.textContent = t("supervisionEmpty");
    supervisionList.append(empty);
    updateSmartCollapseButton();
    return;
  }

  // Data not available yet: a single message, not one error per card.
  if (!selected && monitored.length && !Array.isArray(state.hostMetrics)) {
    const status = document.createElement("p");
    status.className = "supervision-empty";
    status.textContent = state.hostMetricsError ? t("supervisionError") : t("supervisionLoading");
    supervisionList.append(status);
    updateSmartCollapseButton();
    return;
  }

  // Agents older than protocol 1.2 send the former built-in reports as host
  // fields: read as plugin reports (supervision/legacy.js).
  const byId = new Map(
    (selected ? selected.hosts : state.hostMetrics || [])
      .filter(m => m && m.id)
      .map(m => [m.id, withPluginReports(m)])
  );
  // A single grid: every card takes the first free cell, without reserving a
  // row. The hosts first, then the cards in their manifest order; the speed
  // test, part of the core, sits after the directories (order 15), next to
  // the host whose links it measures.
  const grid = document.createElement("div");
  grid.className = "supervision-grid";
  grid.dataset.columns = state.supervisionColumns;
  monitored.forEach(host => grid.appendChild(hostCard(host, byId.get(host.id))));
  const lang = state.language === "en" ? "en" : "fr";
  const entries = [
    { order: 15, speedtest: true },
    ...listSupervisionPlugins().map(meta => ({ order: meta.order ?? 100, meta }))
  ].sort((a, b) => a.order - b.order);
  for (const entry of entries) {
    monitored.forEach(host => {
      const metrics = byId.get(host.id);
      if (entry.speedtest) {
        if (metrics?.ok && metrics.speedtest?.available)
          grid.appendChild(speedtestCard(host, metrics, { onRun: runSpeedtest }));
        return;
      }
      const card = supervisionPluginCard(host, metrics, entry.meta, lang);
      if (card) grid.appendChild(card);
    });
  }
  supervisionList.append(grid);
  layoutMasonry(grid);
  updateSmartCollapseButton();
}

// Card of a supervision plugin for one host, or null: no renderer, card
// turned off on that host, no report (unless the manifest asks for an empty
// card), or nothing the renderer wants to show.
function supervisionPluginCard(host, metrics, meta, lang) {
  const module = supervisionRenderer(meta.id);
  if (!module || !metrics?.ok) return null;
  const prefs = pluginHostPrefs(host.monitoring, meta);
  if (prefs.enabled === false) return null;
  const report = metrics.plugins?.[meta.id] || null;
  if (!report && !meta.showEmpty) return null;
  const card = pluginCard(host, meta, module, report, lang, prefs);
  return card ? withScriptNotice(card, metrics, meta.id) : null;
}

// Speed test asked from a card: on this instance, or on the agent the card
// belongs to. Answers "ok", "too_soon" or "failed".
export async function runSpeedtest(host) {
  try {
    const response = host.agentUrl
      ? await fetch("/api/agents/speedtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: host.agentUrl })
        })
      : await fetch("/api/host-metrics/speedtest", { method: "POST" });
    if (response.status === 429) return "too_soon";
    if (!response.ok) return "failed";
  } catch (_error) {
    return "failed";
  }
  await refreshHostMetrics();
  return "ok";
}

let metricsInflight = false;

export async function refreshHostMetrics() {
  if (metricsInflight) return;
  metricsInflight = true;
  try {
    const response = await fetch("/api/host-metrics", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    state.hostMetrics = Array.isArray(data.hosts) ? data.hosts : [];
    const replication = await fetch("/api/replication/metrics", { cache: "no-store" });
    if (replication.ok) {
      const data = await replication.json();
      remoteInstances = (data.instances || []).map(instance => ({
        id: instance.url,
        url: instance.url,
        hosts: instance.hosts || [],
        error: instance.error,
        status: instance.status,
        reason: instance.reason
      }));
    } else {
      remoteInstances = (state.replication?.secondaries || []).map(url => ({
        id: url,
        url,
        hosts: [],
        error: true,
        status: "unavailable"
      }));
    }
    state.hostMetricsError = false;
  } catch (_error) {
    state.hostMetricsError = true;
    state.hostMetrics = null;
  } finally {
    metricsInflight = false;
    if (state.page === "supervision") refreshSupervision();
  }
}

// A refresh keeps what the user is doing (supervision/preserve.js); while
// text is selected in the page it waits for the selection to end.
let refreshPending = false;
function refreshSupervision() {
  if (selectionInside(supervisionList)) {
    refreshPending = true;
    return;
  }
  refreshPending = false;
  const saved = snapshot(supervisionList);
  renderSupervision();
  restore(supervisionList, saved);
}
if (typeof document !== "undefined") {
  document.addEventListener("selectionchange", () => {
    if (refreshPending && state.page === "supervision" && !selectionInside(supervisionList))
      refreshSupervision();
  });
}

function pageHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

// Metrics are only read on the supervision page: elsewhere the timer is
// stopped so remote hosts are not queried for nothing.
export function startSupervisionMetrics() {
  stopSupervisionMetrics();
  refreshHostMetrics();
  state.hostMetricsTimer = setInterval(() => {
    if (!pageHidden()) {
      refreshHostMetrics();
    }
  }, HOST_METRICS_INTERVAL);
}

export function stopSupervisionMetrics() {
  if (state.hostMetricsTimer) {
    clearInterval(state.hostMetricsTimer);
    state.hostMetricsTimer = null;
  }
}
