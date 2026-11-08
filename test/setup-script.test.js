"use strict";
// deploy/setup.sh: installs a script with its cron line, migrates a line
// written by hand, updates and removes. Runs with stub crontab and docker,
// in a temporary folder; downloads come from deploy/ through file://.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFileSync } = require("child_process");

const DEPLOY = path.join(__dirname, "..", "deploy");
const SETUP = path.join(DEPLOY, "setup.sh");

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-setup-"));
  try {
    const stub = path.join(dir, "stub");
    const bin = path.join(dir, "bin");
    const cron = path.join(dir, "cron");
    for (const folder of [stub, bin, cron]) fs.mkdirSync(folder);
    fs.writeFileSync(
      path.join(stub, "crontab"),
      [
        "#!/bin/sh",
        'u=root; [ "$1" = -u ] && { u=$2; shift 2; }',
        'f="$CRONTAB_DIR/$u"',
        // A file argument, as the tool writes; no terminal, no editor.
        '[ -t 0 ] && { echo "crontab got a terminal" >&2; exit 9; }',
        '[ "$EDITOR" = false ] || { echo "editor not neutralised" >&2; exit 9; }',
        'case "$1" in -l) [ -f "$f" ] && cat "$f" || exit 1 ;; -) exit 9 ;; *) cat "$1" > "$f" ;; esac',
        ""
      ].join("\n"),
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(stub, "docker"),
      '#!/bin/sh\n[ "$1" = ps ] && printf "dashmon-agent supersouris7/dashmon:unstable\\nweb nginx\\n"\n' +
        // docker exec -i NAME ...: what the tool sends to a container.
        '[ "$1" = exec ] && cat > "$CRONTAB_DIR/../published-$3"\nexit 0\n',
      { mode: 0o755 }
    );
    const env = {
      ...process.env,
      PATH: `${stub}:${process.env.PATH}`,
      LANG: "C",
      LC_ALL: "C",
      CRONTAB_DIR: cron,
      DASHMON_BIN_DIR: bin,
      DASHMON_RAW_URL: pathToFileURL(DEPLOY).href
    };
    const run = (...args) =>
      execFileSync("sh", [SETUP, ...args], {
        env,
        input: "",
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
    const crontab = user => {
      const file = path.join(cron, user);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    };

    // A line written by hand from an older guide, next to an unrelated one.
    const former = path.join(bin, "wireguard-dump.sh");
    fs.writeFileSync(former, "#!/bin/sh\n");
    fs.writeFileSync(path.join(cron, "root"), `MAILTO=""\n0 * * * * ${former} dashmon-agent\n`);

    run("install", "smart-dump", "wireguard-dump", "--yes");
    const root = crontab("root");
    assert.match(root, /^MAILTO=""$/m, "unrelated line kept");
    assert.match(
      root,
      /^\*\/15 \* \* \* \* DASHMON_CONTAINER=dashmon-agent .*\/dashmon-smart-dump\.sh >\/dev\/null 2>&1 # dashmon:smart-dump$/m
    );
    assert.match(root, /^\* \* \* \* \* .*dashmon-wireguard-dump\.sh .*# dashmon:wireguard-dump$/m);
    assert.ok(!root.includes(former), "hand-written line replaced");
    // Laid out: the other lines first, then a header and, for each job, a
    // blank line and a comment that says what runs and when.
    const header = root.indexOf("# --- Dashmon: managed by dashmon-setup.sh");
    assert.ok(header > root.indexOf('MAILTO=""'), "header after the other lines");
    assert.match(root, /\n\n# SMART : every 15 minutes \[dashmon:smart-dump\]\n\*\/15 /);
    assert.match(root, /\n\n# WireGuard : every minute \[dashmon:wireguard-dump\]\n\* \* /);
    assert.ok(!/\n\n\n/.test(root), "no double blank line");
    assert.ok(!fs.existsSync(former), "former copy removed");
    assert.equal(
      (fs.statSync(path.join(bin, "dashmon-smart-dump.sh")).mode & 0o777).toString(8),
      "755"
    );

    // A user script goes into that user's crontab; a frequency can be picked.
    // --yes: the stub user has no OpenCode data, which is asked about first.
    run(
      "install",
      "opencode-stats",
      "--user",
      "tester",
      "--frequency",
      "3",
      "--container",
      "dm",
      "--yes"
    );
    assert.match(
      crontab("tester"),
      /^0 \* \* \* \* DASHMON_CONTAINER=dm .*# dashmon:opencode-stats$/m
    );
    // APT: the interval matches the schedule; reboot only on request.
    run("install", "apt-updates", "--frequency", "1", "--reboot");
    assert.match(
      crontab("root"),
      /^0 3 \* \* \* DASHMON_APT_INTERVAL_HOURS=24 DASHMON_APT_REBOOT=1 DASHMON_CONTAINER=dashmon-agent /m
    );
    // Installing again replaces the line, never duplicates it.
    run("install", "apt-updates");
    assert.equal(crontab("root").match(/# dashmon:apt-updates/g).length, 1);
    assert.match(crontab("root"), /^0 3 \* \* 3 DASHMON_CONTAINER=dashmon-agent /m);
    // --cron: any schedule, said in words when it is a day of the week.
    run("install", "apt-updates", "--cron", "0 3 * * 4", "--reboot");
    assert.match(
      crontab("root"),
      /# APT updates : every Thursday at 03:00, automatic reboot \[dashmon:apt-updates\]\n0 3 \* \* 4 DASHMON_APT_REBOOT=1 /
    );
    assert.throws(() => run("install", "apt-updates", "--cron", "0 3 * * 4; rm"), /five fields/);
    run("install", "apt-updates");
    run("install", "directory-sizes");
    assert.match(
      crontab("root"),
      /^30 3 \* \* \* sh .*dashmon-directory-sizes\.sh --container dashmon-agent /m
    );

    const listing = run("list");
    assert.match(listing, /2\) SMART +v1, every 15 minutes \(cron of root\)/);
    assert.match(listing, /1\) APT updates +v1, every Wednesday at 03:00 \(cron of root\)/);
    assert.match(listing, /5\) Claude Code +not installed/);
    assert.match(
      run("list", "--lang", "fr"),
      /2\) SMART +v1, toutes les 15 minutes \(cron de root\)/
    );
    // A user script for a user who does not use the tool: nothing without --yes.
    assert.match(run("install", "claude-stats", "--user", "tester"), /Nothing installed/);
    assert.ok(!fs.existsSync(path.join(bin, "dashmon-claude-stats.sh")));
    assert.match(run("update"), /SMART: v1, up to date/);

    run("remove", "smart-dump", "opencode-stats", "--user", "tester");
    assert.ok(!crontab("root").includes("dashmon:smart-dump"));
    assert.ok(!crontab("tester").includes("dashmon:opencode-stats"));
    assert.ok(!fs.existsSync(path.join(bin, "dashmon-smart-dump.sh")));
    assert.match(crontab("root"), /# dashmon:wireguard-dump$/m);

    assert.throws(() => run("install", "unknown"), /Unknown script/);
    assert.throws(() => run("install", "smart-dump", "--container", "a;b"), /letters, digits/);

    // The app shows the same names and schedules as the tool.
    const commands = await import(
      pathToFileURL(path.join(__dirname, "..", "public", "js", "supervision", "script-commands.js"))
        .href
    );
    const { SCRIPTS } = require("../lib/host/script-versions");
    assert.deepEqual([...commands.SCRIPT_NAMES].sort(), Object.values(SCRIPTS).sort());
    const source = fs.readFileSync(SETUP, "utf8").split("frequencies() {")[1].split("\n}\n")[0];
    const blocks = {};
    for (const [, names, body] of source.matchAll(/^ {4}([a-z| -]+)\)\n([\s\S]*?);;/gm))
      for (const name of names.split("|")) blocks[name.trim()] = body;
    for (const [name, list] of Object.entries(commands.SCRIPT_FREQUENCIES)) {
      assert.ok(blocks[name], name);
      const lines = blocks[name].match(/echo "([^"]+)"/g).map(line => line.slice(6, -1));
      assert.deepEqual(
        lines.map(line => line.split("|")[0]),
        list.map(item => item.cron),
        name
      );
      assert.deepEqual(
        lines.map(line => line.split("|")[4] === "1"),
        list.map(item => item.recommended === true),
        name
      );
    }
    assert.equal(commands.UPDATE_COMMAND, "sudo dashmon-setup.sh --all");

    // --all (or -all): replaces only what changed, and flags a script
    // without its cron job.
    fs.writeFileSync(path.join(bin, "dashmon-setup.sh"), fs.readFileSync(SETUP));
    fs.writeFileSync(path.join(bin, "dashmon-claude-stats.sh"), "#!/bin/sh\nSCRIPT_VERSION=0\n");
    const updated = run("--all");
    assert.match(updated, /Claude Code: v0 -> v1, updated/);
    assert.match(updated, /no cron job: sudo dashmon-setup\.sh install claude-stats/);
    assert.match(updated, /WireGuard: v1, up to date/);
    // The installed versions reach the container the cron lines write to.
    const published = JSON.parse(
      fs.readFileSync(path.join(dir, "published-dashmon-agent"), "utf8")
    );
    assert.equal(published.versions["wireguard-dump"], 1);
    assert.equal(published.versions["claude-stats"], 1);
    assert.ok(!("smart-dump" in published.versions), "removed script not listed");
    assert.match(run("-all"), /Claude Code: v1, up to date/);
    // An older setup tool updates itself, then its new version does the rest.
    fs.writeFileSync(path.join(bin, "dashmon-setup.sh"), "#!/bin/sh\nSCRIPT_VERSION=1\n");
    const restarted = run("--all");
    assert.match(restarted, /dashmon-setup: v1 -> v\d+, updated/);
    assert.match(restarted, /dashmon-setup: v\d+, up to date/);
    assert.match(restarted, /WireGuard: v1, up to date/);

    // auto: the setup tool's own cron line, recommended frequency; off removes it.
    run("auto");
    assert.match(
      crontab("root"),
      new RegExp(
        `^30 4 \\* \\* \\* ${bin}/dashmon-setup\\.sh --all >/dev/null 2>&1 # dashmon:setup$`,
        "m"
      )
    );
    assert.match(run("list"), /a\) Auto update +every night at 04:30 \(cron of root\)/);
    run("auto", "--frequency", "3");
    assert.equal(crontab("root").match(/# dashmon:setup/g).length, 1);
    assert.match(crontab("root"), /^30 4 \* \* 0 /m);
    assert.match(crontab("root"), /# dashmon:wireguard-dump$/m, "other lines kept");
    assert.match(
      crontab("root"),
      /# Automatic update of the Dashmon scripts : every Sunday at 04:30 \[dashmon:setup\]\n30 4/
    );
    run("auto", "off");
    assert.ok(!crontab("root").includes("dashmon:setup"));
    assert.equal(crontab("root").match(/\[dashmon\]/g).length, 1, "one header");
    assert.match(crontab("root"), /# dashmon:wireguard-dump$/m);

    // The manual loop of docs/SCRIPTS.md, for hosts without the tool.
    const guide = fs.readFileSync(path.join(__dirname, "..", "docs", "SCRIPTS.md"), "utf8");
    const manual = guide.split("\n").find(line => line.startsWith("for n in setup "));
    assert.ok(manual, "update loop in docs/SCRIPTS.md");
    for (const name of commands.SCRIPT_NAMES) assert.ok(manual.includes(name), name);
    fs.writeFileSync(path.join(bin, "dashmon-claude-stats.sh"), "#!/bin/sh\nSCRIPT_VERSION=0\n");
    const loop = manual
      .replaceAll("sudo ", "")
      .replaceAll("/usr/local/bin", bin)
      .replace(
        /https:\/\/raw\.githubusercontent\.com\/supersouris7\/dashmon\/main\/deploy/g,
        env.DASHMON_RAW_URL
      );
    const output = execFileSync("sh", ["-c", loop], { encoding: "utf8" });
    assert.match(output, /OK claude-stats/);
    assert.ok(!/OK smart-dump/.test(output));
    assert.match(
      fs.readFileSync(path.join(bin, "dashmon-claude-stats.sh"), "utf8"),
      /SCRIPT_VERSION=1/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("PASS setup : installation, cron, migration, mise a jour et retrait des scripts");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
