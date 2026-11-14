"use strict";
// OpenCode card: usage report written by deploy/opencode-stats.sh. The format is
// shared with the other coding agent (lib/host/usage-report.js), which the
// OpenCode tile widget reads too.
const { readUsageReport } = require("../../lib/host/usage-report");

function collect(ctx) {
  return readUsageReport(ctx.files.report);
}

module.exports = { collect };
