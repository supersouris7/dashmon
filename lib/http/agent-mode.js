"use strict";
// In agent mode, the API is reduced to the agent's own settings and metrics.
// Every other /api route answers 404, as if it did not exist.

const AGENT_API_PATHS = new Set(["/sync/metrics", "/agent/config", "/agent/metrics"]);

// Mounted on "/api", so req.path is relative to it.
function agentApiFilter(req, res, next) {
  if (AGENT_API_PATHS.has(req.path)) return next();
  res.status(404).json({ error: "Route indisponible en mode agent" });
}

module.exports = { agentApiFilter };
