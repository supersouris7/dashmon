"use strict";
const fs = require("fs");
const { sanitizeText } = require("../sanitize");

function readDirectoryReport(file) {
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
        bytes: Number.isSafeInteger(item.bytes) && item.bytes >= 0 ? item.bytes : null
      }));
    return directories.length
      ? {
          updatedAt:
            Number.isSafeInteger(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : null,
          directories
        }
      : null;
  } catch (_error) {
    return null;
  }
}

module.exports = { readDirectoryReport };
