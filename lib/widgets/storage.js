"use strict";
// JSON storage for widgets, confined to the data folder.
//
// A widget that needs to remember something (an ELO rating, a counter, the
// last version seen) writes a JSON file by name. The core knows no widget: it
// only opens a safe, named space.
//
// Rules: strict file name (no separator, hence no traversal), bounded size,
// atomic write (temporary file then rename) so that a crash never leaves a
// truncated JSON, and silent failure: a widget without write access must
// degrade its display, not the start-up.

const fs = require("fs");
const path = require("path");

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_BYTES = 1024 * 1024; // 1 Mo : largement au-dela de nos besoins

class Storage {
  constructor({ dir, log }) {
    this.dir = path.join(dir, "widgets");
    this.log = typeof log === "function" ? log : () => {};
  }

  // null when the name is not a safe file name: it is the only defence
  // against a widget trying to write elsewhere.
  file(name) {
    const clean = String(name == null ? "" : name);
    if (!NAME_PATTERN.test(clean)) return null;
    return path.join(this.dir, clean.toLowerCase() + ".json");
  }

  // Returns the stored value, or `fallback` when the file does not exist, is
  // unreadable or exceeds the maximum size.
  read(name, fallback = null) {
    const file = this.file(name);
    if (!file) return fallback;
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") this.log(`[storage] reading ${name}: ${error.message}`);
      return fallback;
    }
    if (raw.length > MAX_BYTES) {
      this.log(`[storage] ${name}: file skipped (too large)`);
      return fallback;
    }
    try {
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      this.log(`[storage] ${name}: unreadable JSON (${error.message})`);
      return fallback;
    }
  }

  write(name, value) {
    const file = this.file(name);
    if (!file) return false;
    let payload;
    try {
      payload = JSON.stringify(value);
    } catch (error) {
      this.log(`[storage] ${name}: value not serialisable (${error.message})`);
      return false;
    }
    if (!payload || payload.length > MAX_BYTES) {
      this.log(`[storage] ${name}: write refused (size)`);
      return false;
    }
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(tmp, payload, "utf8");
      fs.renameSync(tmp, file);
      return true;
    } catch (error) {
      this.log(`[storage] writing ${name}: ${error.message}`);
      try {
        fs.unlinkSync(tmp);
      } catch (_) {}
      return false;
    }
  }
}

module.exports = { Storage, NAME_PATTERN, MAX_BYTES };
