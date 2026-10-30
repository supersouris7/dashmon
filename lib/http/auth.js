"use strict";
// Web authentication: a session cookie, or HTTP Basic auth with user "admin"
// for scripts.
//
// The cookie is "<expiry>.<id>.<signature>": an HMAC of the expiry and a
// random id, keyed by the password. It is accepted only while signed with the
// current password (changing the password closes every session) AND while its
// id is listed in the session store (logging out revokes it).

const crypto = require("crypto");
const { safeEqual } = require("./safe-equal");

const COOKIE = "dashmon_session";

function createAuth({ password, sessions }) {
  function cookieValue(req) {
    const prefix = COOKIE + "=";
    const match = String(req.get("Cookie") || "")
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));
    if (!match) return "";
    try {
      return decodeURIComponent(match.slice(prefix.length));
    } catch (_error) {
      return "";
    }
  }

  function sign(expires, id) {
    return crypto
      .createHmac("sha256", password)
      .update("dashmon-session:" + expires + ":" + id)
      .digest("base64url");
  }

  // { expires, id } of a well-formed, correctly signed and unexpired cookie.
  function parseCookie(req) {
    const match = /^(\d{13})\.([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]+)$/.exec(cookieValue(req));
    if (!match || Number(match[1]) < Date.now()) return null;
    if (!safeEqual(match[3], sign(match[1], match[2]))) return null;
    return { expires: Number(match[1]), id: match[2] };
  }

  function validSession(req) {
    const session = parseCookie(req);
    return !!session && sessions.has(session.id);
  }

  function hasBasicAuth(req) {
    return /^Basic /i.test(req.get("Authorization") || "");
  }

  function validBasicAuth(req) {
    const received = req.get("Authorization") || "";
    return (
      !!received &&
      safeEqual(received, "Basic " + Buffer.from("admin:" + password).toString("base64"))
    );
  }

  function setCookie(req, res, value, maxAgeSeconds) {
    const attributes = [
      COOKIE + "=" + encodeURIComponent(value),
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=" + maxAgeSeconds
    ];
    if (req.secure || req.get("x-forwarded-proto") === "https") attributes.push("Secure");
    res.set("Set-Cookie", attributes.join("; "));
  }

  function openSession(req, res, expiresAt) {
    const id = crypto.randomBytes(18).toString("base64url");
    sessions.add(id, expiresAt);
    const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    setCookie(req, res, `${expiresAt}.${id}.${sign(expiresAt, id)}`, seconds);
  }

  function closeSession(req, res) {
    const session = parseCookie(req);
    if (session) sessions.remove(session.id);
    setCookie(req, res, "", 0);
  }

  return { validSession, validBasicAuth, hasBasicAuth, openSession, closeSession };
}

module.exports = { createAuth };
