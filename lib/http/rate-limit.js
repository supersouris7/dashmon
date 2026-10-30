"use strict";
// Per-client request limits (fixed one-minute windows, keyed by req.ip).

// Each limiter keeps its own counter per client. The clock is injectable so
// tests can check the limits without waiting a minute.
function createRateLimiter({
  windowMs,
  max,
  skip = () => false,
  retryAfter = false,
  now = Date.now
}) {
  const entries = new Map();
  function middleware(req, res, next) {
    if (skip(req)) return next();
    const key = req.ip || "unknown";
    const time = now();
    let entry = entries.get(key);
    if (!entry || time - entry.ts > windowMs) {
      entries.set(key, { ts: time, count: 1 });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      if (retryAfter)
        res.set("Retry-After", String(Math.ceil((windowMs - (time - entry.ts)) / 1000)));
      return res.status(429).json({ error: "Trop de requêtes, réessayez plus tard" });
    }
    next();
  }
  function cleanup() {
    const cutoff = now() - windowMs * 2;
    for (const [key, entry] of entries) {
      if (entry.ts < cutoff) entries.delete(key);
    }
  }
  return { middleware, cleanup };
}

// The two limits of the API: writes (POST, PUT, PATCH, DELETE) on every /api
// route, reads on the routes that do real work on each call.
function createRequestLimits() {
  const writes = createRateLimiter({
    windowMs: 60000,
    max: 60,
    skip: req => ["GET", "HEAD", "OPTIONS"].includes(req.method),
    retryAfter: true
  });
  const reads = createRateLimiter({ windowMs: 60000, max: 120 });
  setInterval(() => {
    writes.cleanup();
    reads.cleanup();
  }, 300000).unref();
  return { writes: writes.middleware, reads: reads.middleware };
}

module.exports = { createRateLimiter, createRequestLimits };
