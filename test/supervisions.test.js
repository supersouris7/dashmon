"use strict";
// Supervision plugins (supervisions/<id>/, lib/supervisions/core.js): the
// template loads as a real plugin, a broken plugin only loses its own card,
// reports stay bounded, data files stay inside the data folder, and the
// browser descriptor is checked before drawing.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { SupervisionCore } = require("../lib/supervisions/core");
const { sanitizeText } = require("../lib/sanitize");
const { ROOT, check, ok, run } = require("./widgets/helpers");

const TEMPLATE = path.join(ROOT, "supervisions", "_template");

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-supervision-" + name + "-"));
}

// A plugin folder written from a few lines of code.
function plugin(root, id, serverCode, manifest = {}) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ id, version: "1.0.0", label: id, server: "server.js", ...manifest })
  );
  fs.writeFileSync(path.join(dir, "server.js"), serverCode);
}

async function core(roots, options = {}) {
  const lines = [];
  const instance = new SupervisionCore({
    roots,
    dataDir: options.dataDir || tempDir("data"),
    log: line => lines.push(line),
    sanitizeText,
    env: {},
    timeout: options.timeout
  });
  await instance.load();
  return { instance, lines };
}

const HOST = { id: "local", name: "Serveur", monitoring: { enabled: true, type: "local" } };

async function serverSide() {
  const root = tempDir("plugins");
  fs.cpSync(TEMPLATE, path.join(root, "my-card"), { recursive: true });
  plugin(root, "throws", "module.exports = { collect() { throw new Error('boom'); } };");
  plugin(root, "slow", "module.exports = { collect: () => new Promise(() => {}) };");
  plugin(root, "huge", "module.exports = { collect: () => ({ text: 'x'.repeat(270000) }) };");
  plugin(root, "nothing", "module.exports = { collect: () => null };");
  plugin(root, "array", "module.exports = { collect: () => [1, 2] };");
  plugin(root, "no-entry", "module.exports = { check() {} };");
  plugin(
    root,
    "data-file",
    `module.exports = { collect: ctx => ({
      good: ctx.readDataFile("report.json"),
      escape: ctx.readDataFile("../report.json"),
      big: ctx.readDataFile("big.json", { maxBytes: 10 })
    }) };`
  );
  plugin(
    root,
    "memory",
    `module.exports = {
      createState: () => ({ runs: 0 }),
      collect: ctx => {
        ctx.state.runs++;
        ctx.storage.write("runs", ctx.state.runs);
        return { runs: ctx.state.runs, stored: ctx.storage.read("runs", 0), host: ctx.host.name };
      }
    };`
  );
  const dataDir = tempDir("data");
  fs.writeFileSync(path.join(dataDir, "report.json"), JSON.stringify({ value: 7 }));
  fs.writeFileSync(path.join(dataDir, "big.json"), JSON.stringify({ value: "too large" }));
  fs.writeFileSync(path.join(path.dirname(dataDir), "report.json"), "{}");

  const { instance, lines } = await core([root], { dataDir, timeout: 100 });
  const meta = instance.publicList().find(item => item.id === "my-card");
  check(
    "registre : le modele se charge comme un vrai plugin",
    {
      icon: meta.icon,
      hasClient: meta.hasClient,
      label: meta.label.en
    },
    { icon: "fa-solid fa-gauge-high", hasClient: true, label: "System load" }
  );
  ok(
    "registre : un module serveur sans collect() est refuse",
    !instance.ids().includes("no-entry") &&
      lines.some(line => line.includes("no-entry") && line.includes("collect(ctx)"))
  );
  ok(
    "registre : le code serveur n'est jamais servi au navigateur",
    instance.asset("my-card", "client.mjs") &&
      !String(instance.asset("my-card", "client.mjs").body).includes("loadavg") &&
      instance.asset("my-card", "server.js") === null &&
      instance.asset("my-card", "../my-card/server.js") === null &&
      instance.asset("throws", "client.mjs") === null
  );

  const first = await instance.collect(HOST);
  ok(
    "collecte : le rapport du modele est range sous son id",
    first["my-card"].cores >= 1 && Number.isFinite(first["my-card"].load1)
  );
  check(
    "collecte : exception, delai, rapport trop gros ou invalide -> carte absente",
    ["throws", "slow", "huge", "nothing", "array"].filter(id => id in first),
    []
  );
  check(
    "collecte : un fichier de donnees se lit, sans sortir du dossier ni depasser la taille",
    {
      good: first["data-file"].good.data,
      escape: first["data-file"].escape,
      big: first["data-file"].big
    },
    { good: { value: 7 }, escape: null, big: null }
  );
  check("collecte : memoire et stockage propres au plugin", first.memory, {
    runs: 1,
    stored: 1,
    host: "Serveur"
  });
  ok(
    "collecte : le stockage reste dans data/supervisions/<id>/",
    fs.existsSync(path.join(dataDir, "supervisions", "memory", "runs.json"))
  );

  await instance.collect(HOST);
  check(
    "journal : un plugin en echec n'est signale qu'une fois",
    lines.filter(line => line.includes("throws failed")).length,
    1
  );
  ok(
    "journal : la cause est donnee",
    lines.some(line => line.includes("slow failed: no answer after 100 ms")) &&
      lines.some(line => line.includes("huge failed: report too large"))
  );

  const off = await instance.collect({
    ...HOST,
    monitoring: { ...HOST.monitoring, plugins: { "my-card": { enabled: false } } }
  });
  ok("hote : une carte desactivee n'est pas collectee", !("my-card" in off) && "memory" in off);

  const env = { DASHMON_SUPERVISION_DIR: root };
  const locked = new SupervisionCore({ root: ROOT, dataDir, log: () => {}, sanitizeText, env });
  await locked.load();
  ok(
    "securite : un dossier tiers reste ignore sans DASHMON_ALLOW_UNSAFE_PLUGINS=1",
    !locked.ids().includes("my-card")
  );

  // A mounted folder is scanned after the bundled one: same id, refused.
  const shadow = tempDir("shadow");
  plugin(shadow, "memory", "module.exports = { collect: () => ({ replaced: true }) };");
  const { instance: twice, lines: twiceLines } = await core([root, shadow], {
    dataDir,
    timeout: 100
  });
  check(
    "securite : un plugin d'un second dossier ne remplace jamais un id deja charge",
    (await twice.collect(HOST)).memory.replaced,
    undefined
  );
  ok(
    "securite : le doublon est signale",
    twiceLines.some(line => line.includes("memory SKIPPED: id already loaded from"))
  );
}

