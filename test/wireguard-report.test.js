"use strict";
const assert = require("assert");
const { readWireguardDump, normalizeWireguard } = require("../lib/host/wireguard-report");
const filesystem = {
  statSync: () => ({ isFile: () => true, size: 0, mtimeMs: 100000 }),
  readFileSync: () => "wg0\t\t\t\t\n"
};
assert.deepEqual(readWireguardDump("report", { filesystem }), {
  interfaces: [{ interface: "wg0", peers: [] }],
  fetchedAt: 100
});
assert.equal(
  readWireguardDump("missing", {
    filesystem: {
      statSync: () => {
        throw new Error();
      }
    }
  }),
  null
);
const interfaces = normalizeWireguard([
  { interface: "wg0", peers: [{ name: "peer", rx: 0, tx: -1, latestHandshake: 0 }] }
]);
assert.equal(interfaces[0].peers[0].rx, 0);
assert.equal(interfaces[0].peers[0].tx, null);
assert.equal(interfaces[0].peers[0].latestHandshake, null);
console.log("PASS WireGuard : lecture et validation du rapport");
