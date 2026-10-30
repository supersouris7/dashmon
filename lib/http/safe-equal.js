"use strict";
// Constant-time comparison of two secrets. Both values are first reduced to an
// HMAC with a random per-process key: the comparison then always runs on 32
// bytes, so its duration reveals neither the content nor the length.

const crypto = require("crypto");

const KEY = crypto.randomBytes(32);
const digest = value => crypto.createHmac("sha256", KEY).update(String(value)).digest();

function safeEqual(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

module.exports = { safeEqual };
