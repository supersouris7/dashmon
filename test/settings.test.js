"use strict";
const assert = require("assert");
const path = require("path");
const { readSettings } = require("../lib/config/settings");
const { releaseLabel } = require("../lib/version");

const root = path.join(path.sep, "app");
const read = (env, runningInDocker = false) => readSettings(env, { root, runningInDocker });

// Defaults: everything lives under data/ next to the code.
const defaults = read({});
assert.equal(defaults.port, 8080);
assert.equal(defaults.bindAddress, "127.0.0.1");
assert.equal(defaults.configFile, path.join(root, "data", "config.json"));
assert.equal(defaults.themesNativeDir, path.join(root, "public", "themes"));
assert.equal(defaults.hostMetricsInterval, 60000);
assert.equal(defaults.agentMode, false);

// A password opens the server to the network; DATA_DIR moves every data file.
const custom = read({ DASHMON_PASSWORD: "x", DATA_DIR: "/data", HOST_METRICS_INTERVAL: "9999" });
assert.equal(custom.bindAddress, "0.0.0.0");
assert.equal(custom.iconsDir, path.join("/data", "icons"));
assert.equal(custom.hostMetricsInterval, 3600 * 1000);
assert.equal(read({ HOST_METRICS_INTERVAL: "2" }).hostMetricsInterval, 60000);

// Refused combinations stop the start-up.
assert.throws(() => read({ DASHMON_MODE: "agent", DASHMON_PASSWORD: "x" }), /DASHMON_SYNC_TOKEN/);
assert.throws(() => read({}, true), /DASHMON_PASSWORD/);
assert.equal(read({ DASHMON_PASSWORD: "x" }, true).password, "x");

// Release label shown in the footer.
assert.equal(releaseLabel("1.2.3"), "v1.2.3");
assert.equal(releaseLabel("v2.0"), "v2.0");
assert.equal(releaseLabel(""), "unstable");
assert.equal(releaseLabel("main"), "unstable");

console.log("PASS configuration : variables d'environnement lues et validees");
