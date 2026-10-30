"use strict";
const assert = require("assert");
const { securityHeaders } = require("../lib/http/security-headers");

function headers({ secure = false, forwarded = "" } = {}) {
  const result = {};
  let continued = false;
  securityHeaders(
    { secure, get: name => (name === "x-forwarded-proto" ? forwarded : undefined) },
    {
      set: (name, value) => {
        result[name] = value;
      }
    },
    () => {
      continued = true;
    }
  );
  assert.equal(continued, true);
  return result;
}

const plain = headers();
assert.equal(plain["X-Content-Type-Options"], "nosniff");
assert.equal(plain["X-Frame-Options"], "DENY");
assert.equal(plain["Referrer-Policy"], "no-referrer");
assert.match(plain["Content-Security-Policy"], /default-src 'none'/);
assert.match(plain["Content-Security-Policy"], /frame-ancestors 'none'/);
assert.equal(plain["Strict-Transport-Security"], undefined);
assert.equal(
  headers({ secure: true })["Strict-Transport-Security"],
  "max-age=63072000; includeSubDomains"
);
// A client cannot switch HSTS on by sending X-Forwarded-Proto itself: Express
// only trusts that header (through req.secure) when TRUST_PROXY is set.
assert.equal(headers({ forwarded: "https" })["Strict-Transport-Security"], undefined);
console.log("PASS sécurité : en-têtes HTTP et politique HTTPS");
