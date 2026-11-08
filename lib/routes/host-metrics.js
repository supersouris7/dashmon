"use strict";
// Metrics of the machine running Dashmon (see lib/host/metrics.js).
//
//   GET /api/host-metrics   supervision page of this instance
//   GET /api/agent/metrics  agent mode: the agent's own web page
//   GET /api/sync/metrics   agent mode: read by the main dashboard, with the
//                           shared sync token instead of a web session
//   POST /api/host-metrics/speedtest  speed test now, on this instance
//   POST /api/sync/speedtest  agent mode: the same, asked by the main dashboard

const { apiError } = require("../http/api-errors");

function registerHostMetricsRoutes(app, { hostMetrics, agentMode, validSyncToken }) {
  app.get("/api/host-metrics", hostMetrics.handle);

  app.get("/api/agent/metrics", (req, res) =>
    agentMode ? hostMetrics.handle(req, res) : res.sendStatus(404)
  );

  app.post("/api/host-metrics/speedtest", (req, res) =>
    agentMode ? res.sendStatus(404) : hostMetrics.runSpeedtest(req, res)
  );

  app.post("/api/sync/speedtest", (req, res) => {
    if (!validSyncToken(req)) {
      return res.status(401).json({ ...apiError("sync_auth_required") });
    }
    if (!agentMode) return res.status(404).json({ ...apiError("agent_disabled") });
    return hostMetrics.runSpeedtest(req, res);
  });

  app.get("/api/sync/metrics", (req, res) => {
    if (!validSyncToken(req)) {
      return res.status(401).json({ ...apiError("sync_auth_required") });
    }
    if (!agentMode) return res.status(404).json({ ...apiError("agent_disabled") });
    return hostMetrics.handle(req, res);
  });
}

module.exports = { registerHostMetricsRoutes };
