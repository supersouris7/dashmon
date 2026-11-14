"use strict";
// WireGuard card: peers of the "wg show all dump" written by
// deploy/wireguard-dump.sh, optionally limited to one interface. A dump
// without any interface still gives a card, which says so.
const { readWireguardDump } = require("./report");

function collect(ctx) {
  const dump = readWireguardDump(ctx.files.dump);
  if (!dump) return null;
  const wanted = ctx.prefs.interface;
  return {
    interfaces: wanted
      ? dump.interfaces.filter(item => item.interface === wanted)
      : dump.interfaces,
    fetchedAt: dump.fetchedAt,
    scriptVersion: dump.scriptVersion
  };
}

module.exports = { collect };
