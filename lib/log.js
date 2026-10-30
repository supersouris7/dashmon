"use strict";
// Server log lines, prefixed with a readable timestamp ("2026-10-30 09:15:02").
// Messages are passed as separate arguments, never concatenated into a format
// string, so a value containing "%s" cannot alter the line.

function timestamp() {
  return new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

const log = {
  info: (...args) => console.log(timestamp(), ...args),
  warn: (...args) => console.warn(timestamp(), ...args),
  error: (...args) => console.error(timestamp(), ...args)
};

module.exports = { log, timestamp };
