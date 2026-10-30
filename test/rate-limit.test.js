"use strict";
const assert = require("assert");
const { createRateLimiter } = require("../lib/http/rate-limit");

let now = 1000;
const limiter = createRateLimiter({
  windowMs: 60000,
  max: 2,
  retryAfter: true,
  now: () => now,
  skip: req => req.method === "GET"
});
function request(ip, method = "POST") {
  const result = { status: 200, headers: {} };
  const res = {
    set: (key, value) => {
      result.headers[key] = value;
    },
    status: code => ({
      json: () => {
        result.status = code;
      }
    })
  };
  limiter.middleware({ ip, method }, res, () => {});
  return result;
}
assert.equal(request("a").status, 200);
assert.equal(request("a", "GET").status, 200);
assert.equal(request("a").status, 200);
assert.equal(request("a").status, 429);
assert.equal(request("a").headers["Retry-After"], "60");
assert.equal(request("b").status, 200);
now += 60001;
assert.equal(request("a").status, 200);
now += 120001;
limiter.cleanup();
assert.equal(request("a").status, 200);
console.log("PASS sécurité : limitation par client et expiration");
