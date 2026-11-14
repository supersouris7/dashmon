"use strict";
// APT card: last run of deploy/apt-updates.sh. Without a report the card is
// still drawn (manifest showEmpty) and explains how to install the script.
const { readAptUpdatesReport } = require("./report");

function collect(ctx) {
  return readAptUpdatesReport(ctx.files.report);
}

module.exports = { collect };
