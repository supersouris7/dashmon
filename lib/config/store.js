"use strict";
const fs = require("fs");
const crypto = require("crypto");

// config.json on disk. A single process owns the file; writes go through a
// temporary file and a rename, so a crash never leaves a half-written config.
// Click counters are left out of the revision so that counting a click never
// makes an open editor draft stale.
class ConfigStore {
  constructor(file) {
    this.file = file;
  }
  read() {
    return JSON.parse(fs.readFileSync(this.file, "utf8"));
  }
  revision(config) {
    const copy = { ...config };
    delete copy.usageCounts;
    return '"' + crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex") + '"';
  }
  write(value) {
    const temporary = `${this.file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", "utf8");
      fs.renameSync(temporary, this.file);
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (_error) {}
    }
  }
}
module.exports = { ConfigStore };
