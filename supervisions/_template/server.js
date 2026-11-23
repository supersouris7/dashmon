"use strict";
// SUPERVISION CARD TEMPLATE: copy this folder to supervisions/<your-id>/ and
// set "id" in manifest.json to the folder name. A folder starting with "_"
// is never loaded. Full guide: docs/EXTENDING.md.
//
// collect(ctx) runs for the monitored local host on every metrics refresh
// (HOST_METRICS_INTERVAL, 5 min by default). It returns a small JSON object,
// the report your client.mjs turns into a card, or null for "nothing to
// show on this host" (no card is drawn).
//
// ctx = {
//   host         : { id, name, monitoring }  the supervised host and its settings
//   prefs        : this card's settings on the host (manifest "settings")
//   files        : paths of the report files of the manifest ("files")
//   state        : your memory, created once by createState()
//   storage      : read(name, fallback) / write(name, value), JSON that
//                  survives a restart (data/supervisions/<id>/)
//   readDataFile : (fileName) => { data, modifiedAt } | null, reads a JSON
//                  file of the data folder, typically written by a host script
//   sanitizeText : (value, maxLength) => clean text
//   log          : (message) => one line in the Dashmon logs
// }
//
// Rules: answer within 5 s, keep the report under 256 KB, never return a
// secret (the report reaches the browser). An exception or a timeout only
// drops your card for this round; the error is logged once.
const os = require("os");

function createState() {
  return {};
}

function collect(_ctx) {
  // A report written by a host script would be read like this:
  //   const file = ctx.readDataFile("my-report.json");
  //   if (!file) return null;               // no report yet: no card
  //   return { value: Number(file.data.value) || 0, at: file.modifiedAt };
  const [load1, load5, load15] = os.loadavg();
  return {
    load1: Math.round(load1 * 100) / 100,
    load5: Math.round(load5 * 100) / 100,
    load15: Math.round(load15 * 100) / 100,
    cores: os.cpus().length || 1,
    uptime: Math.floor(os.uptime())
  };
}

module.exports = { createState, collect };
