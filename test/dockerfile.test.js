"use strict";
// The image healthcheck asks the port the server really listens on.
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const dockerfile = fs.readFileSync(path.join(__dirname, "..", "Dockerfile"), "utf8");
const script = /HEALTHCHECK[^]*?CMD node -e "([^"]+)"/.exec(dockerfile)?.[1];
assert.ok(script, "HEALTHCHECK node -e script");

const server = http.createServer((req, res) => {
  res.writeHead(req.url === "/healthz" ? 200 : 404);
  res.end();
});
server.listen(0, "127.0.0.1", () => {
  const port = String(server.address().port);
  // spawnSync would block the event loop that answers the probe: run the
  // check in a child while this process keeps serving.
  const child = spawn(process.execPath, ["-e", script], {
    env: { ...process.env, PORT: port }
  });
  child.on("exit", code => {
    server.close();
    assert.equal(code, 0, "healthcheck on PORT " + port);
    const down = spawnSync(process.execPath, ["-e", script], {
      env: { ...process.env, PORT: "1" }
    });
    assert.equal(down.status, 1, "healthcheck fails when nothing answers");
    console.log("PASS image : le healthcheck suit PORT");
  });
});
