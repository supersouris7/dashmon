"use strict";
const assert = require("assert");
const {
  sanitizeLinkCounter,
  sanitizeFortune,
  sanitizeHostMonitoring
} = require("../lib/config/fields");
const { bundledSchemas } = require("./supervisions/schemas");
assert.equal(sanitizeLinkCounter({ type: "unknown", target: "repo" }), null);
assert.deepEqual(sanitizeLinkCounter({ type: "github", target: " repo " }), {
  type: "github",
  target: "repo"
});
// Fortune Cookie bar: off by default, turned on by an older special tile, and
// an explicit choice wins.
assert.equal(sanitizeFortune({}), false);
assert.equal(sanitizeFortune({ fortune: true }), true);
assert.equal(sanitizeFortune({ fortune: "yes" }), false);
assert.equal(sanitizeFortune({ specialTile: { type: "fortune", category: "Divers" } }), true);
assert.equal(sanitizeFortune({ specialTile: { type: "bidon" } }), false);
assert.equal(sanitizeFortune({ fortune: false, specialTile: { type: "fortune" } }), false);
assert.equal(sanitizeHostMonitoring({ type: "remote", enabled: true }), undefined);
assert.equal(sanitizeHostMonitoring({ type: "local", enabled: false }), undefined);
assert.deepEqual(
  sanitizeHostMonitoring(
    {
      type: "local",
      enabled: true,
      path: " /host ",
      smart: { disks: ["disk", "disk"] }
    },
    bundledSchemas()
  ),
  {
    enabled: true,
    type: "local",
    path: "/host",
    smart: { enabled: true, disks: ["disk"] }
  }
);
// Settings of a plugin that is not installed (or not loaded yet) are kept
// within bounds, never dropped: reinstalling it finds them again.
assert.deepEqual(
  sanitizeHostMonitoring({
    enabled: true,
    smart: { disks: ["disk", "disk"] },
    plugins: { absent: { enabled: false, note: "x<y>" }, Bad: { enabled: false } }
  }).plugins,
  { absent: { enabled: false, note: "xy" } }
);
assert.deepEqual(
  sanitizeHostMonitoring({ enabled: true, smart: { disks: ["disk", "disk"] } }).smart,
  { enabled: true, disks: ["disk", "disk"] }
);
console.log("PASS configuration : champs de supervision et tuiles");
