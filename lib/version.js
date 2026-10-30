"use strict";
// Which version is running, as shown in the footer and by GET /api/version.

const fs = require("fs");

// The release label follows the git tag rather than the "version" field of
// package.json, which stays frozen between releases. An image built from a v*
// tag receives DASHMON_RELEASE from the CI. A build from main (the "unstable"
// image) cannot claim to be a release: showing the package number there would
// suggest an up-to-date image although it changes on every push. It is shown
// as "unstable", and the commit next to it identifies the build.
function releaseLabel(release) {
  if (!/^v?\d+(\.\d+){0,2}([-.][0-9A-Za-z.-]+)?$/.test(release)) return "unstable";
  return release.startsWith("v") ? release : "v" + release;
}

function readMountPoints() {
  try {
    return fs
      .readFileSync("/proc/self/mountinfo", "utf8")
      .split("\n")
      .map(line => line.split(" "))
      .filter(parts => parts.length > 4)
      .map(parts => parts[4]);
  } catch (_error) {
    return null;
  }
}

// Is this path a kernel mount point? It tells a volume apart from a file that
// only belongs to the image. null when the information is unavailable.
function isMountedPath(target) {
  const mounts = readMountPoints();
  return mounts && mounts.includes(target);
}

// Is /app (the code) bind-mounted from the host instead of coming from the
// image? This is the usual cause of "the code is up to date but the displayed
// version is old": the image provides the environment (and the commit SHA)
// while the code comes from the mount, so a git pull on the host changes the
// files without changing the label.
function appIsMounted() {
  const mounts = readMountPoints();
  return mounts && mounts.some(mount => mount === "/app" || mount.startsWith("/app/"));
}

function describeVersion({ release, commit }) {
  const version = releaseLabel(release);
  // The commit SHA comes from the environment: it is validated before it
  // reaches the HTML, and a missing or unexpected value ("unknown" by default)
  // removes the suffix instead of showing a misleading marker.
  const commitShort = /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : "";
  // The SHA describes the IMAGE. When /app is mounted from the host, the code
  // running is not the image's: only the version is shown then.
  const codeMounted = appIsMounted();
  return {
    version,
    commit,
    commitShort,
    codeMounted,
    label: commitShort && !codeMounted ? version + " · " + commitShort : version,
    // Distinguishes "the image is old" from "the container has not been
    // recreated since the last restart".
    startedAt: new Date().toISOString()
  };
}

module.exports = { describeVersion, releaseLabel, isMountedPath, appIsMounted };
