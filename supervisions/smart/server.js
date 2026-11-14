"use strict";
// SMART card: disk health from deploy/smart-dump.sh (smartctl JSON), limited
// to the disks chosen in the host settings (all when none is chosen).
const { readSmartDump } = require("./report");

function collect(ctx) {
  const dump = readSmartDump(ctx.files.dump);
  if (!dump) return null;
  const wanted = Array.isArray(ctx.prefs.disks) ? ctx.prefs.disks : [];
  const disks = wanted.length
    ? dump.disks.filter(disk => wanted.includes(disk.device))
    : dump.disks;
  if (!disks.length) return null;
  return { disks, fetchedAt: dump.fetchedAt, scriptVersion: dump.scriptVersion };
}

module.exports = { collect };
