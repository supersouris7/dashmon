"use strict";
const assert = require("assert");
const {
  sanitizeLinkCounter,
  sanitizeSpecialTile,
  sanitizeHostMonitoring
} = require("../lib/config/fields");
assert.equal(sanitizeLinkCounter({ type: "unknown", target: "repo" }), null);
assert.deepEqual(sanitizeLinkCounter({ type: "github", target: " repo " }), {
  type: "github",
  target: "repo"
});
assert.equal(sanitizeSpecialTile({ type: "invalid" }, []), null);
assert.deepEqual(sanitizeSpecialTile({ type: "fortune" }, [{ name: "Groupe" }]), {
  type: "fortune",
  category: "Groupe"
});
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
