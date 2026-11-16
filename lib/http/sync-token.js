"use strict";
// Secret of an agent (its DASHMON_SYNC_TOKEN), which the main dashboard holds
// in that agent's pairing and sends in the X-Dashmon-Sync-Token header. An
// empty token accepts nothing.

const { safeEqual } = require("./safe-equal");

function createSyncTokenCheck(token) {
  return function validSyncToken(req) {
    return token.length > 0 && safeEqual(req.get("X-Dashmon-Sync-Token") || "", token);
  };
}

module.exports = { createSyncTokenCheck };
