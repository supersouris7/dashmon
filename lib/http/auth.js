"use strict";
const crypto = require("crypto");

function createAuth({ password }) {
  function cookieValue(req, name) {
    const prefix = name + "=";
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
  function sessionValue(expiresAt, nonce = crypto.randomBytes(18).toString("base64url")) {
    const expires = String(expiresAt);
    const signature = crypto
      .createHmac("sha256", password)
      .update("dashmon-session:" + expires + ":" + nonce)
      .digest("base64url");
    return expires + "." + nonce + "." + signature;
  }
  function validSession(req) {
    const value = cookieValue(req, "dashmon_session");
    const match = /^(\d{13})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(value);
    if (!match || Number(match[1]) < Date.now()) return false;
    const expected = Buffer.from(sessionValue(match[1], match[2]));
    const received = Buffer.from(value);
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }
  function validBasicAuth(req) {
    const expected = "Basic " + Buffer.from("admin:" + password).toString("base64");
    const received = Buffer.from(req.get("Authorization") || "");
    return (
      received.length === Buffer.byteLength(expected) &&
      received.length > 0 &&
      crypto.timingSafeEqual(received, Buffer.from(expected))
    );
  }
  function setSessionCookie(req, res, expiresAt) {
    const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const attributes = [
      "dashmon_session=" + encodeURIComponent(sessionValue(expiresAt)),
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=" + seconds
    ];
    if (req.secure || req.get("x-forwarded-proto") === "https") attributes.push("Secure");
    res.set("Set-Cookie", attributes.join("; "));
  }
  return { validSession, validBasicAuth, setSessionCookie };
}
module.exports = { createAuth };
