"use strict";
// OpenCode widget: report source (automatic, local, agent), check and tile.
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { createUsageSource } = require("../lib/host/usage-source");
const widget = require("../widgets/opencode/server");

const AGENT = "http://192.0.2.30:8080/";
const OTHER = "http://192.0.2.31:8080/";
const nowSeconds = () => Math.floor(Date.now() / 1000);

function report(todayTokens, monthTokens, fetchedAt = nowSeconds()) {
  const period = (tokens, models = []) => ({
    sessions: 3,
    cost: 1.5,
    tokens: { input: tokens, output: 0, reasoning: 0 },
    models
  });
  return {
    fetchedAt,
    periods: {
      today: period(todayTokens),
      month: period(monthTokens, [
        { id: "small", tokens: { input: 10 } },
        { id: "big", tokens: { input: 5, output: 500 } }
      ])
    }
  };
}

const config = {
  hosts: [
    { id: "h-nas", name: "NAS" },
    { id: "h-pi", name: "Pi" }
  ],
  replication: {
    role: "primary",
    secondaries: [AGENT, OTHER],
    agentNames: { [AGENT]: "NAS agent" },
    agentHosts: { [AGENT]: "h-nas" }
  }
};
let agents = [
  { url: AGENT, ok: true, hosts: [{ opencode: report(200, 9000) }] },
  { url: OTHER, ok: false, hosts: [] }
];
let local = report(100, 4000);
const source = createUsageSource({
  readConfig: () => structuredClone(config),
  readLocal: kind => (kind === "opencode" ? local : null),
  readAgents: async () => agents,
  sanitizeReplication: value => value
});

function ctx(host, service) {
  return {
    config: { type: "opencode", host },
    service,
    supervision: source,
    sanitizeText: (value, max) => String(value || "").slice(0, max),
    t: key => key
  };
}

(async () => {
  // Automatic: the agent paired with the host of the tile...
  let result = await source.usageReport("opencode", "", { host: "NAS" });
  assert.equal(result.source, "agent");
  assert.equal(result.name, "NAS agent");
  assert.equal(result.report.periods.today.tokens.input, 200);
  // ...this instance for a tile without host or with an unpaired host...
  assert.equal((await source.usageReport("opencode", "", { host: "Pi" })).source, "local");
  assert.equal((await source.usageReport("opencode", "", {})).source, "local");
  // ...and this instance when the agent has no report.
  agents = [{ url: AGENT, ok: true, hosts: [{}] }];
  assert.equal((await source.usageReport("opencode", "", { host: "NAS" })).source, "local");
  agents = [
    { url: AGENT, ok: true, hosts: [{ opencode: report(200, 9000) }] },
    { url: OTHER, ok: false, hosts: [] }
  ];

  // Explicit choices: local, a paired agent, never another address.
  assert.equal((await source.usageReport("opencode", "local", { host: "NAS" })).source, "local");
  assert.equal((await source.usageReport("opencode", AGENT, {})).name, "NAS agent");
  assert.equal((await source.usageReport("opencode", OTHER, {})).unreachable, true);
  assert.equal((await source.usageReport("opencode", "http://198.51.100.9/", {})).unpaired, true);
  await assert.rejects(source.usageReport("../etc", "", {}));

  // Check: tokens of today and of 30 days, main model by tokens.
  result = await widget.check(ctx("local", {}));
  assert.deepEqual(
    {
      found: result.found,
      today: result.today.tokens,
      month: result.month.tokens,
      model: result.model,
      stale: result.stale
    },
    { found: true, today: 100, month: 4000, model: "big", stale: false }
  );
  local = report(1, 2, nowSeconds() - 7 * 3600);
  assert.equal((await widget.check(ctx("local", {}))).stale, true);
  local = null;
  assert.deepEqual(await widget.check(ctx("local", {})), {
    ok: true,
    source: "local",
    hostName: "",
    found: false
  });
  assert.equal((await widget.check(ctx("http://198.51.100.9/", {}))).error, "unpaired");
  assert.equal((await widget.check(ctx(OTHER, {}))).error, "unreachable");

  // Tile.
  const { render } = await import(
    pathToFileURL(path.join(__dirname, "..", "widgets", "opencode", "client.mjs")).href
  );
  const view = info =>
    render({
      info,
      lang: "en",
      t: key => key,
      formatCompactNumber: n => String(n),
      formatDateTime: () => "date"
    });
  const fresh = view({
    found: true,
    source: "agent",
    hostName: "NAS agent",
    fetchedAt: Date.now(),
    stale: false,
    today: { tokens: 245, sessions: 2 },
    month: { tokens: 5400, sessions: 40, cost: 3 },
    model: "big"
  });
  assert.equal(fresh.badge, "245 tokens");
  assert.equal(fresh.badgeClass, "ok");
  assert.equal(fresh.time, "days30 5400 · big");
  assert.match(fresh.title, /via NAS agent/);
  assert.match(fresh.title, /\$3/);
  const old = view({ found: true, stale: true, fetchedAt: 1, today: {}, month: {} });
  assert.equal(old.badgeClass, "pending");
  assert.match(old.title, /stale · reportOf date/);
  const missing = view({ found: false, source: "local" });
  assert.equal(missing.badge, "noReport");
  assert.match(missing.title, /noReportHint/);
  assert.equal(view(null).badgeClass, "pending");

  console.log("PASS widget OpenCode : source automatique, locale ou agent, tuile");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
