"use strict";

// Main dashboard side of the agents.
//
//   GET  /api/replication/metrics  metrics of every paired agent
//   POST /api/agents/test          checks that one agent answers
//
// Agents never receive the dashboard configuration: this module only reads
// their metrics, with the shared sync token.
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
