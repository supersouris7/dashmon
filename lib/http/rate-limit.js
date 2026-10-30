"use strict";

// Chaque limiteur possede son propre compteur par client. L'horloge est
// injectable pour tester les limites sans attendre une minute.
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

module.exports = { createRateLimiter };
