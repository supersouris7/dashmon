"use strict";
// Le schema de configuration existe deux fois : lib/config/normalize.js sur le
// serveur, public/js/config/normalize.js dans le navigateur. Ce test passe les
// memes configurations dans les deux et verifie qu'ils s'accordent :
//
//   1. pour les champs sans valeur par defaut propre au navigateur, les deux
//      sorties sont identiques ;
//   2. une configuration chargee puis renvoyee telle quelle par le navigateur
//      ressort du serveur sans changement (aucune perte a l'enregistrement).
//
// Les widgets ont leur propre test de schema (frontend.test.js) : ici les
// services n'en ont pas.
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { createConfigNormalizer } = require("../lib/config/normalize");
const { createReplicationConfig } = require("../lib/agent/replication-config");
const { sanitizeText, sanitizeUrl } = require("../lib/sanitize");

const pairing = createReplicationConfig({ sanitizeUrl, sanitizeText, defaultName: "Dashmon" });
const server = createConfigNormalizer({
  serializeWidget: widget => widget || null,
  sanitizeReplication: pairing.sanitizeReplication
});

// Champs dont la valeur ne depend que de l'entree, des deux cotes.
const SAME_KEYS = [
  "dashboards",
  "fortune",
  "replication",
  "collapsed",
  "viewMode",
  "openMode",
  "groupMode",
  "theme",
  "language",
  "sortMode",
  "usageCounts",
  "webLinks",
  "webLinksSeedVersion",
  "smallIcons"
];

const AGENT = "http://192.0.2.10:8080/";
const FIXTURES = {
  vide: {},
  "langue inconnue": { language: "de", theme: "  " },
  complete: {
    language: "fr",
    theme: "polar",
    viewMode: "rows",
    openMode: "new",
    groupMode: "host",
    sortMode: "usage",
    smallIcons: true,
    dashboards: [
      { id: "main", name: "Principal", icon: "fa-solid fa-house" },
      { id: "media", name: "Medias", icon: "fa-solid fa-film" }
    ],
    categories: [
      { name: "Reseau", icon: "fa-solid fa-network-wired", color: "#7eaaee", dashboardId: "main" },
      { name: "Films", icon: "fa-solid fa-film", color: "#06d6a0", dashboardId: "media" }
    ],
    hosts: [
      {
        id: "host-a",
        name: "Serveur",
        icon: "fa-solid fa-server",
        color: "#ffd166",
        tabIcon: "fa-solid fa-house",
        monitoring: {
          enabled: true,
          type: "local",
          path: "/host",
          wireguard: { enabled: true, interface: "wg0" },
          smart: { enabled: true, disks: ["/dev/sda", "/dev/sda"] },
          speedtest: { interval: 360, server: "http://speed.exemple.lan/backend/" },
          aptUpdates: { enabled: false },
          opencode: { enabled: false },
          claude: { enabled: true }
        }
      },
      { id: "host-b", name: "Nas", icon: "fa-solid fa-hard-drive", color: "#ef476f" }
    ],
    services: [
      {
        name: "Portainer",
        host: "Serveur",
        category: "Reseau",
        url: "https://portainer.exemple.lan",
        icon: "icons/portainer.png",
        monitor: "soft"
      }
    ],
    specialTile: { type: "fortune", category: "Films" },
    replication: {
      instanceName: "Maison",
      secondaries: [AGENT, AGENT, "http://198.51.100.4:8080/?x=1", "ftp://192.0.2.3/"],
      agentNames: { [AGENT]: "Atelier", "http://198.51.100.9/": "Inconnu" },
      agentIcons: { [AGENT]: "fa-solid fa-hammer" },
      agentHosts: { [AGENT]: "host-b" }
    },
    collapsed: { "category:Reseau": true, "host:Nas": false, bad: "oui" },
    usageCounts: { Portainer: 4.7, negatif: -2, texte: "x" },
    webLinks: [
      {
        name: "Depot",
        url: "https://exemple.lan/depot",
        icon: "fa-brands fa-github",
        counter: { type: "github", target: "exemple/depot" }
      },
      { name: "Sans compteur", url: "https://exemple.lan", icon: "fa-solid fa-globe" }
    ],
    webLinksSeedVersion: 2
  },
  "anciens champs": {
    hosts: [
      {
        id: "pve",
        name: "Ancien",
        color: "#a78bfa",
        monitoring: {
          enabled: true,
          type: "proxmox",
          url: "https://192.0.2.20:8006",
          node: "pve",
          tokenIdEnv: "A",
          tokenSecretEnv: "B"
        }
      },
      {
        id: "loc",
        name: "Local",
        color: "#f78c6b",
        monitoring: { enabled: true, url: "https://192.0.2.21", node: "x", tokenIdEnv: "A" }
      }
    ]
  }
};

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name + "\n" + error.message);
  }
}

async function main() {
  const client = await import(
    pathToFileURL(path.join(__dirname, "..", "public", "js", "config", "normalize.js")).href
  );
  for (const [label, raw] of Object.entries(FIXTURES)) {
    const fromServer = server(structuredClone(raw));
    const fromClient = client.normalizeConfig(structuredClone(raw));
    check(`parite : memes champs (${label})`, () => {
      for (const key of SAME_KEYS) {
        assert.deepStrictEqual(fromClient[key], fromServer[key], key);
      }
    });
    check(`parite : rechargement sans perte (${label})`, () => {
      const loaded = client.normalizeConfig(structuredClone(fromServer));
      const saved = server(structuredClone(loaded));
      // Le navigateur attribue une couleur a chaque section sans couleur : les
      // fixtures en ont deja, la comparaison porte donc sur tout le reste.
      assert.deepStrictEqual(saved, fromServer);
    });
  }
  check("parite : anciens champs Proxmox ignores des deux cotes", () => {
    const hosts = client.normalizeConfig(structuredClone(FIXTURES["anciens champs"])).hosts;
    assert.equal(hosts[0].monitoring, null);
    assert.deepStrictEqual(
      Object.keys(hosts[1].monitoring).sort(),
      [
        "aptUpdates",
        "claude",
        "enabled",
        "speedtest",
        "opencode",
        "path",
        "smart",
        "type",
        "wireguard"
      ].sort()
    );
  });
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
