"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { readUsageReport } = require("../lib/host/usage-report");

function read(raw, size = 100) {
  const filesystem = {
    statSync: () => ({ isFile: () => true, size, mtimeMs: 100000 }),
    readFileSync: () => JSON.stringify(raw)
  };
  return readUsageReport("report", { filesystem });
}
const period = {
  sessions: 2,
  prompts: 108,
  steps: 1313,
  cost: 1.23456,
  tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 900, write: 3 } },
  activeDays: 3,
  streak: 2,
  activity: [
    { date: "2026-10-28", steps: 439 },
    { date: "<img>", steps: 1 }
  ],
  tools: {
    usage: [
      { name: "shell", calls: 842, failed: 2 },
      { name: "idle", calls: 0 }
    ]
  },
  models: [
    {
      model: { id: "modele-a", providerID: "fournisseur", variant: "default" },
      steps: 619,
      tokens: { input: 8, output: 1, cache: { read: 7 } },
      cost: 1
    },
    {
      model: { id: "modele-a", providerID: "fournisseur" },
      steps: 1,
      tokens: { input: 2 },
      cost: 0.5
    },
    { model: { id: "modele-b", providerID: "autre" }, steps: 0, tokens: {} },
    { model: { providerID: "sans-id" }, steps: 4 }
  ]
};
const report = read({
  updatedAt: 1700000000,
  version: "2.2.0",
  periods: { month: period, all: "x" }
});
assert.equal(report.fetchedAt, 1700000000);
assert.equal(report.version, "2.2.0");
assert.deepEqual(Object.keys(report.periods), ["month"], "periode invalide ignoree");
const month = report.periods.month;
assert.deepEqual(month.tokens, {
  input: 10,
  output: 20,
  reasoning: 5,
  cacheRead: 900,
  cacheWrite: 3
});
assert.equal(month.cost, 1.2346);
assert.deepEqual(month.activity, [{ date: "2026-10-28", steps: 439 }], "date invalide ecartee");
assert.deepEqual(month.tools, [{ name: "shell", calls: 842, failed: 2 }], "outil inutilise ecarte");
// Variants of one model are added up; unused or nameless models are dropped.
assert.deepEqual(month.models, [
  {
    id: "modele-a",
    provider: "fournisseur",
    steps: 620,
    cost: 1.5,
    tokens: { input: 10, output: 1, reasoning: 0, cacheRead: 7, cacheWrite: 0 }
  }
]);
assert.equal(read({ periods: {} }), null);
assert.equal(read({ periods: { month: period } }, 2_000_001), null);
assert.equal(read({ periods: { month: period } }).fetchedAt, 100, "date du fichier par defaut");

// Collection script, with a stand-in for the opencode binary.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-opencode-test-"));
const bin = path.join(dir, "bin");
fs.mkdirSync(bin);
fs.writeFileSync(
  path.join(bin, "opencode"),
  `#!/bin/sh
if [ "$1" = --version ]; then printf 'opencode v9.8.7\\n'; exit 0; fi
if [ "$TEST_FAILURE" = 1 ]; then printf 'Error: service down\\n'; exit 1; fi
printf '{"steps":%s,"tokens":{"input":1},"models":[]}' "$(printf '%s' "$*" | wc -c)"
`,
  { mode: 0o755 }
);
try {
  const file = path.join(dir, "out", "opencode.json");
  const run = extra =>
    spawnSync("sh", [path.join(__dirname, "..", "deploy", "opencode-stats.sh")], {
      env: {
        PATH: bin + path.delimiter + process.env.PATH,
        HOME: dir,
        TMPDIR: dir,
        DASHMON_OPENCODE_REPORT: file,
        ...extra
      },
      encoding: "utf8"
    });
  const ok = run({});
  assert.equal(ok.status, 0, ok.stderr);
  const written = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(written.version, "9.8.7");
  assert.deepEqual(Object.keys(written.periods), ["today", "week", "month", "all"]);
  assert.equal((fs.statSync(file).mode & 0o777).toString(8), "600");
  assert.ok(readUsageReport(file).periods.all, "relevé du script relu par le serveur");

  fs.rmSync(file);
  const failed = run({ TEST_FAILURE: "1" });
  assert.notEqual(failed.status, 0, "pas de relevé sans JSON");
  assert.ok(!fs.existsSync(file));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS OpenCode : lecture du relevé et script de collecte");
