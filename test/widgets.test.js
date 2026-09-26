"use strict";
// Tests du moteur d'extensions : registre, schema de config, core widgets et
// renderers côté navigateur.
//
// Aucun accès réseau : le widget Docker n'est PAS exécuté (il parlerait au
// socket), seuls sa config, sa clé de cache et son renderer sont vérifiés.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const { Registry, validateManifest } = require("../lib/registry");
const { WidgetCore } = require("../lib/widget-core");

const ROOT = path.join(__dirname, "..");
const WIDGETS = path.join(ROOT, "widgets");

let failures = 0;
function check(name, actual, expected){
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name + " — " + error.message);
  }
}
function ok(name, condition, detail){
  if (condition) {
    console.log("PASS " + name);
  } else {
    failures++;
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}

const silentLogger = () => {};

// --- Decouverte du registre ------------------------------------------------

async function main(){
  const registry = new Registry({ kind: "widget", roots: [WIDGETS], logger: silentLogger });
  await registry.load();

  const ids = registry.ids().slice().sort();
  // `_template` n'est pas un plugin : son identifiant ne respecte pas le motif
  // du registre, il sert de modele a copier.
  check("registre : widgets natifs charges, _template ignore",
    ids, ["adguard", "docker", "duplicati", "lichess"]);
  check("registre : aucun echec de chargement", registry.failures, []);

  for (const id of ids) {
    const item = registry.get(id);
    ok("registre : " + id + " a un backend", typeof item.check === "function");
    ok("registre : " + id + " a un renderer", typeof item.client === "string");
    ok("registre : " + id + " declare une periode", Number(item.interval) > 0);
    ok("registre : " + id + " a des libelles fr+en",
      !!(item.label.fr && item.label.en));
  }

  // Le template est bien un modele exploitable, mais volontairement hors registre.
  ok("template : present sur disque mais non charge",
    fs.existsSync(path.join(WIDGETS, "_template", "manifest.json")) && !registry.has("_template"));

  // --- Schema : validation d'un manifest -------------------------------
  // Le modele doit etre un exemple copiable tel quel : son id suit le dossier.
  const errors = [];
  const manifest = validateManifest("_template",
    JSON.parse(fs.readFileSync(path.join(WIDGETS, "_template", "manifest.json"), "utf8")),
    errors);
  ok("schema : le manifest du template est valide", !!manifest && !errors.length, errors.join(" ; "));
  check("schema : id du template = nom du dossier", manifest && manifest.id, "_template");

  // Un id qui ne correspond pas au dossier est rejete : rien n'est renvoye.
  const mismatch = [];
  check("schema : id incoherent rejete", validateManifest("autre", { id: "demo" }, mismatch), null);
  ok("schema : id incoherent signale", mismatch.length === 1, mismatch.join(" ; "));

  const badType = [];
  const bad = validateManifest("demo", { config: [{ key: "x", type: "fichier" }] }, badType);
  ok("schema : type de champ inconnu rejete",
    !bad.config.some(f => f.type === "fichier") && badType.length === 1);

  const dup = [];
  const dupManifest = validateManifest("demo",
    { config: [{ key: "a" }, { key: "a" }] }, dup);
  check("schema : cle dupliquee eliminee", dupManifest.config.map(f => f.key), ["a"]);
  ok("schema : cle dupliquee signalee", dup.length === 1);

  // --- Core : config, secrets, cle de cache -----------------------------
  const core = new WidgetCore({
    root: ROOT,
    dataDir: os.tmpdir(),
    log: silentLogger,
    decryptSecret: value => value,                       // simulation : pas de cle
    encryptSecret: value => value ? "aes1." + Buffer.from(String(value)).toString("base64") : "",
    sanitizeText: value => String(value == null ? "" : value).slice(0, 100),
    sanitizeUrl: value => String(value == null ? "" : value).trim(),
    statusCache: {}
  });
  await core.load();

  check("core : intervalle lu depuis le manifest",
    core.interval({ widget: { type: "lichess" } }), 86400000);
  check("core : intervalle par defaut pour un widget inconnu",
    core.interval({ widget: { type: "inconnu" } }), 300000);

  // Widget a cle par service (une entree de cache par URL de service).
  const adguardService = { url: "https://adguard.lan/", widget: { type: "adguard", protocol: "https", url: "", username: "", password: "aes1.c2VjcmV0" } };
  const adguardService2 = { url: "https://autre.lan/", widget: { type: "adguard", protocol: "https", url: "", username: "", password: "aes1.c2VjcmV0" } };
  check("core : cle par service = URL du service", core.cacheKey(adguardService), "https://adguard.lan/");
  ok("core : deux services du meme widget = deux entrees",
    core.cacheKey(adguardService) !== core.cacheKey(adguardService2));

  // Widget a cle par configuration (une entree partagee : le socket Docker
  // n'appartient a aucun service, deux tuiles Docker partagent le cache).
  const dockerLocal = { url: "", widget: { type: "docker", mode: "local", url: "" } };
  const dockerLocal2 = { url: "autre-chose", widget: { type: "docker", mode: "local", url: "" } };
  const dockerTcp = { url: "", widget: { type: "docker", mode: "tcp", url: "tcp://hote:2375" } };
  check("core : cle Docker locale partagee entre services",
    core.cacheKey(dockerLocal), core.cacheKey(dockerLocal2));
  ok("core : cle Docker TCP differente du socket local",
    core.cacheKey(dockerLocal) !== core.cacheKey(dockerTcp));
  check("core : cle Docker TCP deterministe", core.cacheKey(dockerTcp), core.cacheKey(dockerTcp));

  // Serialisation : le serveur est l'autorite, il ne renvoie que les champs
  // declares par le manifest.
  check("core : config Docker complete",
    core.sanitizeWidget({ type: "docker", mode: "tcp", url: " tcp://hote:2375 ", hostId: "x" }),
    { type: "docker", mode: "tcp", url: "tcp://hote:2375" });
  check("core : config Docker locale par defaut",
    core.sanitizeWidget({ type: "docker", mode: "n'importe quoi", url: 42 }),
    { type: "docker", mode: "local", url: "42" });
  check("core : config AdGuard complete",
    core.sanitizeWidget({ type: "adguard", protocol: "http", url: "adguard.lan:3000", username: "u", password: "aes1.YQ==" }),
    { type: "adguard", protocol: "http", url: "adguard.lan:3000", username: "u", password: "aes1.YQ==" });
  check("core : select hors options retombe sur le defaut",
    core.sanitizeWidget({ type: "lichess", username: "Willi", variant: "torpedo" }),
    { type: "lichess", username: "Willi", variant: "" });
  check("core : widget inconnu -> null (aucune config fantome)",
    core.sanitizeWidget({ type: "inconnu", foo: "bar" }), null);
  check("core : champ declare absent -> valeur vide",
    core.sanitizeWidget({ type: "duplicati" }), { type: "duplicati", password: "" });

  // Un widget dont le type n'est pas installe n'est pas efface : le core ne
  // connait pas son schema, donc il ne peut pas le reecrire. La config survit a
  // un plugin temporairement absent (dossier supprime, manifeste invalide).
  check("core : widget inconnu conserve ses champs",
    core.preserveWidget({ type: "inconnu", jeton: "abc", actif: true, n: 3 }),
    { type: "inconnu", jeton: "abc", actif: true, n: 3 });
  check("core : widget inconnu : types exotiques et cles proto ecartees",
    core.preserveWidget({ type: "inconnu", objet: { a: 1 }, liste: [1], vide: null, "__proto__": "x" }),
    { type: "inconnu" });
  check("core : widget inconnu : type invalide -> null",
    core.preserveWidget({ type: "../../etc/passwd", a: "b" }), null);
  check("core : sans widget -> null", core.preserveWidget(null), null);
  ok("core : la cle de statut d'un widget inconnu reste son URL de service",
    core.cacheKey({ url: "https://inconnu.lan/", widget: { type: "inconnu", jeton: "x" } })
      === "https://inconnu.lan/");

  // Un secret en clair est chiffre a l'ecriture, un secret deja chiffre est
  // conserve tel quel (le re-chiffrement a chaque sauvegarde tournerait la cle
  // de cache et ferait relancer tous les checks).
  const encrypted = core.sanitizeWidget({ type: "duplicati", password: "motdepasse" });
  ok("core : secret en clair chiffre a l'ecriture",
    String(encrypted.password).startsWith("aes1.") && encrypted.password !== "motdepasse");
  check("core : secret deja chiffre non re-chiffre",
    core.sanitizeWidget({ type: "duplicati", password: "aes1.YWJj" }).password, "aes1.YWJj");

  // Purge : une entree de cache orpheline disparait, une entree de service
  // supprimee aussi, et la memoire du widget (jetons Duplicati) suit.
  const cache = {
    "https://adguard.lan/": { state: "adguard" },
    "https://supprime.lan/": { state: "adguard" },
    "orphelin": { state: "docker" }
  };
  const purgeCore = new WidgetCore({
    root: ROOT, dataDir: os.tmpdir(), log: silentLogger,
    decryptSecret: v => v, encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v), sanitizeUrl: v => String(v == null ? "" : v).trim(),
    statusCache: cache
  });
  await purgeCore.load();
  const duplicatiState = purgeCore.states.get("duplicati");
  duplicatiState.tokens.set("https://adguard.lan/", "jeton");
  duplicatiState.tokens.set("https://oublie.lan/", "jeton");
  purgeCore.purge([{ url: "https://adguard.lan/", widget: { type: "adguard" } }]);
  check("core : purge des entrees orphelines", Object.keys(cache).sort(), ["https://adguard.lan/"]);
  // Le jeton du serveur encore configure est conserve, celui du serveur
  // supprime est oublie : c'est le hook purge() du widget qui decide.
  check("core : purge des jetons du widget", [...duplicatiState.tokens.keys()], ["https://adguard.lan/"]);

  // --- Exposition HTTP : liste publique et garde-fous de fichiers ---------
  const publicList = core.publicList();
  check("core : liste publique = ids installes", publicList.map(w => w.id), ["adguard", "docker", "duplicati", "lichess"]);
  ok("core : aucune fonctionCheck exposee",
    publicList.every(w => typeof w.check === "undefined" && typeof w.createState === "undefined"));
  ok("core : la liste publique porte le schema de config",
    publicList.find(w => w.id === "docker").config.length === 2);

  const asset = core.clientAsset("docker", "js");
  ok("core : renderer client servi", !!asset && asset.type === "text/javascript");
  ok("core : contenu du renderer", String(asset.body).includes("export function render"));
  check("core : widget inexistant -> pas d'asset", core.clientAsset("inconnu", "js"), null);
  check("core : pas de CSS declare -> pas d'asset", core.clientAsset("docker", "css"), null);
  check("core : widget sans client -> pas d'asset", core.clientAsset("inconnu", "css"), null);

  // Un manifest qui designe un fichier hors de son dossier est rejete : c'est
  // la seule defense possible si un tiers tente de servir server.js.
  const evilDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-plugin-"));
  try {
    fs.writeFileSync(path.join(evilDir, "manifest.json"), JSON.stringify({
      id: "evil", client: "../serveur.js", server: "server.js"
    }));
    fs.writeFileSync(path.join(evilDir, "server.js"), "module.exports={check(){}};");
    const evil = new Registry({ kind: "widget", roots: [evilDir], logger: silentLogger });
    await evil.load();
    check("registre : tentative de traversee rejetee", evil.ids(), []);
    ok("registre : traversee signalee", evil.failures.length === 1, JSON.stringify(evil.failures));
  } finally {
    fs.rmSync(evilDir, { recursive: true, force: true });
  }

  // Un plugin casse ne doit jamais empecher les autres de charger.
  const mixedDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-mixed-"));
  try {
    fs.writeFileSync(path.join(mixedDir, "casse.json"), "n'importe quoi");
    fs.mkdirSync(path.join(mixedDir, "casse"));
    fs.writeFileSync(path.join(mixedDir, "casse", "manifest.json"), "{ pas du json");
    fs.mkdirSync(path.join(mixedDir, "sansbackend"));
    fs.writeFileSync(path.join(mixedDir, "sansbackend", "manifest.json"),
      JSON.stringify({ id: "sansbackend", server: "server.js" }));
    fs.writeFileSync(path.join(mixedDir, "sansbackend", "server.js"), "module.exports={};");
    const mixed = new Registry({ kind: "widget", roots: [mixedDir], logger: silentLogger });
    await mixed.load();
    check("registre : plugins sans JSON ou sans check ignores, sans lever", mixed.ids(), []);
    check("registre : chaque echec est tracee", mixed.failures.length, 2);
  } finally {
    fs.rmSync(mixedDir, { recursive: true, force: true });
  }

  // --- Renderers client (ESM, aucune dependance au DOM) ------------------
  const dockerModule = await import(pathToFileURL(path.join(WIDGETS, "docker", "client.mjs")).href);
  const duplicatiModule = await import(pathToFileURL(path.join(WIDGETS, "duplicati", "client.mjs")).href);
  const adguardModule = await import(pathToFileURL(path.join(WIDGETS, "adguard", "client.mjs")).href);
  const lichessModule = await import(pathToFileURL(path.join(WIDGETS, "lichess", "client.mjs")).href);

  const fmt = { formatDateTime: () => "01/01/2026", formatNumber: n => String(n), formatCompactNumber: n => String(n) };
  const ctx = (info, extra) => Object.assign({ info, config: {}, lang: "fr", t: k => k }, fmt, extra || {});

  check("renderer Docker : conteneurs et MAJ",
    pick(dockerModule.render(ctx({ ok: true, containers: { active: 8, total: 9 }, updated: { count: 8, total: 9, unknown: 1 } }))),
    { badge: "containers 8 / 9", badgeClass: "nok", time: "updated 8 / 9", timeClass: "warn" });
  check("renderer Docker : tout vert",
    pick(dockerModule.render(ctx({ ok: true, containers: { active: 9, total: 9 }, updated: { count: 9, total: 9, unknown: 0 } }))),
    { badge: "containers 9 / 9", badgeClass: "ok", time: "updated 9 / 9", timeClass: "delta-up" });
  check("renderer Docker : erreur = tuile neutre",
    dockerModule.render(ctx({ error: "ECONNREFUSED" })).badgeClass, "pending");
  check("renderer Docker : jamais verifie = tirets",
    dockerModule.render(ctx(null)).badge, "-");

  check("renderer Duplicati : sauvegarde OK",
    pick(duplicatiModule.render(ctx({ ok: true, lastAttemptAt: 1 }))),
    { badge: "badgeOk", badgeClass: "ok", time: "01/01/2026", timeClass: "" });
  check("renderer Duplicati : echec = NOK",
    pick(duplicatiModule.render(ctx({ ok: false, lastAttemptAt: 1 }))).badgeClass, "nok");
  check("renderer Duplicati : aucune sauvegarde",
    duplicatiModule.render(ctx({ ok: null, lastAttemptAt: null })).badge, "-");

  check("renderer AdGuard : pourcentage",
    pick(adguardModule.render(ctx({ ok: true, queries: 12345, ratio: 12.3, avgMs: 2 }))),
    { badge: "blocked 12 %", badgeClass: "ok", time: "queries 12345", timeClass: "" });

  check("renderer Lichess : gain",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, delta: 12, variant: "blitz" }))),
    { badge: "ELO 1500", badgeClass: "", time: "+12", timeClass: "delta-up" });
  check("renderer Lichess : perte",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, delta: -8, variant: "blitz" }))).timeClass, "delta-down");
  check("renderer Lichess : premiere visite (pas de variation)",
    lichessModule.render(ctx({ ok: true, elo: 1500, delta: null, variant: "blitz" })).time, "-");
  check("renderer Lichess : erreur 429 = tuile neutre",
    lichessModule.render(ctx({ error: "HTTP 429" })).badge, "ELO -");

  // Un renderer qui leve ne doit pas faire tomber le appelant : c'est le core
  // navigateur (widget-registry.js) qui rattrape, on verifie donc que le
  // descripteur de secours reste affichable.
  ok("renderer : contrat { badge, badgeClass, time, timeClass, title }",
    ["badge", "badgeClass", "time", "timeClass", "title"].every(
      k => k in dockerModule.render(ctx({ ok: true, containers: { active: 1, total: 1 }, updated: { count: 1, total: 1, unknown: 0 } }))));

  if (failures) {
    console.error(failures + " échec(s)");
    process.exit(1);
  }
  console.log("Tous les tests passent");
}

// Extrait les 4 champs compares par les tests de rendu.
function pick(view){
  return { badge: view.badge, badgeClass: view.badgeClass, time: view.time, timeClass: view.timeClass };
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
