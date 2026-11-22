"use strict";
const { apiError } = require("../http/api-errors");

// Main dashboard side of the agents.
//
//   GET  /api/replication/metrics  metrics of every paired agent
//   POST /api/agents/test          pairs one agent if needed and checks that it
//                                  answers (see lib/agent/pairing.js)
//   GET/PUT /api/agents/config     settings of an already saved agent
//   POST /api/agents/speedtest     speed test now, on an already saved agent
//
// Agents never receive the dashboard configuration, only their own local
// monitoring settings. Each agent has its own token, obtained at the pairing
// and kept server-side (agentPairing.withToken): nobody types it, and an agent
// only ever receives its own.

// Why a call to an agent failed, as the editor and the supervision page show it.
function failureReason(error) {
  if (error.reason) return error.reason;
  return error.status === 401 ? "unauthorized" : "unreachable";
}

// Speed test now on a saved agent. Same rule as the agent settings: saved
// peers only, fixed path.
function registerAgentSpeedtest(
  app,
  { readConfig, sanitizeReplication, sanitizeSyncUrl, request, agentPairing, timeout, onDone }
) {
  app.post("/api/agents/speedtest", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const url = typeof req.body?.url === "string" ? sanitizeSyncUrl(req.body.url) : "";
    const peers = sanitizeReplication(readConfig().replication).secondaries;
    if (!url || !peers.includes(url))
      return res.status(404).json({ ...apiError("agent_not_paired") });
    try {
      const payload = await agentPairing.withToken(url, token =>
        request(url, "/api/sync/speedtest", {
          method: "POST",
          timeout,
          headers: { "X-Dashmon-Sync-Token": token }
        })
      );
      onDone();
      res.json({ result: payload?.result || null });
    } catch (error) {
      if (error.status === 429) return res.status(429).json({ error: "speedtest_too_soon" });
      if (error.status === 404) return res.status(404).json({ error: "speedtest_disabled" });
      res.status(502).json({ error: "speedtest_unreachable" });
    }
  });
}

// Connection test of an address, saved or not yet: it pairs the agent when
// this dashboard has no token for it. The address may be a typo: the pairing
// first checks, without any token, that it answers as a Dashmon agent.
function registerAgentTest(app, { sanitizeSyncUrl, assess, agentPairing, fetchAgent }) {
  app.post("/api/agents/test", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const url = sanitizeSyncUrl(typeof req.body?.url === "string" ? req.body.url : "");
    if (!url) return res.status(400).json({ ok: false, reason: "invalid_url" });
    try {
      const payload = await agentPairing.withToken(url, token => fetchAgent(url, token));
      const assessment = assess(payload);
      if (assessment.status === "unavailable")
        return res.status(502).json({ ok: false, reason: assessment.reason });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(502).json({ ok: false, reason: failureReason(error) });
    }
  });
}

// Settings of a saved agent, read or written through this dashboard.
// Fixed endpoint, saved peers only: this must never become a generic proxy.
function registerAgentConfigProxy(
  app,
  { readConfig, sanitizeReplication, sanitizeSyncUrl, request, agentPairing, timeout }
) {
  async function agentConfig(req, res) {
    res.set("Cache-Control", "no-store");
    const target = req.method === "GET" ? req.query.url : req.body?.url;
    const url = typeof target === "string" ? sanitizeSyncUrl(target) : "";
    const peers = sanitizeReplication(readConfig().replication).secondaries;
    if (!url || !peers.includes(url))
      return res.status(404).json({ ...apiError("agent_not_paired") });
    const write = req.method === "PUT";
    if (write && (typeof req.body?.revision !== "string" || !req.body.revision)) {
      return res.status(428).json({ ...apiError("revision_required") });
    }
    if (
      write &&
      (!req.body.config ||
        typeof req.body.config.name !== "string" ||
        !req.body.config.monitoring ||
        typeof req.body.config.monitoring !== "object" ||
        Array.isArray(req.body.config.monitoring))
    ) {
      return res.status(400).json({ ...apiError("invalid_agent_config") });
    }
    try {
      const result = await agentPairing.withToken(url, token =>
        request(url, "/api/agent/config", {
          method: write ? "PUT" : "GET",
          timeout,
          raw: true,
          headers: {
            "X-Dashmon-Sync-Token": token,
            ...(write ? { "Content-Type": "application/json", "If-Match": req.body.revision } : {})
          },
          ...(write ? { body: req.body.config } : {})
        })
      );
      const payload = JSON.parse(result.body);
      if (
        !result.headers.etag ||
        (!write &&
          (!payload?.monitoring ||
            typeof payload.monitoring !== "object" ||
            Array.isArray(payload.monitoring) ||
            typeof payload.name !== "string"))
      ) {
        return res.status(502).json({ ...apiError("invalid_agent_response") });
      }
      res.json({ config: payload, revision: result.headers.etag });
    } catch (error) {
      if (error.status === 412)
        return res.status(412).json({ ...apiError("agent_config_conflict") });
      res.status(502).json({ ...apiError("agent_config_unreachable") });
    }
  }
  app.get("/api/agents/config", agentConfig);
  app.put("/api/agents/config", agentConfig);
}

