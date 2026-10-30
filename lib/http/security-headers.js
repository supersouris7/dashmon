"use strict";

// Politique HTTP commune au principal et à l'agent. Garder cette politique
// indépendante des routes permet de la tester sans démarrer l'application.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "font-src https://cdnjs.cloudflare.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

function securityHeaders(req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  res.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  if (req.secure || req.get("x-forwarded-proto") === "https") {
    res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
}

module.exports = { securityHeaders, CONTENT_SECURITY_POLICY };
