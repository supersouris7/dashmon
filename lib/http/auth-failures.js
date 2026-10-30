"use strict";
// Brute-force protection: after too many wrong credentials from one client
// (wrong login password, wrong HTTP Basic auth), further attempts from that
// client are refused for a while, even with the right password.
//
// Only real attempts count: a browser that is simply logged out and receives
// 401 answers is not a failure, so it can never lock itself out.

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

function createAuthFailures({ max = MAX_FAILURES, windowMs = WINDOW_MS, now = Date.now } = {}) {
  const clients = new Map();

  function entry(key) {
    const current = clients.get(key);
    if (current && now() - current.since <= windowMs) return current;
    clients.delete(key);
    return null;
  }

  return {
    // Seconds before the client may try again, 0 when it is not blocked.
    retryAfter(req) {
      const current = entry(req.ip || "unknown");
      if (!current || current.count < max) return 0;
      return Math.ceil((windowMs - (now() - current.since)) / 1000);
    },
    fail(req) {
      const key = req.ip || "unknown";
      const current = entry(key);
      if (current) current.count++;
      else clients.set(key, { since: now(), count: 1 });
    },
    succeed(req) {
      clients.delete(req.ip || "unknown");
    },
    cleanup() {
      for (const key of clients.keys()) entry(key);
    }
  };
}

module.exports = { createAuthFailures, MAX_FAILURES, WINDOW_MS };
