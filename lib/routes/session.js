"use strict";
// Password login for the web interface.
//
//   POST /login   checks the password and opens a session
//   POST /logout  closes (revokes) the session
//   /api/*        requires a session cookie or HTTP Basic auth ("admin")
//
// Wrong passwords and wrong Basic credentials are counted per client
// (lib/http/auth-failures.js): past the limit, the client gets 429 for a while.
//
// Without DASHMON_PASSWORD none of this is registered: the server then only
// listens on 127.0.0.1 (see lib/config/settings.js).

const { safeEqual } = require("../http/safe-equal");

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function tooManyAttempts(res, seconds) {
  res.set("Retry-After", String(seconds));
  return res.status(429).json({ error: "Trop de tentatives, réessayez plus tard" });
}

// auth: createAuth() (lib/http/auth.js); failures: createAuthFailures().
function registerSessionRoutes(app, { password, auth, failures, rateLimit }) {
  if (!password) return;

  app.post("/login", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    const wait = failures.retryAfter(req);
    if (wait) return tooManyAttempts(res, wait);

    const received = typeof req.body?.password === "string" ? req.body.password : "";
    if (!safeEqual(received, password)) {
      failures.fail(req);
      return res.status(401).json({ error: "Authentification invalide" });
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

  app.use("/api", (req, res, next) => {
    // The /api/sync/* routes authenticate with the shared sync token instead,
    // so that an instance never needs another one's web password.
    if (req.path.startsWith("/sync/")) return next();
    if (auth.validSession(req)) return next();
    if (auth.hasBasicAuth(req)) {
      const wait = failures.retryAfter(req);
      if (wait) return tooManyAttempts(res, wait);
      if (auth.validBasicAuth(req)) {
        failures.succeed(req);
        return next();
      }
      failures.fail(req);
    }
    res.status(401).json({ error: "Authentification requise" });
  });
}

module.exports = { registerSessionRoutes };
