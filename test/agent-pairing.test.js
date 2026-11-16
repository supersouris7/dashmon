"use strict";
// Automatic pairing, both sides, on real HTTP: the agent generates its token,
// the main dashboard keeps it without anyone typing it.
const assert = require("assert");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAgentToken } = require("../lib/agent/agent-token");
const { AgentTokenStore, MAX_TOKENS, importConfigTokens } = require("../lib/agent/token-store");
const { createAgentPairing } = require("../lib/agent/pairing");
const { createSecretCodec } = require("../lib/config/secrets");
const { apiRequest } = require("../lib/http/client");

const quiet = { info() {}, warn() {} };
const codec = createSecretCodec("0123456789abcdef0123456789abcdef");

// A minimal agent: /readyz, the pairing route and one protected route.
async function startAgent(dataDir, pairingKey = "") {
  const agentToken = createAgentToken({ dataDir, pairingKey, log: quiet });
  const app = express();
  app.get("/readyz", (_req, res) => res.json({ ok: true, role: "agent" }));
  app.post("/api/sync/pair", agentToken.pairHandler);
  app.get("/api/sync/metrics", (req, res) =>
    agentToken.valid(req) ? res.json({ ok: true }) : res.status(401).json({})
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/`, agentToken };
}

function newStore(dataDir) {
  return new AgentTokenStore({
    dataDir,
    encryptSecret: codec.encryptSecret,
    decryptSecret: codec.decryptSecret
  });
}

const pair = (url, token) =>
  apiRequest(url, "/api/sync/pair", {
    method: "POST",
    headers: token ? { "X-Dashmon-Sync-Token": token } : {}
  });
const status = promise => promise.then(() => 200).catch(error => error.status);
const metrics = (url, token) =>
  apiRequest(url, "/api/sync/metrics", { headers: { "X-Dashmon-Sync-Token": token } });

async function agentSide(dir) {
  // No pairing key: the first dashboard gets the token.
  const open = await startAgent(fs.mkdtempSync(path.join(dir, "open-")));
  try {
    assert.equal(open.agentToken.paired(), false);
    assert.equal(await status(metrics(open.url, "")), 401, "nothing accepted before pairing");
    const { token } = await pair(open.url);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(open.agentToken.paired(), true);
    assert.equal(await status(metrics(open.url, token)), 200);
    // Another dashboard cannot take it over...
    assert.equal(await status(pair(open.url)), 409);
    assert.equal(await status(pair(open.url, "x".repeat(43))), 409);
    // ...but the holder may ask for a new token, which replaces the old one.
    const renewed = (await pair(open.url, token)).token;
    assert.notEqual(renewed, token);
    assert.equal(await status(metrics(open.url, token)), 401);
    assert.equal(await status(metrics(open.url, renewed)), 200);
  } finally {
    open.server.close();
  }

  // With DASHMON_SYNC_TOKEN: a pairing key, and the token until the pairing.
  const keyDir = fs.mkdtempSync(path.join(dir, "key-"));
  const keyed = await startAgent(keyDir, "cle-commune");
  try {
    assert.equal(await status(metrics(keyed.url, "cle-commune")), 200);
    assert.equal(await status(pair(keyed.url)), 409, "the key is required to pair");
    const { token } = await pair(keyed.url, "cle-commune");
    assert.equal(await status(metrics(keyed.url, "cle-commune")), 401, "key retired");
    assert.equal(await status(metrics(keyed.url, token)), 200);
    const file = path.join(keyDir, "agent-token");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    // Deleting the file unpairs the agent at once, without a restart.
    fs.unlinkSync(file);
    assert.equal(await status(metrics(keyed.url, token)), 401);
    assert.equal(await status(metrics(keyed.url, "cle-commune")), 200);
  } finally {
    keyed.server.close();
  }
  console.log("PASS appairage (agent) : premier venu, cle d'appairage, renouvellement, liberation");
}

async function dashboardSide(dir) {
  const agentDir = fs.mkdtempSync(path.join(dir, "agent-"));
  const agent = await startAgent(agentDir);
  const dataDir = fs.mkdtempSync(path.join(dir, "dashboard-"));
  const store = newStore(dataDir);
  const pairing = createAgentPairing({ store, request: apiRequest, timeout: 2000 });
  try {
    // Concurrent first calls share one pairing (a second would get 409).
    const results = await Promise.all(
      [1, 2, 3].map(() => pairing.withToken(agent.url, token => metrics(agent.url, token)))
    );
    assert.ok(results.every(result => result.ok));
    const token = store.get(agent.url);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const onDisk = fs.readFileSync(path.join(dataDir, "agent-tokens.json"), "utf8");
    assert.equal(onDisk.includes(token), false, "encrypted at rest");
    assert.equal(fs.statSync(path.join(dataDir, "agent-tokens.json")).mode & 0o777, 0o600);
    // Saved: a restart of the dashboard reuses it.
    assert.equal(newStore(dataDir).get(agent.url), token);

    // The agent was reset (agent-token deleted): the next call pairs again.
    fs.unlinkSync(path.join(agentDir, "agent-token"));
    const again = await pairing.withToken(agent.url, t => metrics(agent.url, t));
    assert.ok(again.ok);
    assert.notEqual(store.get(agent.url), token);

    // Paired with another dashboard meanwhile: said as such.
    const other = createAgentPairing({
      store: newStore(fs.mkdtempSync(path.join(dir, "other-"))),
      request: apiRequest,
      timeout: 2000
    });
    await assert.rejects(
      other.withToken(agent.url, t => metrics(agent.url, t)),
      error => error.reason === "already_paired"
    );
  } finally {
    agent.server.close();
  }

  // Not an agent: no token is ever sent to it.
  const seen = [];
  const impostor = express();
  impostor.use((req, res) => {
    if (req.get("X-Dashmon-Sync-Token")) seen.push(req.path);
    res.json({ ok: true, role: "primary" });
  });
  const impostorServer = impostor.listen(0, "127.0.0.1");
  await new Promise(resolve => impostorServer.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${impostorServer.address().port}/`;
    const shared = createAgentPairing({
      store: newStore(fs.mkdtempSync(path.join(dir, "shared-"))),
      request: apiRequest,
      timeout: 2000,
      fallbackToken: "cle-commune"
    });
    await assert.rejects(
      shared.withToken(url, t => metrics(url, t)),
      error => error.reason === "not_agent"
    );
    assert.deepEqual(seen, []);
  } finally {
    impostorServer.close();
  }
  console.log("PASS appairage (principal) : jeton obtenu, chiffre, reappairage, faux agent");
}

