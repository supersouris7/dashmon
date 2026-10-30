"use strict";
// Shared secret between the main dashboard and its agents (DASHMON_SYNC_TOKEN),
// sent in the X-Dashmon-Sync-Token header. An empty token accepts nothing.

const { safeEqual } = require("./safe-equal");

function createSyncTokenCheck(token) {
  return function validSyncToken(req) {
    return token.length > 0 && safeEqual(req.get("X-Dashmon-Sync-Token") || "", token);
  };
}

module.exports = { createSyncTokenCheck };
