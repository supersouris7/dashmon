"use strict";
// Directories card: sizes measured on the host by deploy/directory-sizes.sh,
// in the order and with the names chosen in the host settings (the script
// reads the same settings, monitoring.directorySizes, from config.json).
const { readDirectoryReport } = require("./report");

function collect(ctx) {
  return readDirectoryReport(ctx.files.report, ctx.prefs);
}

module.exports = { collect };
