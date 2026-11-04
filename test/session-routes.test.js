"use strict";
// Login routes on a real Express app: protected images, logged failures and
// the block after repeated wrong passwords.
const assert = require("assert");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAuth } = require("../lib/http/auth");
const { SessionStore } = require("../lib/http/session-store");
const { createAuthFailures } = require("../lib/http/auth-failures");
const { registerSessionRoutes } = require("../lib/routes/session");
const { registerIconRoutes } = require("../lib/routes/icons");

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-session-"));
  const iconsDir = path.join(dir, "icons");
  fs.mkdirSync(iconsDir);
  fs.writeFileSync(path.join(iconsDir, "nas.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const warnings = [];
  const log = { info: () => {}, warn: message => warnings.push(message), error: () => {} };

  const app = express();
  app.use(express.json());
  registerSessionRoutes(app, {
    password: "pw",
    auth: createAuth({ password: "pw", sessions: new SessionStore(path.join(dir, "s.json")) }),
    failures: createAuthFailures({ max: 3 }),
    rateLimit: (_req, _res, next) => next(),
    log
  });
  registerIconRoutes(app, { iconsDir, log });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = password =>
    fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

  try {
    // Uploaded images name the services: they need a session too.
    assert.equal((await fetch(base + "/icons/nas.png")).status, 401);
    const basic = "Basic " + Buffer.from("admin:pw").toString("base64");
    const image = await fetch(base + "/icons/nas.png", { headers: { Authorization: basic } });
    assert.equal(image.status, 200);
    assert.match(image.headers.get("cache-control"), /private/);

    // Each wrong password is logged; the third one blocks and says so.
    for (let i = 0; i < 3; i++) assert.equal((await login("bad")).status, 401);
    assert.equal(warnings.filter(line => /^Login failed from /.test(line)).length, 3);
    assert.ok(warnings.some(line => /blocked for \d+ s/.test(line)));
    // Blocked: even the right password waits, with the delay to show.
    const blocked = await login("pw");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("PASS connexion : images protegees, echecs journalises, blocage");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
