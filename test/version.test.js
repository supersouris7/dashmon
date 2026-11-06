"use strict";
// Version label of the footer: release, commit, code mounted from the host.
const assert = require("assert");
const { describeVersion, appIsMounted, releaseLabel } = require("../lib/version");

const SHA = "9edaf2df0103ab3e90d3d636b6c51f7cb93e9225";

// The data volume (always mounted) is not code: the commit stays.
assert.equal(appIsMounted(["/", "/app/data", "/etc/hosts"], "/app/data"), false);
assert.equal(appIsMounted(["/app/data/opencode.json"], "/app/data"), false);
assert.equal(
  describeVersion({ release: "", commit: SHA, dataDir: "/app/data" }, ["/", "/app/data"]).label,
  "unstable · 9edaf2d"
);
// Code mounted from the host: the image commit no longer describes it.
assert.equal(appIsMounted(["/app"], "/app/data"), true);
assert.equal(appIsMounted(["/app/lib"], "/app/data"), true);
assert.equal(appIsMounted(["/app/database"], "/app/data"), true);
assert.equal(
  describeVersion({ release: "", commit: SHA, dataDir: "/app/data" }, ["/app"]).label,
  "unstable"
);
// Mount information unavailable: nothing is hidden.
assert.equal(appIsMounted(null), null);
assert.equal(describeVersion({ release: "v1.2.0", commit: SHA }, null).label, "v1.2.0 · 9edaf2d");
assert.equal(describeVersion({ release: "", commit: "unknown" }, []).label, "unstable");
assert.equal(releaseLabel("1.2.0"), "v1.2.0");

console.log(
  "PASS version : commit affiche malgre le volume de donnees, masque si le code est monte"
);
