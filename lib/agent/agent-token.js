"use strict";
// Agent side of the pairing: the token the main dashboard must present.
//
// The agent generates its own token when a dashboard pairs it
// (POST /api/sync/pair) and keeps it in its data folder (agent-token, 0600).
// Nobody types or copies it: the dashboard receives it once, in the answer.
//
//   - Not paired yet, no DASHMON_SYNC_TOKEN: the first dashboard that pairs
//     the agent gets the token (trust on first use).
//   - Not paired yet, DASHMON_SYNC_TOKEN set: it acts as a pairing key, and
//     as the token itself until the pairing (shared token of earlier
//     versions). Only a dashboard presenting it can pair the agent.
//   - Paired: only the saved token is accepted, and only its holder can pair
//     again (a new token replaces the old one).
//
// Deleting agent-token (docker exec <agent> rm /app/data/agent-token) unpairs
// the agent at once: the file is checked on every request.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { safeEqual } = require("../http/safe-equal");

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function createAgentToken({ dataDir, pairingKey = "", log = { info() {}, warn() {} } }) {
  const file = path.join(dataDir, "agent-token");
  let cache = { stamp: null, token: "" };

  // Saved token, re-read only when the file changes.
  function saved() {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (_error) {
      cache = { stamp: null, token: "" };
      return "";
    }
    const stamp = `${stat.mtimeMs}:${stat.size}:${stat.ino}`;
    if (cache.stamp !== stamp) {
      let token = "";
      try {
        token = fs.readFileSync(file, "utf8").trim();
      } catch (_error) {}
      cache = { stamp, token: TOKEN_PATTERN.test(token) ? token : "" };
    }
    return cache.token;
  }

  function paired() {
    return Boolean(saved());
  }

  // The token a request must carry: the saved one, else the pairing key.
  function current() {
    return saved() || pairingKey;
  }

  function presented(req) {
    return req.get("X-Dashmon-Sync-Token") || "";
  }

  function valid(req) {
    const token = current();
    return token.length > 0 && safeEqual(presented(req), token);
  }

  function write(token) {
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temporary, token + "\n", { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (_error) {}
    }
  }

  // POST /api/sync/pair. Answers { token } to a dashboard allowed to pair.
  function pairHandler(req, res) {
    res.set("Cache-Control", "no-store");
    const client = req.ip || "unknown";
    const expected = current();
    if (expected && !safeEqual(presented(req), expected)) {
      log.warn(`Pairing refused from ${client}: this agent is already paired`);
      return res.status(409).json({ error: "already_paired" });
    }
    const token = crypto.randomBytes(32).toString("base64url");
    try {
      write(token);
    } catch (error) {
      log.warn(`Pairing failed: ${error.message}`);
      return res.status(500).json({ error: "pairing_write_failed" });
    }
    log.info(`Paired with the dashboard at ${client}`);
    res.json({ token });
  }

  return { valid, paired, pairHandler };
}

module.exports = { createAgentToken };
