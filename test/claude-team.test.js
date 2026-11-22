"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { readTeamReport } = require("../supervisions/claude-team/report");

// Fake Claude Code folder, neutral values only: two open sessions (one
// running, one whose process is gone), three agents declared, subagent runs
// (one running, one finished, one old, one built-in) and a prompt-like secret
// that must never reach the report.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-team-test-"));
const claude = path.join(dir, ".claude");
const SECRET = "SECRET-PROMPT-TEXT";
const nowSeconds = () => Math.floor(Date.now() / 1000);
const iso = secondsAgo => new Date(Date.now() - secondsAgo * 1000).toISOString();
const lines = records => records.map(record => JSON.stringify(record)).join("\n") + "\n";
const touch = (file, secondsAgo) => {
  const time = new Date(Date.now() - secondsAgo * 1000);
  fs.utimesSync(file, time, time);
};
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const LIVE = "11111111-aaaa-4aaa-8aaa-111111111111";
const GONE = "22222222-bbbb-4bbb-8bbb-222222222222";
const sessionFile = (id, pid, extra) =>
  write(
    path.join(claude, "sessions", id + ".json"),
    JSON.stringify({
      pid,
      sessionId: id,
      cwd: "/work/demo-project",
      startedAt: Date.now() - 3600_000,
      statusUpdatedAt: Date.now() - 60_000,
      name: "session-" + id.slice(0, 4),
      kind: "interactive",
      status: "busy",
      ...extra
    })
  );
// process.pid is alive for the whole test; 2147483646 is above any pid_max.
sessionFile(LIVE, process.pid);
sessionFile(GONE, 2147483646);
write(
  path.join(claude, "projects", "-work-demo-project", LIVE + ".jsonl"),
  lines([
    { type: "user", message: { content: SECRET } },
    { type: "assistant", message: { model: "<synthetic>", content: [] } },
    { type: "assistant", message: { model: "model-old-9", content: [] } },
    { type: "assistant", message: { model: "claude-test-model-1", content: [{ text: SECRET }] } }
  ])
);
const run = (agentId, session, meta, records, secondsAgo) => {
  const base = path.join(claude, "projects", "-work-demo-project", session, "subagents");
  write(path.join(base, "agent-" + agentId + ".meta.json"), JSON.stringify(meta));
  write(path.join(base, "agent-" + agentId + ".jsonl"), lines(records));
  touch(path.join(base, "agent-" + agentId + ".jsonl"), secondsAgo);
};
const first = (secondsAgo, cwd = "/work/demo-project") => ({
  type: "user",
  timestamp: iso(secondsAgo),
  cwd,
  message: { content: SECRET + " " + "x".repeat(5000) }
});
const reply = (model, stop) => ({
  type: "assistant",
  message: { model, stop_reason: stop, content: [{ type: "text", text: SECRET }] }
});
// Running: parent alive, written 10 s ago, no end_turn.
run(
  "run1",
  LIVE,
  {
    agentType: "reviewer",
    description: "Check\u0007 the\n" + "very long title ".repeat(10),
    model: "alias-a",
    pickedEffortModel: "claude-fallback-0"
  },
  [first(300), reply("claude-test-model-2", "tool_use")],
  10
);
// Finished: end_turn as the last line.
run(
  "run2",
  LIVE,
  { agentType: "reviewer", description: "Second task", model: "alias-a" },
  [first(900, "/work/other-project"), reply("claude-test-model-2", "end_turn")],
  20
);
// Recent but its parent session is gone: not active.
run(
  "run3",
  GONE,
  { agentType: "builder", description: "Orphan task" },
  [first(500), reply("claude-test-model-3", "tool_use")],
  5
);
// Built-in agent, undeclared, written 10 minutes ago.
run(
  "run4",
  LIVE,
  { agentType: "Explore", isBuiltIn: true, description: "Look around" },
  [first(700), reply("claude-test-model-4", "end_turn")],
  600
);
// Older than 24 h: ignored.
run(
  "run5",
  LIVE,
  { agentType: "reviewer", description: "Ancient" },
  [first(200000), reply("claude-test-model-2", "end_turn")],
  100000
);
// Unreadable meta: skipped without failing the run.
const brokenBase = path.join(claude, "projects", "-work-demo-project", LIVE, "subagents");
write(path.join(brokenBase, "agent-broken.meta.json"), "{not json");
write(path.join(brokenBase, "agent-broken.jsonl"), "{}\n");
write(
  path.join(claude, "agents", "reviewer.md"),
  "---\nname: reviewer\nmodel: sonnet\ndescription: Reviews a change. " +
    "Long text ".repeat(30) +
    "\ntools: Read\n---\nBody with " +
    SECRET +
    "\n"
);
write(path.join(claude, "agents", "builder.md"), "---\r\nname: builder\r\nmodel: opus\r\n---\r\n");
write(path.join(claude, "agents", "idle-one.md"), "---\ndescription: No name, no model\n---\n");