function registerAgentRoutes(
  app,
  {
    readConfig,
    sanitizeReplication,
    sanitizeSyncUrl,
    request,
    assess,
    compareVersion = () => null,
    ownVersion = null,
    agentPairing,
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
  const fetchAgent = (url, token) =>
    request(url, "/api/sync/metrics", {
      timeout,
      headers: { "X-Dashmon-Sync-Token": token }
    });

  registerAgentConfigProxy(app, {
    readConfig,
    sanitizeReplication,
    sanitizeSyncUrl,
    request,
    agentPairing,
    timeout
  });
  async function collect(replication) {
    for (const url of lastSuccess.keys())
      if (!replication.secondaries.includes(url)) lastSuccess.delete(url);
    return Promise.all(
      replication.secondaries.map(async url => {
        try {
          const payload = await agentPairing.withToken(url, token => fetchAgent(url, token));
          const assessment = assess(payload, { lastSuccessAt: lastSuccess.get(url) || null });
          if (assessment.status === "available") lastSuccess.set(url, assessment.lastSuccessAt);
          if (assessment.status === "unavailable")
            return {
              url,
              ok: false,
              ...apiError("instance_unreachable"),
              hosts: [],
              ...assessment
            };
          // An agent on another build than this dashboard may lack a card or a
          // setting: the supervision page says so.
          const versionCheck = compareVersion(ownVersion, payload.agent?.version);
          return { url, ok: true, hosts: payload.hosts, ...assessment, versionCheck };
        } catch (error) {
          return {
            url,
            ok: false,
            status: "unavailable",
            reason: failureReason(error),
            lastSuccessAt: lastSuccess.get(url) || null,
            ...apiError("instance_unreachable"),
            hosts: []
          };
        }
      })
    );
  }
  // Metrics of every paired agent, shared with the widgets that read them.
  function readAgents() {
    const replication = sanitizeReplication(readConfig().replication);
    if (replication.role !== "primary") return Promise.resolve([]);
    // A change of the agent list makes the cached answer stale at once.
    const key = JSON.stringify(replication.secondaries);
    if (!cached || cached.key !== key || now() - cached.at >= cacheMs) {
      cached = { key, at: now(), instances: collect(replication) };
    }
    const current = cached;
    return current.instances.catch(error => {
      if (cached === current) cached = null;
      throw error;
    });
  }
  app.get("/api/replication/metrics", async (_req, res) => {
    const replication = sanitizeReplication(readConfig().replication);
    if (replication.role !== "primary") return res.json({ instances: [] });
    try {
      const instances = await readAgents();
      res.set("Cache-Control", "no-store");
      res.json({ instances });
    } catch (_error) {
      res.status(500).json({ ...apiError("agents_collect_failed") });
    }
  });
  registerAgentSpeedtest(app, {
    readConfig,
    sanitizeReplication,
    sanitizeSyncUrl,
    request,
    agentPairing,
    timeout: speedtestTimeout,
    // The next read of the agents shows the new result.
    onDone: () => {
      cached = null;
    }
  });
  registerAgentTest(app, { sanitizeSyncUrl, assess, agentPairing, fetchAgent });
  return { readAgents };
}
module.exports = { registerAgentRoutes };
