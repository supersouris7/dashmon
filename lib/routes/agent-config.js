"use strict";
// Agent mode only: local settings, accessed by the primary with the sync token.
//
//   GET /api/agent/config  name and monitoring options of the local host,
//                          with the config revision as ETag
//   PUT /api/agent/config  replaces them (If-Match: refused with 412 when the
//                          config changed since it was read)
//
// An agent never receives the configuration of the main dashboard: these
// routes only touch its local host.

const { apiError } = require("../http/api-errors");
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
      const host = findLocalHost(config);
      res.set("Cache-Control", "no-store");
      res.set("ETag", configRepository.revision(config));
      res.json({
        name: host?.name || "Agent",
        monitoring: host?.monitoring || { enabled: true, type: "local" }
      });
    } catch (_error) {
      res.status(500).json({ ...apiError("read_failed") });
    }
  });

  app.put("/api/agent/config", (req, res) => {
    if (!agentMode) return res.sendStatus(404);
    if (
      typeof req.body?.name !== "string" ||
      !req.body.monitoring ||
      typeof req.body.monitoring !== "object" ||
      Array.isArray(req.body.monitoring)
    ) {
      return res.status(400).json({ ...apiError("invalid_agent_config") });
    }
    try {
      const current = configRepository.read();
      if (!req.get("If-Match")) return res.status(428).json({ ...apiError("revision_required") });
      if (req.get("If-Match") !== configRepository.revision(current)) {
        return res.status(412).json({ ...apiError("config_conflict") });
      }
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
      res.set("ETag", configRepository.revision(configRepository.read()));
      res.json({ ok: true });
    } catch (_error) {
      res.status(500).json({ ...apiError("save_failed") });
    }
  });
}

module.exports = { registerAgentConfigRoutes };
