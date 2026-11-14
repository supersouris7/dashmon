"use strict";
// Versions of the host scripts (deploy/*.sh) of the supervision plugins
// (manifest "script"). Each script carries
// SCRIPT_VERSION=N and writes it into its report; the image ships the
// scripts, so the version this Dashmon expects is read from them. A report
// made by an older script (or by one from before the version existed) is
// flagged on its card with the command to update it (docs/SCRIPTS.md).
// dashmon-setup also writes the versions installed on the host into
// installed-scripts.json: a card stops asking as soon as its script is
// current, without waiting for its next run (APT runs once a week).

const fs = require("fs");
const path = require("path");

function scriptVersion(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

// { "apt-updates": 1, ... } for the given script names, read from the scripts
// in the image. A script missing from the image is not checked.
function readExpectedVersions(deployDir, names, { filesystem = fs } = {}) {
  const expected = {};
  for (const name of names) {
    try {
      const text = filesystem.readFileSync(path.join(deployDir, name + ".sh"), "utf8");
      const match = /^SCRIPT_VERSION=(\d+)$/m.exec(text);
      if (match) expected[name] = Number(match[1]);
    } catch (_error) {}
  }
  return expected;
}

// { "apt-updates": 2, ... } from installed-scripts.json; {} when absent or
// invalid. Only the given names and positive versions are kept.
function readInstalledVersions(file, names, { filesystem = fs } = {}) {
  try {
    if (filesystem.statSync(file).size > 4096) return {};
    const versions = JSON.parse(filesystem.readFileSync(file, "utf8"))?.versions;
    const installed = {};
    for (const name of names) {
      const version = scriptVersion(versions?.[name]);
      if (version) installed[name] = version;
    }
    return installed;
  } catch (_error) {
    return {};
  }
}

// reports: { <plugin id>: report | null } with their scriptVersion.
// scripts: { <plugin id>: "<script>" } (manifest "script").
// installed: versions on the host (readInstalledVersions).
// Returns { "apt-updates": "apt-updates", ... }: plugin id -> script to update.
function outdatedScripts(reports, scripts, expected, installed = {}) {
  const outdated = {};
  for (const [id, name] of Object.entries(scripts)) {
    const report = reports[id];
    if (!report || !expected[name]) continue;
    const current = Math.max(scriptVersion(report.scriptVersion), scriptVersion(installed[name]));
    if (current < expected[name]) outdated[id] = name;
  }
  return outdated;
}

module.exports = {
  scriptVersion,
  readExpectedVersions,
  readInstalledVersions,
  outdatedScripts
};
