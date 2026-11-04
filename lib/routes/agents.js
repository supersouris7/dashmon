"use strict";

// Main dashboard side of the agents.
//
//   GET  /api/replication/metrics  metrics of every paired agent
//   POST /api/agents/test          checks that one agent answers (the token is
//                                  sent only once the address proves to be an agent)
//   GET/PUT /api/agents/config     settings of an already saved agent
//   POST /api/agents/speedtest     speed test now, on an already saved agent
//
// Agents never receive the dashboard configuration, only their own local
// monitoring settings. The shared sync token stays server-side.

// Speed test now on a saved agent. Same rule as the agent settings: saved
// peers only, fixed path.
function registerAgentSpeedtest(
  app,
  { readConfig, sanitizeReplication, sanitizeSyncUrl, request, token, timeout, onDone }
) {
  app.post("/api/agents/speedtest", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const url = typeof req.body?.url === "string" ? sanitizeSyncUrl(req.body.url) : "";
    const peers = sanitizeReplication(readConfig().replication).secondaries;
    if (!url || !peers.includes(url)) return res.status(404).json({ error: "Agent non paire" });
    if (!token) return res.status(503).json({ error: "DASHMON_SYNC_TOKEN absent" });
    try {
      const payload = await request(url, "/api/sync/speedtest", {
        method: "POST",
        timeout,
        headers: { "X-Dashmon-Sync-Token": token }
      });
      onDone();
      res.json({ result: payload?.result || null });
    } catch (error) {
      if (error.status === 429) return res.status(429).json({ error: "speedtest_too_soon" });
      if (error.status === 404) return res.status(404).json({ error: "speedtest_disabled" });
      res.status(502).json({ error: "speedtest_unreachable" });
    }
  });
}

// Pairing check of an address not saved yet.
function registerAgentTest(app, { sanitizeSyncUrl, request, assess, token, timeout, fetchAgent }) {
  app.post("/api/agents/test", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!token) return res.status(503).json({ ok: false, reason: "token_missing" });
    const url = sanitizeSyncUrl(typeof req.body?.url === "string" ? req.body.url : "");
    if (!url) return res.status(400).json({ ok: false, reason: "invalid_url" });
    // The address is not paired yet and may be a typo: it must first prove,
    // without the token, that it is a Dashmon agent. The shared token, valid
    // for every agent, is only sent after that.
    try {
      const ready = await request(url, "/readyz", { timeout });
      if (ready?.role !== "agent") return res.status(502).json({ ok: false, reason: "not_agent" });
    } catch (_error) {
      return res.status(502).json({ ok: false, reason: "not_agent" });
    }
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

function registerAgentRoutes(
  app,
  {
    readConfig,
    sanitizeReplication,
    sanitizeSyncUrl,
    request,
    assess,
    token,
    timeout,
    cacheMs = 0,
    // A test lasts about 20 s: the agent answers once it is over.
    speedtestTimeout = 60000,
    now = Date.now
  }
) {
  const lastSuccess = new Map();
  // Every open supervision page polls this route: the agents are asked at
  // most once per cacheMs (HOST_METRICS_INTERVAL), and concurrent requests
  // share the answer being collected.
  let cached = null;
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
  async function collect(replication) {
    for (const url of lastSuccess.keys())
      if (!replication.secondaries.includes(url)) lastSuccess.delete(url);
    return Promise.all(
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
  }
  app.get("/api/replication/metrics", async (_req, res) => {
    const replication = sanitizeReplication(readConfig().replication);
    if (replication.role !== "primary") return res.json({ instances: [] });
    if (!token) return res.status(503).json({ error: "DASHMON_SYNC_TOKEN absent" });
    // A change of the agent list makes the cached answer stale at once.
    const key = JSON.stringify(replication.secondaries);
    if (!cached || cached.key !== key || now() - cached.at >= cacheMs) {
      cached = { key, at: now(), instances: collect(replication) };
    }
    const current = cached;
    try {
      const instances = await current.instances;
      res.set("Cache-Control", "no-store");
      res.json({ instances });
    } catch (_error) {
      if (cached === current) cached = null;
      res.status(500).json({ error: "Collecte des agents impossible" });
    }
  });
  registerAgentSpeedtest(app, {
    readConfig,
    sanitizeReplication,
    sanitizeSyncUrl,
    request,
    token,
    timeout: speedtestTimeout,
    // The next read of the agents shows the new result.
    onDone: () => {
      cached = null;
    }
  });
  registerAgentTest(app, { sanitizeSyncUrl, request, assess, token, timeout, fetchAgent });
}
module.exports = { registerAgentRoutes };