try {
  const file = path.join(dir, "out", "claude-team.json");
  const script = path.join(__dirname, "..", "deploy", "claude-team.sh");
  const exec = extra =>
    spawnSync("sh", [script], {
      env: {
        PATH: process.env.PATH,
        HOME: dir,
        TMPDIR: dir,
        DASHMON_CLAUDE_TEAM_REPORT: file,
        ...extra
      },
      encoding: "utf8"
    });
  const ok = exec({});
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal((fs.statSync(file).mode & 0o777).toString(8), "600");
  const raw = fs.readFileSync(file, "utf8");
  assert.ok(!raw.includes(SECRET), "aucun contenu de conversation dans le rapport");
  assert.ok(!raw.includes("/work/"), "dossiers reduits a leur nom");
  assert.ok(!raw.includes(LIVE) && !raw.includes(GONE), "identifiant de session non exporte");
  const source = JSON.parse(raw);
  assert.equal(source.version, 1);
  assert.equal(source.scriptVersion, 1);
  assert.ok(Math.abs(source.generatedAt - nowSeconds()) < 5);

  // Sessions: only the one whose process lives, with the model of its log.
  assert.equal(source.sessions.length, 1);
  const [session] = source.sessions;
  assert.equal(session.project, "demo-project");
  assert.equal(session.status, "busy");
  assert.equal(session.model, "claude-test-model-1", "dernier modele assistant reel");
  assert.equal(session.name, "session-1111");
  assert.ok(Math.abs(session.since - (nowSeconds() - 3600)) < 5);
  assert.ok(Math.abs(session.statusSince - (nowSeconds() - 60)) < 5);

  // Team: declared first (with their configured model), then the others.
  const names = source.team.map(member => member.name);
  assert.deepEqual(names, ["builder", "idle-one", "reviewer", "Explore"]);
  const byName = Object.fromEntries(source.team.map(member => [member.name, member]));
  assert.equal(byName.reviewer.configuredModel, "sonnet");
  assert.equal(byName.builder.configuredModel, "opus", "fin de ligne CRLF toleree");
  assert.equal(byName["idle-one"].configuredModel, null, "champ absent = inconnu");
  assert.ok(byName.reviewer.description.length <= 80);
  assert.equal(byName.Explore.declared, false);
  assert.equal(byName.Explore.tasks24h, 1, "agent integre liste quand il a servi");

  // Active agent: role, model, title, project, since.
  assert.equal(byName.reviewer.active, true);
  assert.equal(byName.reviewer.tasks24h, 2, "tache de plus de 24 h ignoree");
  const task = byName.reviewer.task;
  assert.equal(task.project, "demo-project");
  assert.equal(task.model, "claude-test-model-2", "modele reel, pas l'alias configure");
  assert.ok(task.title.length <= 80 && task.title.endsWith("…"), "titre tronque");
  assert.ok(
    [...task.title].every(char => char.charCodeAt(0) > 31),
    "caracteres de controle supprimes"
  );
  assert.ok(task.title.startsWith("Check the very long"));
  assert.ok(Math.abs(task.since - (nowSeconds() - 300)) < 5);
  // A finished run, a run whose session is gone and an old run are inactive.
  assert.equal(byName.builder.active, false);
  assert.equal(byName.builder.task, null);
  assert.equal(byName.builder.tasks24h, 1);
  assert.equal(byName.Explore.active, false);

  // Latest tasks: newest first, the running one has no end.
  assert.deepEqual(
    source.recent.map(item => [item.agent, item.title === null ? null : item.title.slice(0, 5)]),
    [
      ["builder", "Orpha"],
      ["reviewer", "Check"],
      ["reviewer", "Secon"],
      ["Explore", "Look "]
    ]
  );
  assert.equal(source.recent[1].end, null);
  assert.equal(source.recent[2].project, "other-project");

  // The server reads it as the card does.
  const report = readTeamReport(file);
  assert.equal(report.team.find(member => member.name === "reviewer").task.title, task.title);
  assert.equal(report.sessions[0].project, "demo-project");

  // Titles off: the project only.
  const quiet = exec({ DASHMON_CLAUDE_TEAM_TITLES: "0" });
  assert.equal(quiet.status, 0, quiet.stderr);
  const hidden = fs.readFileSync(file, "utf8");
  assert.ok(
    !hidden.includes("Check") && !hidden.includes("Second") && !hidden.includes("session-1111")
  );
  const hiddenReport = JSON.parse(hidden);
  assert.equal(hiddenReport.team.find(member => member.name === "reviewer").task.title, null);
  assert.equal(
    hiddenReport.team.find(member => member.name === "reviewer").task.project,
    "demo-project"
  );
  assert.equal(hiddenReport.sessions[0].name, null);
  assert.ok(!hidden.includes("Reviews a change"), "description des agents retiree aussi");
  assert.ok(hiddenReport.recent.every(item => item.title === null && item.project));

  // Default mode: the summary is built in the Dashmon container; a fake
  // "docker" runs the commands of "docker exec" here.
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
    exec({
      PATH: bin + path.delimiter + process.env.PATH,
      DASHMON_CLAUDE_TEAM_REPORT: "",
      DASHMON_CLAUDE_TEAM_CONTAINER_PATH: inContainer,
      NODE_BIN: path.join(dir, "absent-node"),
      ...extra
    });
  const viaContainer = docker({});
  assert.equal(viaContainer.status, 0, viaContainer.stderr);
  const contained = readTeamReport(inContainer);
  assert.deepEqual(
    contained.team.map(member => [member.name, member.active]),
    [
      ["builder", false],
      ["idle-one", false],
      ["reviewer", true],
      ["Explore", false]
    ]
  );
  const noContainer = docker({ DASHMON_CONTAINER: "other" });
  assert.notEqual(noContainer.status, 0);
  assert.match(noContainer.stderr, /container 'other' not found/);

  const noNode = exec({ NODE_BIN: path.join(dir, "absent-node"), PATH: "/usr/bin:/bin" });
  assert.notEqual(noNode.status, 0, "variante sur l'hote sans node");
  assert.match(noNode.stderr, /needs Node\.js/);

  // Nothing to report yet: still a valid, empty summary; no Claude folder: an error.
  fs.rmSync(file);
  const missing = exec({ CLAUDE_CONFIG_DIR: path.join(dir, "absent") });
  assert.notEqual(missing.status, 0);
  assert.ok(!fs.existsSync(file));
  const emptyDir = path.join(dir, "empty");
  fs.mkdirSync(emptyDir);
  assert.equal(exec({ CLAUDE_CONFIG_DIR: emptyDir }).status, 0);
  const empty = readTeamReport(file);
  assert.deepEqual([empty.sessions, empty.team, empty.recent], [[], [], []]);

  // The server bounds what it reads.
  const hostile = path.join(dir, "hostile.json");
  fs.writeFileSync(
    hostile,
    JSON.stringify({
      generatedAt: 1700000000,
      sessions: [{ project: "p<b>", status: "BUSY", since: "x" }, "bad", null],
      team: [
        { name: "a".repeat(500), active: true, task: { title: "t".repeat(500) }, tasks24h: -3 },
        { name: "" },
        { name: "off", active: false, task: { title: "ghost" } }
      ],
      recent: [{ agent: "a", title: 3, start: -1 }, { title: "no agent" }]
    })
  );
  const bounded = readTeamReport(hostile);
  assert.equal(bounded.sessions.length, 1);
  assert.deepEqual(
    [bounded.sessions[0].project, bounded.sessions[0].status, bounded.sessions[0].since],
    ["pb", "busy", null]
  );
  assert.equal(bounded.team.length, 2);
  assert.equal(bounded.team[0].name.length, 60);
  assert.equal(bounded.team[0].task.title.length, 80);
  assert.equal(bounded.team[0].tasks24h, 0);
  assert.equal(bounded.team[1].task, null, "pas de tache pour un agent inactif");
  assert.deepEqual(bounded.recent, [
    { agent: "a", title: null, project: null, model: null, start: null, end: null }
  ]);
  assert.equal(readTeamReport(path.join(dir, "absent.json")), null);
  fs.writeFileSync(hostile, "{broken");
  assert.equal(readTeamReport(hostile), null);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS Equipe Claude : script de collecte et lecture du rapport");

// What the card says about a report (no DOM).
import("../supervisions/claude-team/view.mjs").then(view => {
  const now = 1_800_000_000;
  const report = (generatedAt, team = [], sessions = []) => ({ generatedAt, team, sessions });
  assert.equal(view.sessionState("busy"), "working");
  assert.equal(view.sessionState("idle"), "waiting");
  assert.equal(view.sessionState("something-new"), "unknown");
  assert.equal(view.sessionState(null), "unknown");
  assert.deepEqual(view.health(report(now - 600), now), { level: "unknown", key: "idle" });
  assert.deepEqual(view.health(report(now - 601), now), { level: "warning", key: "stale" });
  assert.deepEqual(view.health(report(0), now), { level: "warning", key: "stale" });
  assert.deepEqual(view.health(report(now - 30, [{ active: true }]), now), {
    level: "healthy",
    key: "summary"
  });
  assert.deepEqual(view.counts(report(now, [{ active: true }, { active: false }], [{}, {}])), {
    sessions: 2,
    agents: 1
  });
  assert.deepEqual([5, 59, 60, 725, 3 * 3600 + 300, 3 * 86400].map(view.durationText), [
    "5 s",
    "59 s",
    "1 min",
    "12 min",
    "3 h 05",
    "3 d"
  ]);
  assert.deepEqual(
    view
      .orderedTeam([
        { name: "z", declared: true, active: false },
        { name: "b", declared: false, active: false },
        { name: "a", declared: true, active: false },
        { name: "y", declared: true, active: true }
      ])
      .map(member => member.name),
    ["y", "a", "z", "b"]
  );
  console.log("PASS Equipe Claude : lecture de l'etat par la carte");
});
