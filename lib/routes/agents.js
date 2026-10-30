"use strict";

// Main dashboard side of the agents.
//
//   GET  /api/replication/metrics  metrics of every paired agent
//   POST /api/agents/test          checks that one agent answers
//   GET/PUT /api/agents/config     settings of an already saved agent
//
// Agents never receive the dashboard configuration, only their own local
// monitoring settings. The shared sync token stays server-side.
function registerAgentRoutes(
  app,
  { readConfig, sanitizeReplication, sanitizeSyncUrl, request, assess, token, timeout }
) {
  const lastSuccess = new Map();
  const fetchAgent = url =>
    request(url, "/api/sync/metrics", {
      timeout,
      headers: { "X-Dashmon-Sync-Token": token }
    });

  // Fixed endpoint, saved peers only: this must never become a generic proxy.
  async function agentConfig(req, res) {
    res.set("Cache-Control", "no-store");
    const target = req.method === "GET" ? req.query.url : req.body?.url;
    const url = typeof target === "string" ? sanitizeSyncUrl(target) : "";
    const peers = sanitizeReplication(readConfig().replication).secondaries;
    if (!url || !peers.includes(url)) return res.status(404).json({ error: "Agent non paire" });
    if (!token) return res.status(503).json({ error: "DASHMON_SYNC_TOKEN absent" });
    const write = req.method === "PUT";
    if (write && (typeof req.body?.revision !== "string" || !req.body.revision)) {
      return res.status(428).json({ error: "Revision requise" });
    }
    if (
      write &&
      (!req.body.config ||
        typeof req.body.config.name !== "string" ||
        !req.body.config.monitoring ||
        typeof req.body.config.monitoring !== "object" ||
        Array.isArray(req.body.config.monitoring))
    ) {
      return res.status(400).json({ error: "Configuration agent invalide" });
    }
    try {
      const result = await request(url, "/api/agent/config", {
        method: write ? "PUT" : "GET",
        timeout,
        raw: true,
        headers: {
          "X-Dashmon-Sync-Token": token,
          ...(write ? { "Content-Type": "application/json", "If-Match": req.body.revision } : {})
        },
        ...(write ? { body: req.body.config } : {})
      });
      const payload = JSON.parse(result.body);
      if (
        !result.headers.etag ||
        (!write &&
          (!payload?.monitoring ||
            typeof payload.monitoring !== "object" ||
            Array.isArray(payload.monitoring) ||
            typeof payload.name !== "string"))
      ) {
        return res.status(502).json({ error: "Reponse agent invalide" });
      }
      res.json({ config: payload, revision: result.headers.etag });
    } catch (error) {
      if (error.status === 412)
        return res.status(412).json({ error: "Configuration agent modifiee ailleurs" });
      res
        .status(502)
        .json({ error: "Configuration agent inaccessible ; verifiez sa version et son token" });
    }
  }
  app.get("/api/agents/config", agentConfig);
  app.put("/api/agents/config", agentConfig);
  app.get("/api/replication/metrics", async (_req, res) => {
    const replication = sanitizeReplication(readConfig().replication);
    if (replication.role !== "primary") return res.json({ instances: [] });
    if (!token) return res.status(503).json({ error: "DASHMON_SYNC_TOKEN absent" });
    for (const url of lastSuccess.keys())
      if (!replication.secondaries.includes(url)) lastSuccess.delete(url);
    const instances = await Promise.all(
      replication.secondaries.map(async url => {
        try {
          const payload = await fetchAgent(url);
          const assessment = assess(payload, { lastSuccessAt: lastSuccess.get(url) || null });
          if (assessment.status === "available") lastSuccess.set(url, assessment.lastSuccessAt);
          if (assessment.status === "unavailable")
            return { url, ok: false, error: "Instance inaccessible", hosts: [], ...assessment };
          return { url, ok: true, hosts: payload.hosts, ...assessment };
        } catch (_error) {
          return {
            url,
            ok: false,
            status: "unavailable",
            reason: "unreachable",
            lastSuccessAt: lastSuccess.get(url) || null,
            error: "Instance inaccessible",
            hosts: []
          };
        }
      })
    );
    res.set("Cache-Control", "no-store");
    res.json({ instances });
  });
  app.post("/api/agents/test", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!token) return res.status(503).json({ ok: false, reason: "token_missing" });
    const url = sanitizeSyncUrl(typeof req.body?.url === "string" ? req.body.url : "");
    if (!url) return res.status(400).json({ ok: false, reason: "invalid_url" });
    try {
      const payload = await fetchAgent(url);
      const assessment = assess(payload);
      if (assessment.status === "unavailable")
        return res.status(502).json({ ok: false, reason: assessment.reason });
      return res.json({ ok: true });
    } catch (error) {
      return res
        .status(502)
        .json({ ok: false, reason: error.status === 401 ? "unauthorized" : "unreachable" });
    }
  });
}
module.exports = { registerAgentRoutes };
