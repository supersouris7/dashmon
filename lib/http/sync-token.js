"use strict";
// Shared secret between the main dashboard and its agents (DASHMON_SYNC_TOKEN),
// sent in the X-Dashmon-Sync-Token header. An empty token accepts nothing.

const crypto = require("crypto");

function createSyncTokenCheck(token) {
  const expected = Buffer.from(token);
  return function validSyncToken(req) {
    const received = Buffer.from(req.get("X-Dashmon-Sync-Token") || "");
    return (
      expected.length > 0 &&
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected)
    );
  };
}

module.exports = { createSyncTokenCheck };
