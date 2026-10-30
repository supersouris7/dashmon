"use strict";

// CSRF protection: a state-changing request (POST, PUT, DELETE, PATCH) sent
// by a browser from another site carries a foreign Origin and is refused.
// Clients sending no Origin (scripts, curl) are accepted.
function verifyRequestOrigin(req, res, next) {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const origin = req.get("Origin");
    if (origin) {
      const host = req.get("Host") || "";
      let ok = false;
      try {
        const secure = req.secure || req.get("x-forwarded-proto") === "https";
        const parsed = new URL(origin);
        const hostNoPort = host.split(":")[0];
        const hostPort = host.split(":")[1] || (secure ? "443" : "80");
        const originPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
        ok = parsed.hostname === hostNoPort && originPort === hostPort;
      } catch (_error) {}
      if (!ok) return res.status(403).json({ error: "Requête refusée (CSRF)" });
    }
  }
  next();
}

module.exports = { verifyRequestOrigin };
