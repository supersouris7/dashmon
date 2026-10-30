"use strict";
// Permanent identifier of an agent, generated on first start and kept in the
// data folder. The main dashboard uses it to recognise an agent across
// restarts and address changes.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadAgentIdentity(dataDir) {
  const file = path.join(dataDir, "agent-id");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (/^[0-9a-f]{32}$/.test(existing)) return existing;
    throw new Error("Invalid agent identity file: " + file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const id = crypto.randomBytes(16).toString("hex");
    try {
      // "wx" fails if another process created the file in the meantime.
      fs.writeFileSync(file, id + "\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
      return id;
    } catch (writeError) {
      if (writeError.code === "EEXIST") return loadAgentIdentity(dataDir);
      throw writeError;
    }
  }
}

module.exports = { loadAgentIdentity };
