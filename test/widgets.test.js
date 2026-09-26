"use strict";
// Tests du moteur d'extensions : registre, schema de config, core widgets et
// renderers côté navigateur.
//
// Aucun accès réseau : le widget Docker n'est PAS exécuté (il parlerait au
// socket) et les widgets de liens (YouTube, Docker Hub, GitHub) sont testés
// avec un faux client HTTP. Seuls sa config, sa clé de cache et son renderer
// sont vérifiés pour le widget Docker.

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

// Affiche une valeur courte et lisible (les Buffers et les valeurs cycliques
// ne doivent jamais masquer la vraie cause d'un echec).
function show(value){
  if (value === undefined) return "undefined";
  if (value instanceof Uint8Array) return "<Buffer " + value.length + " octets> " + value.toString("utf8").slice(0, 60);
  if (typeof value === "string") return JSON.stringify(value);
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : (text.length > 300 ? text.slice(0, 300) + "…" : text);
  } catch (_) {
    return String(value);
  }
}

function check(name, actual, expected){
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name);
    console.error("     attendu : " + show(expected));
    console.error("     obtenu  : " + show(actual));
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
    ids, ["adguard", "docker", "dockerhub", "duplicati", "github", "lichess", "web", "youtube"]);
  check("registre : aucun echec de chargement", registry.failures, []);

  for (const id of ids) {
    const item = registry.get(id);
    ok("registre : " + id + " a un backend", typeof item.check === "function");
    // Le widget "web" n'a pas de renderer : c'est le client generique qui
    // dessine le point d'etat d'un lien. Il ne doit donc pas non plus
    // s'afficher dans le menu des widgets de l'editeur.
    if (!item.hidden) ok("registre : " + id + " a un renderer", typeof item.client === "string");
    ok("registre : " + id + " declare une periode", Number(item.interval) > 0);
    ok("registre : " + id + " a des libelles fr+en",
      !!(item.label.fr && item.label.en));
  }

  check("registre : le plugin de lien est interne au moteur",
    registry.publicList().filter(w => w.hidden).map(w => w.id), ["web"]);
  check("registre : un lien nu est pris en charge par le plugin \"link\"",
    registry.bySlot("link") && registry.bySlot("link").id, "web");
  check("registre : les widgets de liens sont proposes a l'utilisateur",
    registry.publicList().filter(w => !w.hidden).map(w => w.id),
    ["adguard", "docker", "dockerhub", "duplicati", "github", "lichess", "youtube"]);

  // Le template est bien un modele exploitable, mais volontairement hors registre.
  ok("template : present sur disque mais non charge",
    fs.existsSync(path.join(WIDGETS, "_template", "manifest.json")) && !registry.has("_template"));

  // --- Schema : validation d'un manifest -------------------------------
  // Le modele est volontairement hors registre : son id ne peut pas suivre le
  // dossier "_template" (un identifiant commence par une lettre minuscule).
  const templateErrors = [];
  const templateManifest = JSON.parse(fs.readFileSync(path.join(WIDGETS, "_template", "manifest.json"), "utf8"));
  check("schema : le template n'est pas chargeable tel quel",
    validateManifest("_template", templateManifest, templateErrors), null);
  ok("schema : le template est signale comme invalide", templateErrors.length >= 1, templateErrors.join(" ; "));

  // Un manifest complet et coherent est en revanche accepte tel quel.
  const errors = [];
  const manifest = validateManifest("demo", {
    id: "demo", label: { fr: "Demo", en: "Demo" }, server: "server.js", client: "client.mjs",
    config: [{ key: "jeton", type: "secret", maxLength: 200 }]
  }, errors);
  ok("schema : un manifest complet est valide", !!manifest && !errors.length, errors.join(" ; "));
  check("schema : config copiee telle quelle", manifest.config.map(f => f.key), ["jeton"]);

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

  // Un service sans widget est un lien : c'est le plugin du slot "link" qui le
  // prend en charge, et c'est son manifeste qui donne la periode.
  const plainLink = { url: "https://exemple.lan/", monitor: true };
  check("core : un lien nu est couvert par le plugin \"link\"",
    core.pluginFor(plainLink).id, "web");
  ok("core : le plugin de lien est signale", core.linkPlugin().id === "web");
  ok("core : un lien nu est surveillable", core.handles(plainLink));
  check("core : la periode d'un lien nu vient du plugin de lien",
    core.interval(plainLink), 300000);
  check("core : la cle d'un lien nu reste son URL", core.cacheKey(plainLink), "https://exemple.lan/");
  check("core : un widget explicite l'emporte sur le plugin de lien",
    core.pluginFor({ url: "https://exemple.lan/", widget: { type: "github", repo: "a/b" } }).id, "github");
  ok("core : un widget installe est surveillable",
    core.handles({ url: "https://exemple.lan/", widget: { type: "github", repo: "a/b" } }));
  // Un widget inconnu n'est pas rebascule sur la sonde de lien : le core ne
  // connait pas son schema, il ne peut donc pas collecter a sa place.
  ok("core : widget inconnu = non surveillable", !core.handles({ url: "https://x.lan/", widget: { type: "inconnu" } }));

  // Le core est le seul a savoir depuis quand un service a ete verifie : le
  // plugin n'ecrit pas la cle lui-meme. Il doit aussi garder le temps de
  // reponse mesure par la sonde au lieu d'ecraser ce chiffre.
  const logLines = [];
  const msCache = {};
  const httpLib = require("../lib/http");
  const msCore = new WidgetCore({
    root: ROOT, dataDir: os.tmpdir(), log: m => logLines.push(String(m)),
    decryptSecret: v => v, encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v), sanitizeUrl: v => String(v == null ? "" : v).trim(),
    statusCache: msCache
  });
  await msCore.load();
  const linkService = { url: "https://exemple.test/", monitor: true, widget: { type: "web" } };
  // La sonde est simulee : aucun trafic, on verifie le contrat du core.
  const realProbe = httpLib.httpProbe;
  httpLib.httpProbe = async () => ({ ok: true, code: 200, ms: 137 });
  try {
    await msCore.check(linkService);
  } finally {
    httpLib.httpProbe = realProbe;
  }
  const probed = msCache["https://exemple.test/"];
  check("core : le plugin de lien publie le temps de reponse mesure", probed.ms, 137);
  check("core : le plugin de lien publie l'etat up", [probed.state, probed.ok], ["up", true]);
  // Le chargement du registre ecrit deja dans le journal : on ne compte que les
  // lignes de panne, qui sont seules a devoir etre discretes.
  const downLines = () => logLines.filter(m => /DOWN/.test(m));
  check("core : aucune panne signalee pour un lien qui repond", downLines(), []);

  // Un lien qui tombe est signale une fois, pas a chaque cycle.
  httpLib.httpProbe = async () => ({ ok: false, ms: 4000, error: "timeout" });
  try {
    await msCore.check(linkService);
    await msCore.check(linkService);
  } finally {
    httpLib.httpProbe = realProbe;
  }
  check("core : lien tombe = etat down", msCache["https://exemple.test/"].state, "down");
  check("core : panne signalee une seule fois", downLines().length, 1);
  ok("core : la panne nomme le service",
    logLines.some(m => m.includes("https://exemple.test/")), show(logLines));

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
  check("core : config GitHub complete (statistique par defaut = etoiles)",
    core.sanitizeWidget({ type: "github", repo: " surfeon/Dashmon ", metric: "forks", n: 1 }),
    { type: "github", repo: "surfeon/Dashmon", metric: "forks" });
  check("core : statistique GitHub hors options -> etoiles",
    core.sanitizeWidget({ type: "github", repo: "a/b", metric: "commits" }),
    { type: "github", repo: "a/b", metric: "stars" });
  check("core : config Docker Hub", core.sanitizeWidget({ type: "dockerhub", repo: "library/nginx" }),
    { type: "dockerhub", repo: "library/nginx" });
  check("core : config YouTube", core.sanitizeWidget({ type: "youtube", username: "@supfeon" }),
    { type: "youtube", username: "@supfeon" });
  // Le plugin de lien n'a aucun champ : une config le concernant est vide, et
  // le client n'a rien a afficher dans l'editeur.
  check("core : le plugin de lien n'a pas de champ", core.sanitizeWidget({ type: "web" }), { type: "web" });

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
  duplicatiState.tokens.set("https://doublon-a.lan/", "jeton");
  duplicatiState.tokens.set("https://doublon-b.lan/", "jeton");
  // Le jeton d'un serveur encore surveille est conserve, celui du serveur
  // supprime est oublie. Attention : le hook purge() d'un widget ne recoit que
  // les services de SON type (c'est lui qui decide de ce qu'il oublie).
  purgeCore.purge([{ url: "https://adguard.lan/", widget: { type: "adguard" } }]);
  check("core : purge des entrees orphelines", Object.keys(cache).sort(), ["https://adguard.lan/"]);
  check("core : purge d'un widget sans service actif oublie tout",
    [...duplicatiState.tokens.keys()], []);

  // --- Exposition HTTP : liste publique et garde-fous de fichiers ---------
  const publicList = core.publicList();
  check("core : liste publique = ids installes", publicList.map(w => w.id),
    ["adguard", "docker", "dockerhub", "duplicati", "github", "lichess", "web", "youtube"]);
  ok("core : aucune fonctionCheck exposee",
    publicList.every(w => typeof w.check === "undefined" && typeof w.createState === "undefined"));
  ok("core : la liste publique porte le schema de config",
    publicList.find(w => w.id === "docker").config.length === 2);

  const asset = core.clientAsset("docker", "js");
  ok("core : renderer client servi", !!asset && asset.type === "text/javascript");
  ok("core : contenu du renderer", String(asset.body).includes("export function render"));
  check("core : widget inexistant -> pas d'asset", core.clientAsset("inconnu", "js"), null);
  check("core : widget sans CSS declare -> pas d'asset", core.clientAsset("adguard", "css"), null);
  check("core : CSS declare -> asset servi", core.clientAsset("docker", "css").type, "text/css");
  ok("core : le CSS du widget est bien son fichier",
    String(core.clientAsset("docker", "css").body).includes(".widget-status.widget-docker"));
  check("core : widget sans client -> pas d'asset", core.clientAsset("inconnu", "css"), null);

  // Un manifest qui designe un fichier hors de son dossier est rejete : c'est
  // la seule defense possible si un tiers tente de servir server.js.
  // (Le nom du dossier est impose : mkdtemp produirait un nom invalide.)
  const evilRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-"));
  const evilDir = path.join(evilRoot, "evil");
  try {
    fs.mkdirSync(evilDir);
    fs.writeFileSync(path.join(evilDir, "manifest.json"), JSON.stringify({
      id: "evil", client: "../serveur.js", server: "server.js"
    }));
    fs.writeFileSync(path.join(evilDir, "server.js"), "module.exports={check(){}};");
    const evil = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await evil.load();
    check("registre : tentative de traversee rejetee", evil.ids(), []);
    ok("registre : traversee signalee", evil.failures.length === 1, show(evil.failures));

    // Un dossier de plugin dont le nom est invalide (majuscule) doit etre
    // signale, pas ignore en silence.
    fs.mkdirSync(path.join(evilRoot, "MyPlugin"));
    fs.writeFileSync(path.join(evilRoot, "MyPlugin", "manifest.json"), JSON.stringify({ id: "MyPlugin" }));
    const sloppy = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await sloppy.load();
    check("registre : nom de dossier invalide signale",
      sloppy.failures.map(f => f.id).sort(), ["MyPlugin", "evil"]);
    // Deux plugins ne peuvent pas revendiquer le meme slot : le second est
    // refuse plutot que de voler la place du premier dans l'ordre de tri.
    for (const id of ["lien-a", "lien-b"]) {
      fs.mkdirSync(path.join(evilRoot, id));
      fs.writeFileSync(path.join(evilRoot, id, "manifest.json"),
        JSON.stringify({ id, defaultFor: "link", server: "server.js" }));
      fs.writeFileSync(path.join(evilRoot, id, "server.js"), "module.exports={check(){}};");
    }
    const greedy = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await greedy.load();
    check("registre : un seul plugin garde le slot \"link\"", greedy.bySlot("link").id, "lien-a");
    check("registre : le second plugin du slot est refuse", greedy.get("lien-b"), null);
    ok("registre : conflit de slot signale",
      greedy.failures.some(f => f.id === "lien-b" && /slot|link/i.test(String(f.reason))),
      show(greedy.failures));

    // Un plugin interne (hidden) n'a pas besoin de renderer : c'est le client
    // generique qui dessine son resultat.
    fs.mkdirSync(path.join(evilRoot, "sansvue"));
    fs.writeFileSync(path.join(evilRoot, "sansvue", "manifest.json"),
      JSON.stringify({ id: "sansvue", hidden: true, server: "server.js" }));
    fs.writeFileSync(path.join(evilRoot, "sansvue", "server.js"), "module.exports={check(){}};");
    const internal = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await internal.load();
    check("registre : plugin interne sans renderer accepte", internal.get("sansvue").hidden, true);

    // Un slot qui n'existe pas dans le core est une erreur de developpement :
    // le plugin n'est pas charge plutot que de devenir un widget injoignable.
    fs.mkdirSync(path.join(evilRoot, "mauvaisslot"));
    fs.writeFileSync(path.join(evilRoot, "mauvaisslot", "manifest.json"),
      JSON.stringify({ id: "mauvaisslot", defaultFor: "bidule", server: "server.js" }));
    fs.writeFileSync(path.join(evilRoot, "mauvaisslot", "server.js"), "module.exports={check(){}};");
    const wrong = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await wrong.load();
    check("registre : slot inconnu refuse", wrong.get("mauvaisslot"), null);
    ok("registre : slot inconnu signale",
      wrong.failures.some(f => f.id === "mauvaisslot" && /defaultFor/i.test(String(f.reason))), show(wrong.failures));
  } finally {
    fs.rmSync(evilRoot, { recursive: true, force: true });
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

  // --- Persistance : le stockage ouvert aux widgets ----------------------
  // Un widget qui a un historique (note ELO, compteur) doit pouvoir ecrire
  // dans le dossier de donnees sans jamais en sortir.
  const { Storage } = require("../lib/storage");
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-stock-"));
  try {
    const storage = new Storage({ dir: storageDir, log: silentLogger });
    check("storage : defaut quand le fichier n'existe pas", storage.read("absent", { a: 1 }), { a: 1 });
    ok("storage : ecriture acceptee", storage.write("note", { elo: 1500 }));
    check("storage : relecture fidele", storage.read("note"), { elo: 1500 });
    check("storage : nom invalide -> aucun chemin", storage.file("../evasion"), null);
    check("storage : traversee ecrasee", storage.file("a/b"), null);
    ok("storage : ecriture refusee hors espace nomme", storage.write("../evasion", { x: 1 }) === false);
    ok("storage : rien ecrit a cote", !fs.existsSync(path.join(path.dirname(storageDir), "evasion.json")));
    fs.writeFileSync(path.join(storageDir, "widgets", "casse.json"), "{ pas du json");
    check("storage : JSON illisible -> defaut", storage.read("casse", "defaut"), "defaut");
    ok("storage : valeur trop volumineuse refusee",
      storage.write("gros", { s: "x".repeat(1024 * 1024 + 16) }) === false);
  } finally {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }

  // --- Widget Lichess : ELO conserve et evolution mensuelle --------------
  // Le cas qui motive tout le widget : lichess.org repond 429. La note
  // enregistree doit donc survivre au rate limit ET au redemarrage.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lichessServer = require(path.join(WIDGETS, "lichess", "server.js"));
  const files = new Map();
  const memoryStorage = {
    read: (name, fallback) => (files.has(name) ? files.get(name) : fallback),
    write: (name, value) => { files.set(name, value); return true; }
  };
  const lichessCtx = (over) => Object.assign({
    config: { username: "Willi", variant: "" },
    service: { url: "https://lichess.org/" },
    state: lichessServer.createState(),
    storage: memoryStorage,
    sanitizeUrl: v => String(v == null ? "" : v).trim(),
    t: k => k,
    api: async () => ({ perfs: { blitz: { rating: 1500 } } })
  }, over || {});
  const throttled = () => {
    const error = new Error("HTTP 429 Too many requests");
    error.status = 429;
    return async () => { throw error; };
  };

  const first = await lichessServer.check(lichessCtx());
  check("lichess : premiere mesure enregistree",
    [first.ok, first.elo, first.variant], [true, 1500, "blitz"]);
  check("lichess : premier jour, pas encore d'evolution", first.monthDelta, null);
  ok("lichess : l'historique est ecrit sur disque",
    files.has("lichess-history") && !!files.get("lichess-history").entries["willi|*"].history);

  // 30 jours plus tot : la note de reference existe deja.
  const day30 = lichessServer.dayKey(Date.now() - 30 * DAY_MS);
  files.set("lichess-history", {
    version: 1,
    entries: { "willi|*": { elo: 1450, variant: "blitz", at: Date.now() - 30 * DAY_MS, history: { [day30]: 1450 } } }
  });
  const monthly = await lichessServer.check(lichessCtx());
  check("lichess : evolution sur un mois = 30 jours",
    [monthly.monthDelta, monthly.monthDays], [50, 30]);

  // Le rate limit frappe : la tuile garde la derniere note et son evolution.
  const limited = await lichessServer.check(lichessCtx({ api: throttled() }));
  check("lichess : 429 conserve le dernier ELO",
    [limited.ok, limited.elo, limited.variant, limited.stale], [false, 1500, "blitz", true]);
  check("lichess : 429 conserve l'evolution mensuelle", limited.monthDelta, 50);
  ok("lichess : l'erreur reste signalee", String(limited.error).includes("429"), limited.error);

  // Un historique de plus de 75 jours est elague, pas conserve indefiniment.
  const ancien = new Map();
  for (let i = 0; i < 200; i++) {
    ancien[lichessServer.dayKey(Date.now() - i * DAY_MS)] = 1400 + i;
  }
  files.set("lichess-history", { version: 1, entries: { "willi|*": { elo: 1400, variant: "blitz", at: 0, history: ancien } } });
  await lichessServer.check(lichessCtx());
  const kept = Object.keys(files.get("lichess-history").entries["willi|*"].history);
  check("lichess : historique elague a la fenetre utile", kept.length, 76);

  // Sans aucune note enregistree, une erreur reste une erreur : on n'invente
  // pas de valeur.
  files.clear();
  const noData = await lichessServer.check(lichessCtx({ api: throttled() }));
  check("lichess : aucune note connue -> pas de valeur fantome",
    [noData.elo, noData.stale, noData.monthDelta], [null, false, null]);

  // Le pseudo et la variante ont des historiques distincts.
  files.clear();
  await lichessServer.check(lichessCtx());
  const rapid = await lichessServer.check(lichessCtx({
    config: { username: "willi", variant: "rapid" },
    api: async () => ({ perfs: { blitz: { rating: 1500 }, rapid: { rating: 1800 } } })
  }));
  check("lichess : historique par joueur et par variante",
    [Object.keys(files.get("lichess-history").entries).sort(), rapid.elo, rapid.variant],
    [["willi|*", "willi|rapid"], 1800, "rapid"]);

  // Un compte sans note pour la variante demandee retombe sur la valeur
  // enregistree plutot que d'afficher un tiret.
  const sansVariante = await lichessServer.check(lichessCtx({
    config: { username: "Willi", variant: "bullet" },
    api: async () => ({ perfs: { blitz: { rating: 1500 } } })
  }));
  check("lichess : variante absente de l'API = valeur conservee",
    [sansVariante.ok, sansVariante.elo, sansVariante.stale], [false, null, false]);

  // --- Sonde HTTP du plugin de lien (boucle locale uniquement) ------------
  // Le plugin "web" remplace la sonde codee en dur de server.js : elle est donc
  // testee pour de vrai, sur un serveur qui n'ecoute que sur 127.0.0.1.
  const nodeHttp = require("http");
  const webServer = require(path.join(WIDGETS, "web", "server.js"));
  const listener = nodeHttp.createServer((req, res) => {
    if (req.url === "/ok") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("bonjour"); return; }
    if (req.url === "/gros") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("x".repeat(64 * 1024));
      return;
    }
    if (req.url === "/boum") { res.writeHead(503); res.end("service arrete"); return; }
    res.writeHead(404);
    res.end("introuvable");
  });
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + listener.address().port;
  const probeCtx = url => ({ service: { url, monitor: true }, t: k => k, probe: (href, timeout) => httpLib.httpProbe(href, timeout) });
  try {
    const live = await webServer.check(probeCtx(base + "/ok"));
    check("web : lien qui repond = point vert", [live.state, live.ok, live.code], ["up", true, 200]);
    ok("web : temps de reponse mesure", Number.isFinite(live.ms), show(live));
    const broken = await webServer.check(probeCtx(base + "/boum"));
    // Une reponse HTTP est une reponse : 503 et 404 restent verts, comme avant
    // le passage en plugin (la sonde ne juge pas le contenu). Seule l'absence
    // de reponse fait tomber la tuile.
    check("web : erreur HTTP = point vert (le serveur a repondu)", [broken.state, broken.ok, broken.code], ["up", true, 503]);
    const gone = await webServer.check(probeCtx(base + "/absent"));
    check("web : 404 = point vert", [gone.state, gone.ok, gone.code], ["up", true, 404]);
    // Port 1 : rien n'y ecoute, la connexion est refusee.
    const refused = await webServer.check(probeCtx("http://127.0.0.1:1/"));
    check("web : connexion refusee = point rouge", [refused.state, refused.ok], ["down", false]);
    ok("web : pas de second essai sur 127.0.0.1", refused.via == null, show(refused));
    check("web : URL vide", (await webServer.check(probeCtx(""))).state, "down");
    check("web : URL invalide", (await webServer.check(probeCtx("pas une url"))).state, "down");
    check("web : protocole non http", (await webServer.check(probeCtx("ftp://exemple.test/"))).state, "down");

    // --- Client HTTP : lecture de page (raw) et plafond de corps ----------
    // Le widget YouTube lit du HTML : `raw` lui renvoie le texte et le code.
    check("http : plafond de corps par defaut", httpLib.getMaxBody(), httpLib.MAX_BODY);
    check("http : un plugin peut augmenter le plafond",
      httpLib.getMaxBody(6 * 1024 * 1024), 6 * 1024 * 1024);
    check("http : le plafond reste borne pour un tiers",
      httpLib.getMaxBody(500 * 1024 * 1024), httpLib.MAX_BODY_LIMIT);
    const rawPage = await httpLib.apiRequest(base, "/ok", { raw: true });
    check("http : raw renvoie le texte et le code", [rawPage.status, rawPage.body], [200, "bonjour"]);
    const rawMissing = await httpLib.apiRequest(base, "/absent", { raw: true }).catch(e => e);
    check("http : raw signale aussi les erreurs HTTP", rawMissing.status, 404);
    // Sans `raw`, une page HTML ne doit pas tenter d'etre du JSON.
    const asJson = await httpLib.apiRequest(base, "/ok");
    check("http : sans raw, une page HTML vaut null", asJson, null);
    // Le plafond coupe la reponse quand le plugin en demande un plus petit que
    // la page : c'est ce qui arrive si le HTML d'une chaine s'allonge.
    const tooBig = await httpLib.apiRequest(base, "/gros", { raw: true, maxBody: 1024 }).catch(e => e);
    check("http : corps trop gros pour le plafond demande", /volumineuse/i.test(tooBig.message), true);
    const bigEnough = await httpLib.apiRequest(base, "/gros", { raw: true, maxBody: 128 * 1024 });
    check("http : le meme corps passe avec un plafond plus large", bigEnough.body.length, 64 * 1024);
    ok("http : valeur de maxBody invalide = defaut", httpLib.getMaxBody("beaucoup") === httpLib.MAX_BODY);
  } finally {
    await new Promise(resolve => listener.close(resolve));
  }

  // --- Widgets de liens : YouTube, Docker Hub, GitHub ---------------------
  // Ces trois widgets lisent une API tierce : on leur fournit un faux client,
  // jamais le reseau.
  const httpError = status => {
    const error = new Error("HTTP " + status);
    error.status = status;
    return error;
  };
  const linkCtx = (over) => Object.assign({
    config: {},
    service: { url: "https://exemple.test/", monitor: true },
    state: {},
    sanitizeUrl: v => String(v == null ? "" : v).trim(),
    t: k => k,
    api: async () => ({})
  }, over || {});

  // YouTube -----------------------------------------------------------------
  const youtubeServer = require(path.join(WIDGETS, "youtube", "server.js"));
  const youtubeParse = require(path.join(WIDGETS, "youtube", "parse.js"));
  check("youtube : identifiant accepte sous ses trois formes",
    ["surfeon", "@surfeon", "youtube.com/@surfeon"].map(u => youtubeParse.normalizeInput(u)),
    ["@surfeon", "@surfeon", "@surfeon"]);
  check("youtube : identifiant vide refuse", youtubeParse.normalizeInput("   "), null);
  check("youtube : adresse d'une video refusee",
    youtubeParse.normalizeInput("https://www.youtube.com/watch?v=abc"), null);
  check("youtube : identifiant de chaine conserve",
    youtubeParse.normalizeInput("UC_x5XG1OV2P6uZZ5FSM9Ttw"), "UC_x5XG1OV2P6uZZ5FSM9Ttw");
  check("youtube : chemin de chaine construit", youtubeParse.channelPath("@surfeon"), "/@surfeon");
  check("youtube : ancienne URL /c/ supportee",
    youtubeParse.channelPath("https://www.youtube.com/c/Willi"), "/c/Willi");
  check("youtube : chemin d'un identifiant de chaine",
    youtubeParse.channelPath("UC_x5XG1OV2P6uZZ5FSM9Ttw"), "/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw");
  // Les deux ecritures rencontrees dans la page : "3,45 M" (fr) et "3.45K" (en).
  check("youtube : nombres compacts lus", ["3,45 M", "1,2 M", "3.45K", "3 450", "1 234", "12,3K", "8,62 k", "1.2B"]
    .map(youtubeParse.parseNumber), [3450000, 1200000, 3450, 3450, 1234, 12300, 8620, 1200000000]);
  check("youtube : texte sans nombre", youtubeParse.parseNumber("abonnés"), null);
  check("youtube : page sans la cle", youtubeParse.parseSubscribers("vanilla JS"), null);
  check("youtube : la cle interne suffit, quelle que soit la langue",
    youtubeParse.parseSubscribers('"subscriberCountText":{"simpleText":"3 450 abonnés"}'), 3450);
  check("youtube : compteur en anglais lu aussi",
    youtubeParse.parseSubscribers('"subscriberCountText":{"simpleText":"3.45M subscribers"}'), 3450000);
  // Une chaine privee ou supprimee repond sans compteur : le widget le dit.
  const privateChannel = await youtubeServer.check(linkCtx({
    config: { username: "@prive" },
    api: async () => ({ status: 200, body: "<html>ytInitialData</html>" })
  }));
  check("youtube : page sans donnees = lien vivant, compteur inconnu",
    [privateChannel.state, privateChannel.ok, privateChannel.subscribers], ["up", false, null]);
  const okChannel = await youtubeServer.check(linkCtx({
    config: { username: "@surfeon" },
    api: async () => ({ status: 200, body: '"subscriberCountText":{"simpleText":"3 450 abonnés"}' })
  }));
  check("youtube : abonnements lus", [okChannel.state, okChannel.ok, okChannel.subscribers], ["up", true, 3450]);
  const noRepo = await youtubeServer.check(linkCtx({ config: {} }));
  check("youtube : identifiant manquant = tuile rouge", [noRepo.state, noRepo.ok, noRepo.subscribers], ["down", false, null]);
  // Une adresse qui n'est pas une chaine ne doit pas partir sur /about.
  const notAChannel = await youtubeServer.check(linkCtx({
    config: { username: "https://www.youtube.com/watch?v=abc" },
    api: async () => { throw new Error("la page ne devrait pas etre demandee"); }
  }));
  check("youtube : adresse de video refusee avant tout appel", notAChannel.state, "down");
  const youTubeDown = await youtubeServer.check(linkCtx({
    config: { username: "@surfeon" },
    api: async () => { throw httpError(503); }
  }));
  check("youtube : lien en panne = tuile rouge", [youTubeDown.state, youTubeDown.ok], ["down", false]);
  const youTubeBridged = await youtubeServer.check(linkCtx({
    config: { username: "@surfeon" },
    api: async () => { throw httpError(429); }
  }));
  check("youtube : requete bridée = lien vivant, compteur inconnu",
    [youTubeBridged.state, youTubeBridged.ok, youTubeBridged.throttled], ["up", false, true]);
  const consent = await youtubeServer.check(linkCtx({
    config: { username: "@surfeon" },
    api: async () => ({ status: 200, body: '<form action="https://consent.youtube.com/s"><input id="consentButton"></form>' })
  }));
  check("youtube : page de consentement = lien vivant, compteur inconnu",
    [consent.state, consent.ok, consent.throttled], ["up", false, true]);
  const tooBig = await youtubeServer.check(linkCtx({
    config: { username: "@surfeon" },
    api: async () => { throw new Error("Réponse trop volumineuse"); }
  }));
  check("youtube : page trop grosse = lien vivant, compteur inconnu",
    [tooBig.state, tooBig.ok, tooBig.error], ["up", false, "tooBig"]);

  // Docker Hub --------------------------------------------------------------
  const dockerHubServer = require(path.join(WIDGETS, "dockerhub", "server.js"));
  check("dockerhub : depot officiel complete", dockerHubServer.repoPath("nginx"), "library/nginx");
  check("dockerhub : depot de l'utilisateur tel quel", dockerHubServer.repoPath("surfeon/dashmon"), "surfeon/dashmon");
  check("dockerhub : depot vide", dockerHubServer.repoPath("  "), "");
  const pulls = await dockerHubServer.check(linkCtx({
    config: { repo: "library/nginx" },
    api: async (base, path) => {
      check("dockerhub : URL d'API construite", base + path, "https://hub.docker.com/v2/repositories/library/nginx/");
      return { pull_count: 12000000000, star_count: 20000, last_updated: "2026-09-01T10:00:00Z" };
    }
  }));
  check("dockerhub : pulls lus", [pulls.state, pulls.ok, pulls.pulls, pulls.stars],
    ["up", true, 12000000000, 20000]);
  const hubMissing = await dockerHubServer.check(linkCtx({ config: {} }));
  check("dockerhub : depot manquant = tuile rouge", [hubMissing.state, hubMissing.ok], ["down", false]);
  check("dockerhub : nom de depot refuse",
    dockerHubServer.isValidRepo("pas un depot"), false);
  const hubThrottled = await dockerHubServer.check(linkCtx({
    config: { repo: "nginx" },
    api: async () => { throw httpError(429); }
  }));
  check("dockerhub : API throttle = lien vivant, compteur inconnu",
    [hubThrottled.state, hubThrottled.ok, hubThrottled.throttled], ["up", false, true]);
  const hubGone = await dockerHubServer.check(linkCtx({
    config: { repo: "nginx" },
    api: async () => { throw httpError(404); }
  }));
  check("dockerhub : depot introuvable = tuile rouge", [hubGone.state, hubGone.ok], ["down", false]);

  // GitHub ------------------------------------------------------------------
  const githubServer = require(path.join(WIDGETS, "github", "server.js"));
  check("github : depot valide", [githubServer.isValidRepo("surfeon/Dashmon"), githubServer.isValidRepo("a/")], [true, false]);
  const ghStars = await githubServer.check(linkCtx({
    config: { repo: "surfeon/Dashmon", metric: "stars" },
    api: async (base, path, options) => {
      check("github : URL d'API construite", base + path, "https://api.github.com/repos/surfeon/Dashmon");
      ok("github : entete Accept v3", options.headers.Accept === "application/vnd.github+json");
      return { stargazers_count: 302, forks_count: 21, open_issues_count: 4, subscribers_count: 17, license: { spdx_id: "MIT" }, pushed_at: "2026-09-20T08:00:00Z" };
    }
  }));
  check("github : etoiles par defaut", [ghStars.state, ghStars.ok, ghStars.metric, ghStars.value], ["up", true, "stars", 302]);
  check("github : autres compteurs mis en cache", [ghStars.forks, ghStars.openIssues], [21, 4]);
  const ghForks = await githubServer.check(linkCtx({
    config: { repo: "surfeon/Dashmon", metric: "forks" },
    api: async () => ({ stargazers_count: 302, forks_count: 21 })
  }));
  check("github : forks demandes", [ghForks.metric, ghForks.value], ["forks", 21]);
  const ghUnknownMetric = await githubServer.check(linkCtx({
    config: { repo: "surfeon/Dashmon", metric: "commits" },
    api: async () => ({ stargazers_count: 302 })
  }));
  check("github : statistique hors options -> etoiles",
    [ghUnknownMetric.metric, ghUnknownMetric.value], ["stars", 302]);
  const ghThrottled = await githubServer.check(linkCtx({
    config: { repo: "a/b" },
    api: async () => { throw httpError(403); }
  }));
  check("github : API throttle = lien vivant, compteur inconnu",
    [ghThrottled.state, ghThrottled.ok, ghThrottled.throttled], ["up", false, true]);
  const ghNoRepo = await githubServer.check(linkCtx({ config: { repo: "" } }));
  check("github : depot manquant = tuile rouge", [ghNoRepo.state, ghNoRepo.ok], ["down", false]);

  // --- Renderers client (ESM, aucune dependance au DOM) ------------------
  const dockerModule = await import(pathToFileURL(path.join(WIDGETS, "docker", "client.mjs")).href);
  const duplicatiModule = await import(pathToFileURL(path.join(WIDGETS, "duplicati", "client.mjs")).href);
  const adguardModule = await import(pathToFileURL(path.join(WIDGETS, "adguard", "client.mjs")).href);
  const lichessModule = await import(pathToFileURL(path.join(WIDGETS, "lichess", "client.mjs")).href);
  const youtubeModule = await import(pathToFileURL(path.join(WIDGETS, "youtube", "client.mjs")).href);
  const dockerHubModule = await import(pathToFileURL(path.join(WIDGETS, "dockerhub", "client.mjs")).href);
  const githubModule = await import(pathToFileURL(path.join(WIDGETS, "github", "client.mjs")).href);

  const fmt = { formatDateTime: () => "01/01/2026", formatNumber: n => String(n), formatCompactNumber: n => String(n) };
  const ctx = (info, extra) => Object.assign({ info, config: {}, lang: "fr", t: k => k }, fmt, extra || {});

  check("renderer Docker : conteneurs et MAJ",
    pick(dockerModule.render(ctx({ ok: true, containers: { active: 8, total: 9 }, updated: { count: 8, total: 9, unknown: 1 } }))),
    { badge: "up 8 / 9", badgeClass: "nok", time: "updated 8 / 9", timeClass: "warn" });
  check("renderer Docker : tout vert",
    pick(dockerModule.render(ctx({ ok: true, containers: { active: 9, total: 9 }, updated: { count: 9, total: 9, unknown: 0 } }))),
    { badge: "up 9 / 9", badgeClass: "ok", time: "updated 9 / 9", timeClass: "delta-up" });
  check("renderer Docker : erreur = tuile neutre",
    dockerModule.render(ctx({ error: "ECONNREFUSED" })).badgeClass, "pending");
  check("renderer Docker : jamais verifie = tirets",
    dockerModule.render(ctx(null)).badge, "—");

  // Les deux libelles de la tuile Docker doivent suivre la langue de
  // l'interface : le renderer ne doit contenir aucun mot en dur.
  const dockerStrings = JSON.parse(fs.readFileSync(path.join(WIDGETS, "docker", "manifest.json"), "utf8")).strings;
  const localized = lang => info => ctx(info, { t: k => (dockerStrings[lang] || {})[k] || k });
  const allGreen = { ok: true, containers: { active: 9, total: 9 }, updated: { count: 9, total: 9, unknown: 0 } };
  check("renderer Docker : libelles anglais",
    pick(dockerModule.render(localized("en")(allGreen))),
    { badge: "up 9 / 9", badgeClass: "ok", time: "updated 9 / 9", timeClass: "delta-up" });
  check("renderer Docker : libelles francais",
    pick(dockerModule.render(localized("fr")(allGreen))),
    { badge: "en ligne 9 / 9", badgeClass: "ok", time: "à jour 9 / 9", timeClass: "delta-up" });
  check("renderer Docker : le tooltip reprend les deux libelles",
    dockerModule.render(localized("fr")(allGreen)).title, "Docker · en ligne 9 / 9 · à jour 9 / 9");
  ok("renderer Docker : images non verifiees au singulier",
    dockerModule.render(localized("fr")({ ok: true, containers: { active: 9, total: 9 }, updated: { count: 9, total: 9, unknown: 1 } })).title.endsWith(" · 1 non vérifié"));
  ok("renderer Docker : images non verifiees au pluriel",
    dockerModule.render(localized("fr")({ ok: true, containers: { active: 9, total: 9 }, updated: { count: 9, total: 9, unknown: 3 } })).title.endsWith(" · 3 non vérifiés"));

  check("renderer Duplicati : sauvegarde OK",
    pick(duplicatiModule.render(ctx({ ok: true, lastAttemptAt: 1 }))),
    { badge: "badgeOk", badgeClass: "ok", time: "01/01/2026", timeClass: "" });
  check("renderer Duplicati : echec = NOK",
    pick(duplicatiModule.render(ctx({ ok: false, lastAttemptAt: 1 }))).badgeClass, "nok");
  check("renderer Duplicati : aucune sauvegarde",
    duplicatiModule.render(ctx({ ok: null, lastAttemptAt: null })).badge, "—");

  check("renderer AdGuard : pourcentage",
    pick(adguardModule.render(ctx({ ok: true, queries: 12345, ratio: 12.3, avgMs: 2 }))),
    { badge: "blocked 12 %", badgeClass: "ok", time: "queries 12345", timeClass: "" });

  check("renderer Lichess : ELO en vert, evolution mensuelle en dessous",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, delta: 12, monthDelta: 42, monthDays: 30, variant: "blitz", updatedAt: 1 }))),
    { badge: "ELO 1500", badgeClass: "ok", time: "+42 over 30 days", timeClass: "delta-up" });
  check("renderer Lichess : perte mensuelle",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, monthDelta: -8, monthDays: 30, variant: "blitz" }))).timeClass, "delta-down");
  check("renderer Lichess : historique plus court que le mois = duree reelle",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, monthDelta: 5, monthDays: 4, variant: "blitz" }))).time,
    "+5 over 4 days");
  check("renderer Lichess : premiere visite (pas d'historique)",
    lichessModule.render(ctx({ ok: true, elo: 1500, delta: null, monthDelta: null, variant: "blitz" })).time, "—");
  check("renderer Lichess : note constante",
    pick(lichessModule.render(ctx({ ok: true, elo: 1500, monthDelta: 0, monthDays: 30, variant: "blitz" }))).timeClass, "");
  const staleView = lichessModule.render(ctx({ ok: false, elo: 1500, monthDelta: 42, monthDays: 30, variant: "blitz", updatedAt: 1, stale: true, error: "HTTP 429" }));
  check("renderer Lichess : 429 = derniere valeur connue, toujours verte",
    [staleView.badge, staleView.badgeClass], ["ELO 1500", "ok"]);
  ok("renderer Lichess : l'info-bulle signale la valeur conservee et l'erreur",
    staleView.title.includes("stale") && staleView.title.includes("HTTP 429") && staleView.title.includes("01/01/2026"), staleView.title);
  check("renderer Lichess : aucun ELO connu = tirets",
    lichessModule.render(ctx({ error: "HTTP 429" })).badge, "ELO —");

  // Les renderers de liens : meme contrat, meme langue, compteurs compacts.
  // Ils utilisent les vrais utilitaires d'affichage (le dashboard ne redefinit
  // pas de format dans un widget) : on normalise seulement les espaces
  // insecables, que Intl rend differemment selon la version d'ICU.
  const formatModule = await import(pathToFileURL(path.join(ROOT, "public", "js", "format.js")).href);
  const norm = value => String(value).replace(/[\u202f\u00a0]/g, " ");
  const linkStrings = id => {
    const raw = JSON.parse(fs.readFileSync(path.join(WIDGETS, id, "manifest.json"), "utf8")).strings;
    return lang => k => (raw[lang] || {})[k] || k;
  };
  const renderCtx = (id, lang, info) => Object.assign(
    { info, config: {}, lang, t: linkStrings(id)(lang) },
    formatModule.formatters(lang));
  const ytStrings = linkStrings("youtube");
  const hubStrings = linkStrings("dockerhub");
  const ghStrings = linkStrings("github");

  const ytView = youtubeModule.render(renderCtx("youtube", "fr", { ok: true, subscribers: 3450, ms: 180 }));
  check("renderer YouTube : abonnements",
    { ...pick(ytView), badge: norm(ytView.badge) },
    { badge: "YouTube (3 450)", badgeClass: "ok", time: "180 ms", timeClass: "" });
  ok("renderer YouTube : le tooltip reprend le compte",
    norm(ytView.title).startsWith("YouTube · 3 450"), ytView.title);
  check("renderer YouTube : grand compte compacte",
    norm(youtubeModule.render(renderCtx("youtube", "fr", { ok: true, subscribers: 3450000 })).badge),
    "YouTube (3,5 M)");
  check("renderer YouTube : anglais",
    youtubeModule.render(renderCtx("youtube", "en", { ok: true, subscribers: 3450 })).badge, "YouTube (3,450)");
  // La page repond mais le compteur est absent : ni vert ni rouge.
  check("renderer YouTube : compteur illisible = tuile neutre",
    youtubeModule.render(renderCtx("youtube", "fr", { ok: false, state: "up", error: "noCount" })).badgeClass, "warn");
  check("renderer YouTube : lien en panne = tuile rouge",
    youtubeModule.render(renderCtx("youtube", "fr", { ok: false, state: "down", error: "HTTP 503" })).badgeClass, "nok");
  check("renderer YouTube : jamais verifie = tirets",
    youtubeModule.render(renderCtx("youtube", "fr", null)).badge, "—");

  const hubInfo = { ok: true, pulls: 12400000000, stars: 20000, lastPush: 1, ms: 90 };
  const hubView = dockerHubModule.render(renderCtx("dockerhub", "fr", hubInfo));
  check("renderer Docker Hub : pulls compacts",
    { ...pick(hubView), badge: norm(hubView.badge) },
    { badge: "Docker Hub (12,4 Md)", badgeClass: "ok", time: "90 ms", timeClass: "" });
  ok("renderer Docker Hub : le tooltip liste pulls, etoiles et date",
    norm(hubView.title).includes("12 400 000 000")
    && norm(hubView.title).includes("20 000")
    && norm(hubView.title).includes(formatModule.formatDateTime(1, "fr")),
    hubView.title);
  check("renderer Docker Hub : API throttle = tuile neutre",
    dockerHubModule.render(renderCtx("dockerhub", "fr", { ok: false, state: "up", throttled: true })).badgeClass, "warn");
  check("renderer Docker Hub : jamais verifie = tirets",
    dockerHubModule.render(renderCtx("dockerhub", "fr", null)).badge, "—");

  const ghInfo = { ok: true, metric: "forks", value: 21, stars: 302, forks: 21, openIssues: 4, ms: 42 };
  const ghView = githubModule.render(renderCtx("github", "fr", ghInfo));
  check("renderer GitHub : statistique demandee",
    { ...pick(ghView), badge: norm(ghView.badge) },
    { badge: "GitHub (21)", badgeClass: "ok", time: "42 ms", timeClass: "" });
  ok("renderer GitHub : le tooltip reprend la statistique et les autres compteurs",
    norm(ghView.title).includes("21 forks")
    && norm(ghView.title).includes("302 étoiles")
    && norm(ghView.title).includes("4 issues"),
    ghView.title);
  ok("renderer GitHub : la statistique choisie n'est pas repetee deux fois",
    (norm(ghView.title).match(/21 forks/g) || []).length === 1, ghView.title);
  check("renderer GitHub : etoiles par defaut",
    norm(githubModule.render(renderCtx("github", "fr",
      { ok: true, metric: "stars", value: 302, stars: 302 })).badge), "GitHub (302)");
  check("renderer GitHub : API throttle = tuile neutre",
    githubModule.render(renderCtx("github", "fr", { ok: false, state: "up", throttled: true })).badgeClass, "warn");
  check("renderer GitHub : jamais verifie = tirets",
    githubModule.render(renderCtx("github", "fr", null)).badge, "—");

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
