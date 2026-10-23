"use strict";
// Widget WireGuard : pairs lus depuis un dump local (`wg show all dump`).
//
// Independant de la supervision des hotes : le fichier vient de
// WIREGUARD_DUMP_FILE (defaut DATA_DIR/wireguard.dump). Le chemin n'est jamais
// pris dans la configuration web (lecture d'un fichier arbitraire interdite).
// Voir docs/WIREGUARD.md pour generer le dump.

const fs = require("fs");
const path = require("path");

const CONNECTED_SECONDS = 180;
const MAX_INTERFACES = 10;
const MAX_PEERS = 200;
const MAX_FILE_BYTES = 1000000;

function dumpFile() {
  const fromEnv = String(process.env.WIREGUARD_DUMP_FILE || "").trim();
  if (fromEnv) return fromEnv;
  const dataDir = String(process.env.DATA_DIR || "").trim()
    || path.join(__dirname, "..", "..", "data");
  return path.join(dataDir, "wireguard.dump");
}

// Parse la sortie tabulee de `wg show all dump` : une ligne d'interface a 5
// champs, une ligne de pair en a 9. Un fichier absent ou illisible renvoie null.
function readDump(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (_error) {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;

  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (_error) {
    return null;
  }

  const byInterface = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    const name = String(fields[0] || "").slice(0, 50);
    if (!name) continue;
    if (fields.length >= 9) {
      const entry = byInterface.get(name) || { name, peers: [] };
      byInterface.set(name, entry);
      if (entry.peers.length >= MAX_PEERS) continue;
      const handshake = Number(fields[5]);
      entry.peers.push({
        name: String(fields[1] || "").slice(0, 80),
        endpoint: fields[3] === "(none)" ? "" : String(fields[3] || "").slice(0, 120),
        latestHandshake: Number.isFinite(handshake) && handshake > 0 ? Math.floor(handshake) : null
      });
    } else if (!byInterface.has(name)) {
      byInterface.set(name, { name, peers: [] });
    }
  }
  return [...byInterface.values()].slice(0, MAX_INTERFACES);
}

function connectedCount(peers) {
  const now = Math.floor(Date.now() / 1000);
  return peers.filter(peer =>
    peer.latestHandshake && (now - peer.latestHandshake) <= CONNECTED_SECONDS
  ).length;
}

async function check(ctx) {
  const interfaces = readDump(dumpFile());
  if (!interfaces) {
    return { ok: false, error: ctx.t("noDump"), interfaces: null, peers: null };
  }
  const wanted = String(ctx.config.interface || "").trim();
  const shown = wanted ? interfaces.filter(item => item.name === wanted) : interfaces;
  const total = shown.reduce((count, item) => count + item.peers.length, 0);
  const connected = shown.reduce((count, item) => count + connectedCount(item.peers), 0);
  return {
    ok: true,
    interfaces: shown,
    peers: { total, connected },
    updatedAt: Date.now()
  };
}

module.exports = { check };
