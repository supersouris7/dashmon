"use strict";
const assert = require("assert");
const { registerConfigRoutes } = require("../lib/routes/config");

async function main() {
  const routes = {};
  const app = {
    get: (_path, handler) => (routes.get = handler),
    put: (_path, handler) => (routes.put = handler),
    patch: (_path, handler) => (routes.patch = handler),
    post: (_path, handler) => (routes.post = handler)
  };
  let config = { theme: "dark", usageCounts: { service: 4 } };
  let writes = 0;
  const { flushUsage } = registerConfigRoutes(app, {
    readConfig: () => structuredClone(config),
    writeConfig: value => {
      config = structuredClone(value);
      writes++;
    },
    revision: value => JSON.stringify(value.theme),
    normalize: value => structuredClone(value),
    ensureHostIds: () => {},
    forBrowser: value => value,
    restoreSecrets: value => value,
    logger: { error: () => {} },
    usageFlushDelay: 60000
  });
  async function send(method, body, headers = {}) {
    const result = { status: 200, headers: {} };
    const res = {
      set: (name, value) => {
        result.headers[name] = value;
      },
      status: code => {
        result.status = code;
        return res;
      },
      json: value => {
        result.body = value;
        return res;
      }
    };
    await routes[method]({ body, get: name => headers[name] }, res);
    return result;
  }
  assert.equal((await send("put", null)).status, 400);
  assert.equal((await send("get")).headers["Cache-Control"], "no-store");
  assert.equal((await send("put", { theme: "light" }, { "If-Match": '"ancien"' })).status, 412);
  assert.equal(writes, 0);
  assert.equal(
    (await send("put", { theme: "light", usageCounts: {} }, { "If-Match": '"dark"' })).status,
    200
  );
  assert.deepEqual(config.usageCounts, { service: 4 });
  assert.equal((await send("patch", { theme: "dark" }, { "If-Match": '"light"' })).status, 200);
  assert.equal(config.theme, "dark");
  const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true}}');
  assert.equal((await send("patch", malicious)).status, 200);
  assert.equal(config.polluted, undefined);
  assert.equal(Object.hasOwn(config, "constructor"), false);
  // Clicks are only counted for existing services.
  // They are grouped: nothing is written per click, the GET already sees
  // them, and the flush (timer or shutdown) writes them once.
  config.services = [{ url: "service" }, { name: "Nas", host: "box", category: "" }];
  const before = writes;
  assert.equal((await send("post", { key: "service" })).status, 200);
  assert.equal((await send("post", { key: "service" })).status, 200);
  assert.equal((await send("post", { key: "Nas|box|" })).status, 200);
  assert.equal((await send("post", { key: "unknown" })).status, 400);
  assert.equal(writes, before);
  assert.equal(config.usageCounts.service, 4);
  assert.equal((await send("get")).body.usageCounts.service, 6);
  flushUsage();
  assert.equal(writes, before + 1);
  assert.equal(config.usageCounts.service, 6);
  assert.equal(config.usageCounts["Nas|box|"], 1);
  assert.equal(config.usageCounts.unknown, undefined);
  flushUsage();
  assert.equal(writes, before + 1);
  // Counts replaced on purpose drop the clicks still pending.
  await send("post", { key: "service" });
  await send("put", { theme: "dark", usageCounts: {} }, { "X-Dashmon-Replace-Usage": "1" });
  flushUsage();
  assert.deepEqual(config.usageCounts, {});
  console.log("PASS configuration : ecritures, conflits et compteurs");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
