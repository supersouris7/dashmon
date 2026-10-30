"use strict";
// Status loop: checks every monitored service and stores the result in the
// status cache read by GET /api/status.
//
// Each service is handled by a widget plugin (lib/widgets/): its own widget if
// it has one, otherwise the plugin claiming the "link" slot (plain web links).
// The loop knows no widget by name.

const { createScheduler } = require("./scheduler");
const { sanitizeUrl } = require("../sanitize");

// Checks run in batches of 3, 150 ms apart: no burst of connections, and a
// refresh cycle that stays reasonably short.
const BATCH_SIZE = 3;
const BATCH_PAUSE = 150;

// A web link carrying a counter (GitHub stars, Docker Hub pulls, YouTube
// subscribers) is checked as a virtual service borrowing the matching widget
// backend. The number lands in the status cache under the link URL, where the
// browser reads it.
function linkCounterService(link) {
  const counter = link && link.counter;
  const url = link && sanitizeUrl(link.url);
  if (!counter || !url) return null;
  if (counter.type === "github")
    return { url, widget: { type: "github", repo: counter.target, metric: "stars" } };
  if (counter.type === "dockerhub")
    return { url, widget: { type: "dockerhub", repo: counter.target } };
  if (counter.type === "youtube")
    return { url, widget: { type: "youtube", username: counter.target } };
  return null;
}

function linkCounterServices(config) {
  const links = Array.isArray(config.webLinks) ? config.webLinks : [];
  return links.map(linkCounterService).filter(Boolean);
}

function createStatusMonitor({ widgetCore, statusCache, readConfig, log }) {
  const cacheKey = service => widgetCore.cacheKey(service);

  async function checkService(service) {
    if (widgetCore.handles(service)) {
      await widgetCore.check(service);
      return;
    }
    // No plugin can check this service (its widget plugin is missing, or no
    // link plugin is installed): publish nothing rather than a false state.
    if (!service.url || service.monitor === false) return;
    if (service.widget?.type) return;
    log.warn(`No plugin monitors ${service.url}: link not checked`);
  }

  // Not yet checked, or checked longer ago than the period declared in the
  // widget manifest.
  function isDue(service) {
    const entry = statusCache[cacheKey(service)];
    return !(
      entry &&
      entry.lastCheck &&
      Date.now() - entry.lastCheck < widgetCore.interval(service)
    );
  }

  async function runCycle(force) {
    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return;
    }

    // Link counters go through the same loop, cache and purge as services:
    // otherwise their entry would be purged on every cycle.
    const services = Array.isArray(config.services) ? config.services : [];
    const monitored = services.concat(linkCounterServices(config));
    // Removes orphan cache entries and lets each widget purge its own memory
    // (tokens, history) through its purge() hook.
    widgetCore.purge(monitored);

    // Widgets keyed by configuration (Docker, for instance) may appear on
    // several tiles: one check per key is enough.
    const due = [];
    const seen = new Set();
    for (const service of force ? monitored : monitored.filter(isDue)) {
      const key = cacheKey(service);
      if (seen.has(key)) continue;
      seen.add(key);
      due.push(service);
    }

    for (let i = 0; i < due.length; i += BATCH_SIZE) {
      await Promise.all(due.slice(i, i + BATCH_SIZE).map(checkService));
      await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE));
    }
    for (const service of due) {
      const entry = statusCache[cacheKey(service)];
      if (entry) entry.lastCheck = Date.now();
    }
  }

  return {
    statusCache,
    // refresh(force): concurrent calls share the running cycle (scheduler.js).
    refresh: createScheduler({ runCycle })
  };
}

module.exports = { createStatusMonitor, linkCounterService };
