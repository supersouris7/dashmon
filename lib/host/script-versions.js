"use strict";
// Versions of the host scripts (deploy/*.sh). Each script carries
// SCRIPT_VERSION=N and writes it into its report; the image ships the
// scripts, so the version this Dashmon expects is read from them. A report
// made by an older script (or by one from before the version existed) is
// flagged on its card with the command to update it (docs/SCRIPTS.md).
// dashmon-setup also writes the versions installed on the host into
// installed-scripts.json: a card stops asking as soon as its script is
// current, without waiting for its next run (APT runs once a week).

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

// { "apt-updates": 2, ... } from installed-scripts.json; {} when absent or
// invalid. Only known names and positive versions are kept.
function readInstalledVersions(file, { filesystem = fs } = {}) {
  try {
    if (filesystem.statSync(file).size > 4096) return {};
    const versions = JSON.parse(filesystem.readFileSync(file, "utf8"))?.versions;
    const installed = {};
    for (const name of Object.values(SCRIPTS)) {
      const version = scriptVersion(versions?.[name]);
      if (version) installed[name] = version;
    }
    return installed;
  } catch (_error) {
    return {};
  }
}

// reports: { aptUpdates: report | null, ... } with their scriptVersion.
// installed: versions on the host (readInstalledVersions).
// Returns { aptUpdates: "apt-updates", ... } for the reports to update.
function outdatedScripts(reports, expected, installed = {}) {
  const outdated = {};
  for (const [field, name] of Object.entries(SCRIPTS)) {
    const report = reports[field];
    if (!report || !expected[name]) continue;
    const current = Math.max(scriptVersion(report.scriptVersion), scriptVersion(installed[name]));
    if (current < expected[name]) outdated[field] = name;
  }
  return outdated;
}

module.exports = {
  SCRIPTS,
  scriptVersion,
  readExpectedVersions,
  readInstalledVersions,
  outdatedScripts
};
