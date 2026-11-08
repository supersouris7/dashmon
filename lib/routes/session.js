"use strict";
// Password login for the web interface.
//
//   POST /login   checks the password and opens a session
//   POST /logout  closes (revokes) the session
//   /api/*        requires a session cookie or HTTP Basic auth ("admin")
//   /icons/*      same: the uploaded images name the services that run here
//
// Wrong passwords and wrong Basic credentials are counted per client
// (lib/http/auth-failures.js): past the limit, the client gets 429 for a while.
// Every failure and every block is logged with the client address.
//
// Without DASHMON_PASSWORD none of this is registered: the server then only
// listens on 127.0.0.1 (see lib/config/settings.js).

const { apiError } = require("../http/api-errors");
const { safeEqual } = require("../http/safe-equal");

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function tooManyAttempts(res, seconds) {
  res.set("Retry-After", String(seconds));
  return res.status(429).json({ ...apiError("too_many_attempts") });
}

// auth: createAuth() (lib/http/auth.js); failures: createAuthFailures().
function registerSessionRoutes(app, { password, auth, failures, rateLimit, log }) {
  if (!password) return;

  // One line per wrong credential, and one more when the client gets blocked.
  function recordFailure(req, kind) {
    const blocked = failures.fail(req);
    const client = req.ip || "unknown";
    log.warn(`${kind} failed from ${client}`);
    if (blocked)
      log.warn(`${client} blocked for ${failures.retryAfter(req)} s after repeated failures`);
  }

  app.post("/login", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    const wait = failures.retryAfter(req);
    if (wait) return tooManyAttempts(res, wait);

    const received = typeof req.body?.password === "string" ? req.body.password : "";
    if (!safeEqual(received, password)) {
      recordFailure(req, "Login");
      return res.status(401).json({ ...apiError("auth_invalid") });
    }
    failures.succeed(req);
    auth.openSession(req, res, Date.now() + SESSION_MAX_AGE);
    res.json({ ok: true });
  });

  app.post("/logout", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    auth.closeSession(req, res);
    res.json({ ok: true });
  });

  function requireAuth(req, res, next) {
    if (auth.validSession(req)) return next();
    if (auth.hasBasicAuth(req)) {
      const wait = failures.retryAfter(req);
      if (wait) return tooManyAttempts(res, wait);
      if (auth.validBasicAuth(req)) {
        failures.succeed(req);
        return next();
      }
      recordFailure(req, "Basic authentication");
    }
    res.status(401).json({ ...apiError("auth_required") });
  }

  app.use("/api", (req, res, next) => {
    // The /api/sync/* routes authenticate with the shared sync token instead,
    // so that an instance never needs another one's web password.
    if (req.path.startsWith("/sync/")) return next();
    requireAuth(req, res, next);
  });
  app.use("/icons", requireAuth);
}

module.exports = { registerSessionRoutes };
