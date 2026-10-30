"use strict";
// Service statuses computed by the status loop (lib/status/monitor.js).
//
//   GET  /api/status   the status cache, keyed by service
//   POST /api/refresh  checks every service now, then returns the cache

function registerStatusRoutes(app, { statusMonitor }) {
  app.get("/api/status", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(statusMonitor.statusCache);
  });

  app.post("/api/refresh", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await statusMonitor.refresh(true);
    } catch (_error) {}
    res.json(statusMonitor.statusCache);
  });
}

module.exports = { registerStatusRoutes };
