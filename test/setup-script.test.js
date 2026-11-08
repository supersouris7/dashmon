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
        'case "$1" in -l) [ -f "$f" ] && cat "$f" || exit 1 ;; -) cat > "$f" ;; esac',
        ""
      ].join("\n"),
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(stub, "docker"),
      '#!/bin/sh\n[ "$1" = ps ] && printf "dashmon-agent supersouris7/dashmon:unstable\\nweb nginx\\n"\nexit 0\n',
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
    assert.ok(!fs.existsSync(former), "former copy removed");
    assert.equal(
      (fs.statSync(path.join(bin, "dashmon-smart-dump.sh")).mode & 0o777).toString(8),
      "755"
    );

    // A user script goes into that user's crontab; a frequency can be picked.
    run("install", "opencode-stats", "--user", "tester", "--frequency", "3", "--container", "dm");
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
    run("install", "directory-sizes");
    assert.match(
      crontab("root"),
      /^30 3 \* \* \* sh .*dashmon-directory-sizes\.sh --container dashmon-agent /m
    );

    assert.match(run("list"), /smart-dump +SMART +v1/);
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
    for (const name of ["setup", ...commands.SCRIPT_NAMES])
      assert.ok(commands.UPDATE_ALL_COMMAND.includes(name));
    // The update command really updates an installed script, and only those.
    fs.writeFileSync(path.join(bin, "dashmon-claude-stats.sh"), "#!/bin/sh\nSCRIPT_VERSION=0\n");
    const loop = commands.UPDATE_ALL_COMMAND.replaceAll("sudo ", "")
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