async function browserSide() {
  const view = await import(
    pathToFileURL(path.join(ROOT, "public", "js", "supervision", "plugin-view.js")).href
  );
  const template = await import(pathToFileURL(path.join(TEMPLATE, "client.mjs")).href);
  const strings = JSON.parse(fs.readFileSync(path.join(TEMPLATE, "manifest.json"), "utf8")).strings
    .en;
  const descriptor = view.cardView(
    template.card({
      report: { load1: 3, load5: 2, load15: 1, cores: 2, uptime: 90061 },
      t: key => strings[key] || key,
      formatNumber: n => String(n)
    })
  );
  check(
    "rendu : le modele produit un descripteur valide",
    {
      status: descriptor.status,
      summary: descriptor.summary,
      value: descriptor.value,
      uptime: descriptor.rows[0].value,
      details: descriptor.details.length
    },
    {
      status: "warning",
      summary: "Machine under load",
      value: "1.5",
      uptime: "1 d 1 h",
      details: 4
    }
  );
  check("rendu : une valeur non objet ne dessine rien", view.cardView("texte"), null);
  const bounded = view.cardView({
    status: "rouge",
    summary: "x".repeat(500),
    rows: [
      { label: "A", value: 1, tone: "danger" },
      null,
      {},
      ...Array.from({ length: 40 }, (_, i) => ({ label: "L" + i, value: i }))
    ]
  });
  check(
    "rendu : statut et tonalites inconnus neutralises, textes et lignes bornes",
    {
      status: bounded.status,
      summary: bounded.summary.length,
      first: bounded.rows[0],
      rows: bounded.rows.length
    },
    { status: "", summary: 200, first: { label: "A", value: "1", tone: "" }, rows: 28 }
  );
}

