"use strict";

// CSRF protection: a state-changing request (POST, PUT, DELETE, PATCH) sent
// by a browser from another site carries a foreign Origin and is refused.
// Clients sending no Origin (scripts, curl) are accepted.
//
// The Origin must name the same host and port as the Host header. The
// X-Forwarded-Proto header is never read here: when the connection is known to
// be HTTPS (req.secure, which Express derives from that header only with
// TRUST_PROXY), the Origin must be https too.

const STATE_CHANGING = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const defaultPort = protocol => (protocol === "https:" ? "443" : "80");

function sameOrigin(req, originHeader) {
  try {
    const origin = new URL(originHeader);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return false;
    if (req.secure && origin.protocol !== "https:") return false;
    const host = new URL(origin.protocol + "//" + (req.get("Host") || ""));
    return (
      origin.hostname === host.hostname &&
      (origin.port || defaultPort(origin.protocol)) === (host.port || defaultPort(origin.protocol))
    );
  } catch (_error) {
    return false;
  }
}

function verifyRequestOrigin(req, res, next) {
  const origin = req.get("Origin");
  if (STATE_CHANGING.has(req.method) && origin && !sameOrigin(req, origin)) {
    return res.status(403).json({ error: "Requête refusée (CSRF)" });
  }
  next();
}

module.exports = { verifyRequestOrigin };
