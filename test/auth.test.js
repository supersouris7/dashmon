"use strict";
// Web authentication: revocable sessions, constant-time checks, brute-force
// protection.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAuth } = require("../lib/http/auth");
const { SessionStore, MAX_SESSIONS } = require("../lib/http/session-store");
const { createAuthFailures } = require("../lib/http/auth-failures");
const { safeEqual } = require("../lib/http/safe-equal");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-auth-"));
const file = path.join(dir, "sessions.json");

// Minimal request / response doubles.
const request = (headers = {}) => ({ ip: "198.51.100.7", get: name => headers[name] });
function login(auth) {
  let cookie = "";
  auth.openSession(request(), { set: (_name, value) => (cookie = value) }, Date.now() + 60000);
  return cookie.split(";")[0];
}

try {
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abcd"));

  const auth = createAuth({ password: "pw", sessions: new SessionStore(file) });
  const cookie = login(auth);
  assert.ok(auth.validSession(request({ Cookie: cookie })));
  // The session survives a restart (new store reading the same file).
  const restarted = createAuth({ password: "pw", sessions: new SessionStore(file) });
  assert.ok(restarted.validSession(request({ Cookie: cookie })));
  // A changed password invalidates it; a forged signature is refused.
  const other = createAuth({ password: "other", sessions: new SessionStore(file) });
  assert.ok(!other.validSession(request({ Cookie: cookie })));
  assert.ok(
    !auth.validSession(
      request({ Cookie: cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A") })
    )
  );

  // Logging out revokes the cookie, even if a copy is kept.
  restarted.closeSession(request({ Cookie: cookie }), { set: () => {} });
  assert.ok(
    !createAuth({ password: "pw", sessions: new SessionStore(file) }).validSession(
      request({ Cookie: cookie })
    )
  );

  // The store keeps a bounded number of sessions, oldest dropped first.
  const store = new SessionStore(file);
  for (let i = 0; i < MAX_SESSIONS + 5; i++) store.add("s" + i, Date.now() + 60000);
  assert.ok(!store.has("s0") && store.has("s" + (MAX_SESSIONS + 4)));

  // HTTP Basic auth, user "admin".
  const basic = "Basic " + Buffer.from("admin:pw").toString("base64");
  assert.ok(auth.validBasicAuth(request({ Authorization: basic })));
  assert.ok(!auth.validBasicAuth(request({ Authorization: basic + "x" })));

  // Brute force: blocked after the limit, until the window ends; a success
  // resets the counter.
  let time = 0;
  const failures = createAuthFailures({ max: 3, windowMs: 1000, now: () => time });
  const client = request();
  failures.fail(client);
  failures.fail(client);
  assert.equal(failures.retryAfter(client), 0);
  failures.fail(client);
  assert.equal(failures.retryAfter(client), 1);
  time = 1001;
  assert.equal(failures.retryAfter(client), 0);
  failures.fail(client);
  failures.succeed(client);
  failures.fail(client);
  failures.fail(client);
  assert.equal(failures.retryAfter(client), 0);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("PASS authentification : sessions revocables et protection contre la force brute");
