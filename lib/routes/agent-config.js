"use strict";
// Agent mode only: the agent's own settings, edited from its web page.
//
//   GET /api/agent/config  name and monitoring options of the local host
//   PUT /api/agent/config  replaces them
//
// An agent never receives the configuration of the main dashboard: these
// routes only touch its local host.

const crypto = require("crypto");
const { sanitizeText } = require("../sanitize");
const { sanitizeHostMonitoring } = require("../config/fields");

const findLocalHost = config =>
  (config.hosts || []).find(item => item.monitoring?.type === "local" && item.monitoring.enabled);

function registerAgentConfigRoutes(app, { agentMode, configRepository, hostMetrics }) {
  app.get("/api/agent/config", (req, res) => {
    if (!agentMode) return res.sendStatus(404);
    try {
      const config = configRepository.read();
      if (req.get("If-Match") && req.get("If-Match") !== configRepository.revision(config)) {
        return res
          .status(412)
          .json({ error: "La configuration a changé ; rechargez avant d'enregistrer" });
      }
      const host = findLocalHost(config);
      res.set("Cache-Control", "no-store");
      res.json({
        name: host?.name || "Agent",
        monitoring: host?.monitoring || { enabled: true, type: "local" }
      });
    } catch (_error) {
      res.status(500).json({ error: "Lecture impossible" });
    }
  });

  app.put("/api/agent/config", (req, res) => {
    if (!agentMode) return res.sendStatus(404);
    try {
      const current = configRepository.read();
      const old = findLocalHost(current);
      const host = {
        id: old?.id || "host-" + crypto.randomBytes(6).toString("hex"),
        name: sanitizeText(req.body?.name, 100) || "Agent",
        icon: old?.icon || "fa-solid fa-server",
        color: old?.color || "",
        monitoring: sanitizeHostMonitoring({
          ...req.body?.monitoring,
          type: "local",
          enabled: true
        })
      };
      current.hosts = (Array.isArray(current.hosts) ? current.hosts : []).filter(
        item => item !== old
      );
      current.hosts.push(host);
      configRepository.write(current);
      hostMetrics.invalidate();
      res.json({ ok: true });
    } catch (_error) {
      res.status(500).json({ error: "Enregistrement impossible" });
    }
  });
}

module.exports = { registerAgentConfigRoutes };
