"use strict";
const assert = require("assert");
const {
  sanitizeLinkCounter,
  sanitizeFortune,
  sanitizeHostMonitoring
} = require("../lib/config/fields");
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
  sanitizeHostMonitoring({
    type: "local",
    enabled: true,
    path: " /host ",
    smart: { disks: ["disk", "disk"] }
  }),
  {
    enabled: true,
    type: "local",
    path: "/host",
    smart: { enabled: true, disks: ["disk"] }
  }
);
console.log("PASS configuration : champs de supervision et tuiles");
