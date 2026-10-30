"use strict";

// HTTP security headers shared by the main dashboard and the agent. Kept apart
// from the routes so it can be tested without starting the application.
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
  // req.secure follows X-Forwarded-Proto only when TRUST_PROXY is set: a
  // client cannot switch HSTS on by sending the header itself.
  if (req.secure) {
    res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
}

module.exports = { securityHeaders, CONTENT_SECURITY_POLICY };
