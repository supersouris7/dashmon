"use strict";
// Versions of the host scripts (deploy/*.sh). Each script carries
// SCRIPT_VERSION=N and writes it into its report; the image ships the
// scripts, so the version this Dashmon expects is read from them. A report
// made by an older script (or by one from before the version existed) is
// flagged on its card with the command to update it (docs/SCRIPTS.md).

const fs = require("fs");
const path = require("path");

// Report field of the host metrics -> script file in deploy/.
const SCRIPTS = Object.freeze({
  aptUpdates: "apt-updates",
  smart: "smart-dump",
  wireguard: "wireguard-dump",
  opencode: "opencode-stats",
  claude: "claude-stats",
  directorySizes: "directory-sizes"
});

function scriptVersion(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

// { "apt-updates": 1, ... } from the scripts in the image. A script missing
// from the image is not checked.
function readExpectedVersions(deployDir, { filesystem = fs } = {}) {
  const expected = {};
  for (const name of Object.values(SCRIPTS)) {
    try {
      const text = filesystem.readFileSync(path.join(deployDir, name + ".sh"), "utf8");
      const match = /^SCRIPT_VERSION=(\d+)$/m.exec(text);
      if (match) expected[name] = Number(match[1]);
    } catch (_error) {}
  }
  return expected;
}

// reports: { aptUpdates: report | null, ... } with their scriptVersion.
// Returns { aptUpdates: "apt-updates", ... } for the reports to update.
function outdatedScripts(reports, expected) {
  const outdated = {};
  for (const [field, name] of Object.entries(SCRIPTS)) {
    const report = reports[field];
    if (!report || !expected[name]) continue;
    if (scriptVersion(report.scriptVersion) < expected[name]) outdated[field] = name;
  }
  return outdated;
}

module.exports = { SCRIPTS, scriptVersion, readExpectedVersions, outdatedScripts };
