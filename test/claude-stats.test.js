"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { readUsageReport } = require("../lib/host/usage-report");

// Fake Claude Code session logs: a reply streamed in two parts, a tool call
// that failed, a typed prompt, a tool result, a command output and an older
// session.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-claude-test-"));
const projects = path.join(dir, ".claude", "projects", "-projet");
fs.mkdirSync(path.join(projects, "s1", "subagents"), { recursive: true });
const now = new Date().toISOString();
const old = new Date(Date.now() - 40 * 86400000).toISOString();
const usage = {
  input_tokens: 3,
  output_tokens: 50,
  output_tokens_details: { thinking_tokens: 20 },
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200
};
const lines = records => records.map(record => JSON.stringify(record)).join("\n") + "\n";
fs.writeFileSync(
  path.join(projects, "s1.jsonl"),
  lines([
    { type: "mode", sessionId: "s1" },
    {
      type: "user",
      sessionId: "s1",
      timestamp: now,
      version: "2.1.9",
      message: { content: "Bonjour" }
    },
    { type: "user", sessionId: "s1", timestamp: now, isMeta: true, message: { content: "note" } },
    {
      type: "user",
      sessionId: "s1",
      timestamp: now,
      message: { content: "<local-command-stdout>ok</local-command-stdout>" }
    },
    {
      type: "assistant",
      sessionId: "s1",
      timestamp: now,
      message: { id: "m1", model: "modele-a", usage, content: [{ type: "thinking" }] }
    },
    {
      type: "assistant",
      sessionId: "s1",
      timestamp: now,
      message: {
        id: "m1",
        model: "modele-a",
        usage,
        content: [{ type: "tool_use", id: "t1", name: "Bash" }]
      }
    },
    {
      type: "user",
      sessionId: "s1",
      timestamp: now,
      message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true }] }
    },
    {
      type: "assistant",
      sessionId: "s1",
      timestamp: now,
      message: { id: "m2", model: "<synthetic>", usage, content: [] }
    }
  ])
);
fs.writeFileSync(
  path.join(projects, "s1", "subagents", "agent-1.jsonl"),
  lines([
    {
      type: "assistant",
      sessionId: "s1",
      isSidechain: true,
      timestamp: now,
      message: { id: "m3", model: "modele-b", usage: { input_tokens: 7 }, content: [] }
    }
  ])
);
fs.writeFileSync(
  path.join(projects, "s0.jsonl"),
  lines([
    {
      type: "user",
      sessionId: "s0",
      timestamp: old,
      version: "1.0.0",
      message: { content: "Ancien" }
    },
    {
      type: "assistant",
      sessionId: "s0",
      timestamp: old,
      message: { id: "m0", model: "modele-a", usage: { input_tokens: 1 }, content: [] }
    }
  ])
);

try {
  const file = path.join(dir, "out", "claude.json");
  const run = extra =>
    spawnSync("sh", [path.join(__dirname, "..", "deploy", "claude-stats.sh")], {
      env: {
        PATH: process.env.PATH,
        HOME: dir,
        TMPDIR: dir,
        DASHMON_CLAUDE_REPORT: file,
        ...extra
      },
      encoding: "utf8"
    });
  const ok = run({});
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal((fs.statSync(file).mode & 0o777).toString(8), "600");
  const report = readUsageReport(file);
  assert.equal(report.version, "2.1.9", "version la plus recente");
  assert.deepEqual(Object.keys(report.periods), ["today", "week", "month", "all"]);
  const today = report.periods.today;
  assert.equal(today.sessions, 1);
  assert.equal(today.subagents, 1);
  assert.equal(today.prompts, 1, "seule la requete tapee compte");
  assert.equal(today.steps, 2, "reponse en deux parties comptee une fois, synthetique ecartee");
  assert.equal(today.cost, 0);
  assert.deepEqual(today.tokens, {
    input: 10,
    output: 30,
    reasoning: 20,
    cacheRead: 1000,
    cacheWrite: 200
  });
  assert.deepEqual(today.models.map(model => [model.id, model.provider, model.steps]).sort(), [
    ["modele-a", "anthropic", 1],
    ["modele-b", "anthropic", 1]
  ]);
  assert.deepEqual(today.tools, [{ name: "Bash", calls: 1, failed: 1 }]);
  assert.equal(today.streak, 1);
  const all = report.periods.all;
  assert.equal(all.sessions, 2);
  assert.equal(all.prompts, 2);
  assert.equal(all.activeDays, 2);
  assert.equal(report.periods.month.sessions, 1, "session ancienne hors des 30 jours");

  // Default mode: no Node.js on the host, the counting runs in the Dashmon
  // container. A fake "docker" runs the commands of "docker exec" here.
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "docker"),
    `#!/bin/sh
case "$1" in
  inspect) [ "$2" = dashmon ] ;;
  exec) shift 3; exec "$@" ;;
  *) exit 1 ;;
esac
`,
    { mode: 0o755 }
  );
  const inContainer = path.join(dir, "out", "container.json");
  const docker = extra =>
    run({
      PATH: bin + path.delimiter + process.env.PATH,
      DASHMON_CLAUDE_REPORT: "",
      DASHMON_CLAUDE_CONTAINER_PATH: inContainer,
      NODE_BIN: path.join(dir, "absent-node"),
      ...extra
    });
  const viaContainer = docker({});
  assert.equal(viaContainer.status, 0, viaContainer.stderr);
  assert.deepEqual(
    readUsageReport(inContainer).periods,
    report.periods,
    "meme releve par le conteneur que par le node local"
  );
  const noContainer = docker({ DASHMON_CONTAINER: "autre" });
  assert.notEqual(noContainer.status, 0);
  assert.match(noContainer.stderr, /container 'autre' not found/);

  const noNode = run({ NODE_BIN: path.join(dir, "absent-node"), PATH: "/usr/bin:/bin" });
  assert.notEqual(noNode.status, 0, "variante sur l'hote sans node");
  assert.match(noNode.stderr, /needs Node\.js/);

  fs.rmSync(file);
  const missing = run({ CLAUDE_CONFIG_DIR: path.join(dir, "absent") });
  assert.notEqual(missing.status, 0, "pas de relevé sans journaux");
  assert.ok(!fs.existsSync(file));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS Claude Code : script de collecte des journaux de session");
