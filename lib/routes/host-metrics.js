"use strict";
// Metrics of the machine running Dashmon (see lib/host/metrics.js).
//
//   GET /api/host-metrics   supervision page of this instance
//   GET /api/agent/metrics  agent mode: the agent's own web page
//   GET /api/sync/metrics   agent mode: read by the main dashboard, with the
//                           shared sync token instead of a web session

function registerHostMetricsRoutes(app, { hostMetrics, agentMode, validSyncToken }) {
  app.get("/api/host-metrics", hostMetrics.handle);

  app.get("/api/agent/metrics", (req, res) =>
    agentMode ? hostMetrics.handle(req, res) : res.sendStatus(404)
  );

  app.get("/api/sync/metrics", (req, res) => {
    if (!validSyncToken(req)) {
      return res.status(401).json({ error: "Authentification de synchronisation requise" });
    }
    if (!agentMode) return res.status(404).json({ error: "Agent non activé" });
    return hostMetrics.handle(req, res);
  });
}

module.exports = { registerHostMetricsRoutes };
