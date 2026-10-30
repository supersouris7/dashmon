"use strict";
const assert = require("assert");
const { verifyRequestOrigin } = require("../lib/http/request-origin");

function check(method, origin, host, secure = false, extra = {}) {
  let result = "allowed";
  const headers = { Origin: origin, Host: host, ...extra };
  const req = { method, secure, get: name => headers[name] };
  const res = {
    status: code => ({
      json: () => {
        result = code;
      }
    })
  };
  verifyRequestOrigin(req, res, () => {});
  return result;
}

assert.equal(check("POST", "http://exemple.lan", "exemple.lan"), "allowed");
assert.equal(check("POST", "https://exemple.lan", "exemple.lan", true), "allowed");
assert.equal(check("POST", "http://exemple.lan:8080", "exemple.lan:8080"), "allowed");
assert.equal(check("POST", "http://autre.exemple.lan", "exemple.lan"), 403);
assert.equal(check("POST", "invalid", "exemple.lan"), 403);
assert.equal(check("POST", undefined, "exemple.lan"), "allowed");
assert.equal(check("GET", "http://autre.exemple.lan", "exemple.lan"), "allowed");
// Behind a proxy without TRUST_PROXY the connection looks like plain HTTP:
// an https Origin on the same host stays allowed.
assert.equal(check("POST", "https://exemple.lan", "exemple.lan"), "allowed");
// A connection known to be HTTPS refuses an http Origin.
assert.equal(check("POST", "http://exemple.lan", "exemple.lan", true), 403);
// Another port of the same host is another origin.
assert.equal(check("POST", "http://exemple.lan:9000", "exemple.lan:8080"), 403);
assert.equal(check("POST", "http://[::1]:8080", "[::1]:8080"), "allowed");
// X-Forwarded-Proto sent by the client changes nothing.
assert.equal(
  check("POST", "http://exemple.lan", "exemple.lan", false, { "X-Forwarded-Proto": "https" }),
  "allowed"
);
assert.equal(check("POST", "ftp://exemple.lan", "exemple.lan"), 403);
console.log("PASS sécurité : contrôle d'origine des requêtes");