// The cards that were part of the core, now plugins: their report files,
// their settings under the historical keys, the outdated script notice.
async function bundledCards() {
  const dataDir = tempDir("bundled");
  const now = Math.floor(Date.now() / 1000);
  fs.writeFileSync(
    path.join(dataDir, "apt-updates.json"),
    JSON.stringify({ status: "success", updated: 3, finishedAt: now })
  );
  const disk = name => ({ device: { name }, smart_status: { passed: true } });
  fs.writeFileSync(
    path.join(dataDir, "smart.json"),
    JSON.stringify({
      scriptVersion: 1,
      updatedAt: now,
      disks: [disk("/dev/sda"), disk("/dev/sdb")]
    })
  );
  fs.writeFileSync(
    path.join(dataDir, "wireguard.dump"),
    "wg0\t(redacted)\tpub\t51820\toff\nwg1\t(redacted)\tpub\t51821\toff\n"
  );
  const custom = path.join(dataDir, "elsewhere.json");
  fs.writeFileSync(custom, JSON.stringify({ periods: { today: {} } }));
  const lines = [];
  const bundled = new SupervisionCore({
    root: ROOT,
    dataDir,
    log: line => lines.push(line),
    sanitizeText,
    env: {},
    // The administrator's variable wins over the data folder.
    reportFile: (env, fallback) =>
      env === "OPENCODE_REPORT_FILE" ? custom : path.join(dataDir, fallback)
  });
  await bundled.load();
  check("integrees : les six cartes sont des plugins", bundled.ids(), [
    "apt-updates",
    "claude",
    "directories",
    "opencode",
    "smart",
    "wireguard"
  ]);
  check("integrees : aucun echec de chargement", bundled.registry.failures, []);
  const all = await bundled.collect(HOST);
  check(
    "integrees : rapports lus dans le dossier de donnees ou au chemin de l'administrateur",
    {
      apt: all["apt-updates"].updated,
      disks: all.smart.disks.length,
      interfaces: all.wireguard.interfaces.length,
      opencode: !!all.opencode,
      claude: "claude" in all,
      directories: "directories" in all
    },
    { apt: 3, disks: 2, interfaces: 2, opencode: true, claude: false, directories: false }
  );
  const filtered = await bundled.collect({
    ...HOST,
    monitoring: {
      ...HOST.monitoring,
      smart: { enabled: true, disks: ["/dev/sdb"] },
      wireguard: { enabled: true, interface: "wg1" },
      aptUpdates: { enabled: false }
    }
  });
  check(
    "integrees : reglages lus sous leurs cles historiques",
    {
      disks: filtered.smart.disks.map(item => item.device),
      interfaces: filtered.wireguard.interfaces.map(item => item.interface),
      apt: "apt-updates" in filtered
    },
    { disks: ["/dev/sdb"], interfaces: ["wg1"], apt: false }
  );
  check("integrees : chaque carte annonce son script hote", bundled.scripts(), {
    "apt-updates": "apt-updates",
    claude: "claude-stats",
    directories: "directory-sizes",
    opencode: "opencode-stats",
    smart: "smart-dump",
    wireguard: "wireguard-dump"
  });
  const meta = bundled.publicList().find(item => item.id === "directories");
  ok(
    "integrees : le schema des reglages est publie, pas les chemins",
    meta.settings.key === "directorySizes" &&
      meta.settings.fields[0].type === "list" &&
      !JSON.stringify(bundled.publicList()).includes(dataDir)
  );
}

async function manifests() {
  const { validateSupervisionManifest } = require("../lib/supervisions/manifest");
  const errorsOf = raw => {
    const errors = [];
    validateSupervisionManifest(raw, errors);
    return errors.length;
  };
  check(
    "manifeste : cle historique reservee, variable ..._FILE, guide, modules, types de champs",
    [
      errorsOf({ settings: { key: "speedtest" } }),
      errorsOf({ files: { report: { env: "HOME", default: "a.json" } } }),
      errorsOf({ files: { report: { default: "../a.json" } } }),
      errorsOf({ guide: "http://exemple.lan/doc" }),
      errorsOf({ modules: ["../x.mjs"] }),
      errorsOf({ settings: { fields: [{ key: "enabled" }] } }),
      errorsOf({ settings: { fields: [{ key: "x", type: "password" }] } }),
      errorsOf({ settings: { fields: [{ key: "rows", type: "list", fields: [] }] } }),
      errorsOf({
        guide: "https://exemple.lan/doc",
        files: { report: { env: "MY_REPORT_FILE", default: "mine.json" } },
        modules: ["view.mjs"],
        settings: {
          fields: [
            { key: "name" },
            { key: "rows", type: "list", fields: [{ key: "path", type: "path" }] }
          ]
        }
      })
    ],
    [1, 1, 1, 1, 1, 1, 1, 1, 0]
  );
}

run(async () => {
  await serverSide();
  await bundledCards();
  await manifests();
  await browserSide();
});
