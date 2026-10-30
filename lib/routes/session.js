"use strict";
// Password login for the web interface.
//
//   POST /login   checks the password and sets the session cookie
//   POST /logout  clears the session cookie
//   /api/*        requires a session cookie or HTTP Basic auth ("admin")
//
// Without DASHMON_PASSWORD none of this is registered: the server then only
// listens on 127.0.0.1 (see lib/config/settings.js).

const crypto = require("crypto");

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function passwordMatches(received, expected) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// auth: the object returned by createAuth() (lib/http/auth.js).
function registerSessionRoutes(app, { password, auth, rateLimit }) {
  if (!password) return;

  app.post("/login", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    const received = typeof req.body?.password === "string" ? req.body.password : "";
    if (!passwordMatches(received, password)) {
      return res.status(401).json({ error: "Authentification invalide" });
    }
    auth.setSessionCookie(req, res, Date.now() + SESSION_MAX_AGE);
    res.json({ ok: true });
  });

  app.post("/logout", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    auth.setSessionCookie(req, res, 0);
    res.json({ ok: true });
  });

  app.use("/api", (req, res, next) => {
    // The /api/sync/* routes authenticate with the shared sync token instead,
    // so that an instance never needs another one's web password.
    if (req.path.startsWith("/sync/")) return next();
    if (auth.validSession(req) || auth.validBasicAuth(req)) return next();
    res.status(401).json({ error: "Authentification requise" });
  });
}

module.exports = { registerSessionRoutes };
