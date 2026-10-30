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
  registerConfigRoutes(app, {
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
    logger: { error: () => {} }
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
  console.log("PASS configuration : ecritures, conflits et compteurs");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
