"use strict";
// Host script versions: read from deploy/, written into the reports, older
// reports flagged on their card.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  SCRIPTS,
  readExpectedVersions,
  outdatedScripts,
  readInstalledVersions,
  scriptVersion
} = require("../lib/host/script-versions");
const { readWireguardDump } = require("../lib/host/wireguard-report");
const { readAptUpdatesReport } = require("../lib/host/apt-report");
const { readSmartDump } = require("../lib/host/smart-report");
const { readUsageReport } = require("../lib/host/usage-report");
const { readDirectoryReport } = require("../lib/host/directory-report");

// Every script of the image carries a version.
const expected = readExpectedVersions(path.join(__dirname, "..", "deploy"));
assert.deepEqual(Object.keys(expected).sort(), Object.values(SCRIPTS).sort());
for (const [name, version] of Object.entries(expected)) assert.ok(version >= 1, name);

assert.equal(scriptVersion("3"), 3);
assert.equal(scriptVersion(undefined), 0);
assert.equal(scriptVersion(-1), 0);

// Older or missing version: flagged; current: not; no report: not.
assert.deepEqual(
  outdatedScripts(
    {
      aptUpdates: { scriptVersion: 0 },
      smart: { scriptVersion: expected["smart-dump"] },
      opencode: {},
      claude: null
    },
    expected
  ),
  { aptUpdates: "apt-updates", opencode: "opencode-stats" }
);
// An old report, but the script installed on the host is current
// (dashmon-setup wrote installed-scripts.json): no longer flagged.
assert.deepEqual(
  outdatedScripts({ aptUpdates: { scriptVersion: 0 } }, expected, {
    "apt-updates": expected["apt-updates"]
  }),
  {}
);
assert.deepEqual(
  outdatedScripts({ aptUpdates: { scriptVersion: 0 } }, expected, { "apt-updates": 0 }),
  { aptUpdates: "apt-updates" }
);
// A script missing from the image is never flagged.
assert.deepEqual(outdatedScripts({ aptUpdates: {} }, {}), {});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-scripts-"));
try {
  // WireGuard: the version line is read and never shown as an interface.
  const dump = path.join(dir, "wireguard.dump");
  fs.writeFileSync(
    dump,
    "\tdashmon-script\t1\nwg0\t(redacted)\tpub\t51820\toff\n" +
      "wg0\tLaptop\t(redacted)\t198.51.100.21:51820\t10.0.0.2/32\t1700000000\t10\t20\toff\n"
  );
  const wireguard = readWireguardDump(dump);
  assert.equal(wireguard.scriptVersion, 1);
  assert.deepEqual(
    wireguard.interfaces.map(item => item.interface),
    ["wg0"]
  );
  fs.writeFileSync(dump, "wg0\t(redacted)\tpub\t51820\toff\n");
  assert.equal(readWireguardDump(dump).scriptVersion, 0);

  // installed-scripts.json: known names, positive versions; anything else ignored.
  const installedFile = path.join(dir, "installed-scripts.json");
  fs.writeFileSync(
    installedFile,
    JSON.stringify({ versions: { "apt-updates": 2, other: 9, smart: -1, "smart-dump": "x" } })
  );
  assert.deepEqual(readInstalledVersions(installedFile), { "apt-updates": 2 });
  fs.writeFileSync(installedFile, "not json");
  assert.deepEqual(readInstalledVersions(installedFile), {});
  assert.deepEqual(readInstalledVersions(path.join(dir, "missing.json")), {});

  // JSON reports carry scriptVersion.
  const write = (name, value) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(value));
    return file;
  };
  assert.equal(
    readAptUpdatesReport(
      write("apt.json", { scriptVersion: 1, status: "success", updated: 0, finishedAt: 1 })
    ).scriptVersion,
    1
  );
  assert.equal(
    readSmartDump(
      write("smart.json", {
        scriptVersion: 1,
        updatedAt: 1,
        disks: [{ device: { name: "/dev/sda" }, smart_status: { passed: true } }]
      })
    ).scriptVersion,
    1
  );
  assert.equal(
    readUsageReport(write("usage.json", { scriptVersion: 1, periods: { today: {} } }))
      .scriptVersion,
    1
  );
  assert.equal(
    readUsageReport(write("old-usage.json", { periods: { today: {} } })).scriptVersion,
    0
  );

  // The directory script writes its version into the report.
  const target = path.join(dir, "measured");
  fs.mkdirSync(target);
  const report = path.join(dir, "directories.json");
  execFileSync("sh", [
    path.join(__dirname, "..", "deploy", "directory-sizes.sh"),
    "--output",
    report,
    target
  ]);
  assert.equal(readDirectoryReport(report).scriptVersion, expected["directory-sizes"]);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(
  "PASS scripts : versions lues dans deploy/, ecrites dans les rapports, anciens signales"
);