function storeBounds(dir) {
  const store = newStore(fs.mkdtempSync(path.join(dir, "bound-")));
  const keep = "http://192.0.2.1/";
  store.set(keep, "jeton");
  for (let i = 0; i < MAX_TOKENS + 5; i++) store.set(`http://198.51.100.${i}/`, "t", [keep]);
  assert.equal(store.tokens.size, MAX_TOKENS);
  assert.equal(store.get(keep), "jeton", "a paired agent's token is never dropped");

  // Tokens kept in config.json by the previous version move to the store.
  const configDir = fs.mkdtempSync(path.join(dir, "config-"));
  let config = {
    replication: {
      secondaries: [keep],
      agentTokens: { [keep]: codec.encryptSecret("ancien") }
    }
  };
  const repository = { read: () => structuredClone(config), write: next => (config = next) };
  const moved = newStore(configDir);
  assert.equal(importConfigTokens(repository, moved), 1);
  assert.equal(moved.get(keep), "ancien");
  assert.equal("agentTokens" in config.replication, false);
  assert.equal(importConfigTokens(repository, moved), 0);
  console.log("PASS appairage : borne du stockage, reprise depuis config.json");
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-pairing-"));
  try {
    await agentSide(dir);
    await dashboardSide(dir);
    storeBounds(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
