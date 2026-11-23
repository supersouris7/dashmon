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

// Reads: 120 per minute and per client; the page makes about 3 reads per
// 5 minutes and per open tab (status, host metrics, replication), so even
// 20 tabs stay far below the limit.
{
  const clock = 0;
  const reads = createRateLimiter({ windowMs: 60000, max: 120, now: () => clock });
  const read = () => {
    let status = 200;
    const res = { set() {}, status: code => ({ json: () => (status = code) }) };
    reads.middleware({ ip: "tabs", method: "GET" }, res, () => {});
    return status;
  };
  const perTabPerMinute = 3 / 5;
  assert.ok(20 * perTabPerMinute < 120 / 5);
  for (let i = 0; i < 120; i++) assert.equal(read(), 200);
  assert.equal(read(), 429);
}
console.log("PASS sécurité : limite de lectures par client");
