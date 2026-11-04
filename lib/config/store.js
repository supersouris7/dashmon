"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// config.json on disk. A single process owns the file.
//
// A write survives a power cut: the new content is flushed to a temporary
// file (fsync) and renamed over the old one, then the folder entry is flushed
// too. Before that, the previous valid version is kept as config.json.bak. If
// config.json is ever found empty or unreadable, that copy is read back and
// restored, instead of leaving the dashboard without a configuration.
//
// Click counters are left out of the revision so that counting a click never
// makes an open editor draft stale.
class ConfigStore {
  constructor(file, { log = null } = {}) {
    this.file = file;
    this.backup = file + ".bak";
    this.log = log;
  }

  read() {
    try {
      return parseConfig(fs.readFileSync(this.file, "utf8"));
    } catch (error) {
      const saved = this.readBackup();
      if (!saved) throw error;
      this.log?.warn(`config.json unreadable (${error.message}): restored from config.json.bak`);
      writeDurably(this.file, saved.text);
      return saved.config;
    }
  }

  readBackup() {
    try {
      const text = fs.readFileSync(this.backup, "utf8");
      return { text, config: parseConfig(text) };
    } catch (_error) {
      return null;
    }
  }

  revision(config) {
    const copy = { ...config };
    delete copy.usageCounts;
    return '"' + crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex") + '"';
  }

  write(value) {
    const text = JSON.stringify(value, null, 2) + "\n";
    // Only a valid version becomes the backup: a damaged file never replaces
    // a good copy.
    const previous = readValid(this.file);
    if (previous !== null && previous !== text) writeDurably(this.backup, previous);
    writeDurably(this.file, text);
  }
}

// A configuration is a JSON object; an empty file (left by a power cut on
// some file systems) is not one.
function parseConfig(text) {
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("not a JSON object");
  }
  return value;
}

// Text of a file holding a valid configuration, null otherwise.
function readValid(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    parseConfig(text);
    return text;
  } catch (_error) {
    return null;
  }
}

function writeDurably(file, text) {
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    const fd = fs.openSync(temporary, "w", 0o600);
    try {
      fs.writeFileSync(fd, text, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
    syncFolder(file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (_error) {}
  }
}

// The rename itself is durable only once the folder is flushed. Some file
// systems refuse to open a folder: the write is then as safe as they allow.
function syncFolder(file) {
  let fd;
  try {
    fd = fs.openSync(path.dirname(file), "r");
    fs.fsyncSync(fd);
  } catch (_error) {
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { ConfigStore };
