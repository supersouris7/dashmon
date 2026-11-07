"use strict";
const fs = require("fs");
const { sanitizeText } = require("../sanitize");
const { scriptVersion } = require("./script-versions");

// Causes written by deploy/directory-sizes.sh; "not_measured" is a directory
// added in the settings after the last run of the script.
const ERRORS = new Set(["invalid_directory", "measurement_failed"]);

function readDirectoryReport(file, preferences) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 100_000) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw.directories)) return null;
    const directories = raw.directories
      .slice(0, 50)
      .filter(item => item && typeof item.path === "string" && item.path.startsWith("/"))
      .map(item => ({
        path: sanitizeText(item.path, 4096),
        capacity: Number.isSafeInteger(item.capacity) && item.capacity > 0 ? item.capacity : null,
        bytes: Number.isSafeInteger(item.bytes) && item.bytes >= 0 ? item.bytes : null,
        error: ERRORS.has(item.error) ? item.error : null
      }))
      .map(item => ({
        ...item,
        error: item.bytes === null ? item.error || "measurement_failed" : null
      }));
    const selected = preferences?.entries;
    const visible = selected?.length
      ? selected.map(entry => ({
          ...(directories.find(item => item.path === entry.path) || {
            path: entry.path,
            bytes: null,
            capacity: null,
            error: "not_measured"
          }),
          name: sanitizeText(entry.name, 100)
        }))
      : directories;
    return visible.length
      ? {
          scriptVersion: scriptVersion(raw.scriptVersion),
          updatedAt:
            Number.isSafeInteger(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : null,
          directories: visible
        }
      : null;
  } catch (_error) {
    return null;
  }
}

module.exports = { readDirectoryReport };
