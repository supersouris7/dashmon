"use strict";
// Widget tests: Widget core: configuration, secrets, cache key, serialization, purge, HTTP exposure of the public list and assets, storage open to widgets.
// Shared helpers and fixtures: test/widgets/helpers.js.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Registry } = require("../lib/widgets/registry");
const { WidgetCore } = require("../lib/widgets/core");
const { ROOT, check, ok, show, silentLogger, run } = require("./widgets/helpers");

async function main() {
  // --- Core : config, secrets, cle de cache -----------------------------
  const core = new WidgetCore({
    root: ROOT,
    dataDir: os.tmpdir(),
    log: silentLogger,
    decryptSecret: value => value, // simulation : pas de cle
    encryptSecret: value => (value ? "aes1." + Buffer.from(String(value)).toString("base64") : ""),
    sanitizeText: value => String(value == null ? "" : value).slice(0, 100),
    sanitizeUrl: value => String(value == null ? "" : value).trim(),
    statusCache: {}
  });
  await core.load();

  check(
    "core : intervalle lu depuis le manifest",
    core.interval({ widget: { type: "lichess" } }),
    86400000
  );
  check(
    "core : intervalle par defaut pour un widget inconnu",
    core.interval({ widget: { type: "inconnu" } }),
    300000
  );

  // Un service sans widget est un lien : c'est le plugin du slot "link" qui le
  // prend en charge, et c'est son manifeste qui donne la periode.
  const plainLink = { url: "https://exemple.lan/", monitor: true };
  check('core : un lien nu est couvert par le plugin "link"', core.pluginFor(plainLink).id, "web");
  ok("core : le plugin de lien est signale", core.linkPlugin().id === "web");
  ok("core : un lien nu est surveillable", core.handles(plainLink));
  check("core : la periode d'un lien nu vient du plugin de lien", core.interval(plainLink), 300000);
  check(
    "core : la cle d'un lien nu reste son URL",
    core.cacheKey(plainLink),
    "https://exemple.lan/"
  );
  // Le widget Ping teste un hote choisi, pas l'URL de la carte : deux cartes
  // sans URL ne doivent donc pas se marcher dessus dans le cache de statut.
  const pingKeyA = core.cacheKey({
    name: "a",
    url: "",
    widget: { type: "ping", host: "192.0.2.10" }
  });
  const pingKeyB = core.cacheKey({
    name: "b",
    url: "",
    widget: { type: "ping", host: "192.0.2.11" }
  });
  ok(
    "core : deux tuiles ping sans URL ont des cles distinctes",
    pingKeyA !== pingKeyB && pingKeyA.startsWith("ping:") && pingKeyB.startsWith("ping:"),
    pingKeyA + " / " + pingKeyB
  );
  check(
    "core : un widget explicite l'emporte sur le plugin de lien",
    core.pluginFor({ url: "https://exemple.lan/", widget: { type: "github", repo: "a/b" } }).id,
    "github"
  );
  ok(
    "core : un widget installe est surveillable",
    core.handles({ url: "https://exemple.lan/", widget: { type: "github", repo: "a/b" } })
  );
  // Un widget inconnu n'est pas rebascule sur la sonde de lien : le core ne
  // connait pas son schema, il ne peut donc pas collecter a sa place.
  ok(
    "core : widget inconnu = non surveillable",
    !core.handles({ url: "https://x.lan/", widget: { type: "inconnu" } })
  );

  // Le core est le seul a savoir depuis quand un service a ete verifie : le
  // plugin n'ecrit pas la cle lui-meme. Il doit aussi garder le temps de
  // reponse mesure par la sonde au lieu d'ecraser ce chiffre.
  const logLines = [];
  const msCache = {};
  const httpLib = require("../lib/http/client");
  check("http : link-local IPv4 refusee", httpLib.isBlockedAddress("169.254.169.254"), true);
  check("http : link-local IPv6 refusee", httpLib.isBlockedAddress("fe80::1"), true);
  check("http : LAN IPv4 admise", httpLib.isBlockedAddress("10.0.0.1"), false);
  check("http : loopback admise", httpLib.isBlockedAddress("127.0.0.1"), false);
  const blockedMetadata = await httpLib
    .apiRequest("http://169.254.169.254", "")
    .catch(error => error);
  check("http : requete metadata refusee avant connexion", blockedMetadata.code, "EHOSTUNREACH");
  const blockedMetadataV6 = await httpLib.apiRequest("http://[fe80::1]", "").catch(error => error);
  check(
    "http : requete metadata IPv6 refusee avant connexion",
    blockedMetadataV6.code,
    "EHOSTUNREACH"
  );
  const msCore = new WidgetCore({
    root: ROOT,
    dataDir: os.tmpdir(),
    log: m => logLines.push(String(m)),
    decryptSecret: v => v,
    encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v),
    sanitizeUrl: v => String(v == null ? "" : v).trim(),
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
  ok(
    "core : la panne nomme le service",
    logLines.some(m => m.includes("https://exemple.test/")),
    show(logLines)
  );

  // Widget a cle par service (une entree de cache par URL de service).
  const adguardService = {
    url: "https://portainer.exemple.lan/",
    widget: { type: "adguard", protocol: "https", url: "", username: "", password: "aes1.c2VjcmV0" }
  };
  const adguardService2 = {
    url: "https://autre.lan/",
    widget: { type: "adguard", protocol: "https", url: "", username: "", password: "aes1.c2VjcmV0" }
  };
  check(
    "core : cle par service = URL du service",
    core.cacheKey(adguardService),
    "https://portainer.exemple.lan/"
  );
  ok(
    "core : deux services du meme widget = deux entrees",
    core.cacheKey(adguardService) !== core.cacheKey(adguardService2)
  );

  // Widget a cle par configuration (une entree partagee : le socket Docker
  // n'appartient a aucun service, deux tuiles Docker partagent le cache).
  const dockerLocal = { url: "", widget: { type: "docker", mode: "local", url: "" } };
  const dockerLocal2 = { url: "autre-chose", widget: { type: "docker", mode: "local", url: "" } };
  const dockerTcp = { url: "", widget: { type: "docker", mode: "tcp", url: "tcp://hote:2375" } };
  check(
    "core : cle Docker locale partagee entre services",
    core.cacheKey(dockerLocal),
    core.cacheKey(dockerLocal2)
  );
  ok(
    "core : cle Docker TCP differente du socket local",
    core.cacheKey(dockerLocal) !== core.cacheKey(dockerTcp)
  );
  check("core : cle Docker TCP deterministe", core.cacheKey(dockerTcp), core.cacheKey(dockerTcp));

  // Serialisation : le serveur est l'autorite, il ne renvoie que les champs
  // declares par le manifest.
  check(
    "core : config Docker complete",
    core.sanitizeWidget({ type: "docker", mode: "tcp", url: " tcp://hote:2375 ", hostId: "x" }),
    { type: "docker", mode: "tcp", url: "tcp://hote:2375" }
  );
  check(
    "core : config Docker locale par defaut",
    core.sanitizeWidget({ type: "docker", mode: "n'importe quoi", url: 42 }),
    { type: "docker", mode: "local", url: "42" }
  );
  check(
    "core : config AdGuard complete",
    core.sanitizeWidget({
      type: "adguard",
      protocol: "http",
      url: "portainer.exemple.lan:3000",
      username: "u",
      password: "aes1.YQ=="
    }),
    {
      type: "adguard",
      protocol: "http",
      url: "portainer.exemple.lan:3000",
      username: "u",
      password: "aes1.YQ=="
    }
  );
  check(
    "core : select hors options retombe sur le defaut",
    core.sanitizeWidget({ type: "lichess", username: "exemple", variant: "torpedo" }),
    { type: "lichess", username: "exemple", variant: "" }
  );
  check(
    "core : widget inconnu -> null (aucune config fantome)",
    core.sanitizeWidget({ type: "inconnu", foo: "bar" }),
    null
  );
  check("core : champ declare absent -> valeur vide", core.sanitizeWidget({ type: "duplicati" }), {
    type: "duplicati",
    password: ""
  });
  check(
    "core : config GitHub complete (statistique par defaut = etoiles)",
    core.sanitizeWidget({
      type: "github",
      repo: " exemple-org/exemple-repo ",
      metric: "forks",
      n: 1
    }),
    { type: "github", repo: "exemple-org/exemple-repo", metric: "forks" }
  );
  check(
    "core : statistique GitHub hors options -> etoiles",
    core.sanitizeWidget({ type: "github", repo: "a/b", metric: "commits" }),
    { type: "github", repo: "a/b", metric: "stars" }
  );
  check(
    "core : config Docker Hub",
    core.sanitizeWidget({ type: "dockerhub", repo: "library/nginx" }),
    { type: "dockerhub", repo: "library/nginx" }
  );
  check("core : config YouTube", core.sanitizeWidget({ type: "youtube", username: "@exemple" }), {
    type: "youtube",
    username: "@exemple"
  });
  // Le plugin de lien n'a aucun champ : une config le concernant est vide, et
  // le client n'a rien a afficher dans l'editeur.
  check("core : le plugin de lien n'a pas de champ", core.sanitizeWidget({ type: "web" }), {
    type: "web"
  });

  // Un widget dont le type n'est pas installe n'est pas efface : le core ne
  // connait pas son schema, donc il ne peut pas le reecrire. La config survit a
  // un plugin temporairement absent (dossier supprime, manifeste invalide).
  check(
    "core : widget inconnu conserve ses champs",
    core.preserveWidget({ type: "inconnu", jeton: "abc", actif: true, n: 3 }),
    { type: "inconnu", jeton: "abc", actif: true, n: 3 }
  );
  check(
    "core : widget inconnu : types exotiques et cles proto ecartees",
    core.preserveWidget({
      type: "inconnu",
      objet: { a: 1 },
      liste: [1],
      vide: null,
      __proto__: "x"
    }),
    { type: "inconnu" }
  );
  check(
    "core : widget inconnu : type invalide -> null",
    core.preserveWidget({ type: "../../etc/passwd", a: "b" }),
    null
  );
  check("core : sans widget -> null", core.preserveWidget(null), null);
  ok(
    "core : la cle de statut d'un widget inconnu reste son URL de service",
    core.cacheKey({ url: "https://inconnu.lan/", widget: { type: "inconnu", jeton: "x" } }) ===
      "https://inconnu.lan/"
  );

  // Un secret en clair est chiffre a l'ecriture, un secret deja chiffre est
  // conserve tel quel (le re-chiffrement a chaque sauvegarde tournerait la cle
  // de cache et ferait relancer tous les checks).
  const encrypted = core.sanitizeWidget({ type: "duplicati", password: "motdepasse" });
  ok(
    "core : secret en clair chiffre a l'ecriture",
    String(encrypted.password).startsWith("aes1.") && encrypted.password !== "motdepasse"
  );
  check(
    "core : secret deja chiffre non re-chiffre",
    core.sanitizeWidget({ type: "duplicati", password: "aes1.YWJj" }).password,
    "aes1.YWJj"
  );

  // Purge : une entree de cache orpheline disparait, une entree de service
  // supprimee aussi, et la memoire du widget (jetons Duplicati) suit.
  const cache = {
    "https://portainer.exemple.lan/": { state: "adguard" },
    "https://supprime.lan/": { state: "adguard" },
    orphelin: { state: "docker" }
  };
  const purgeCore = new WidgetCore({
    root: ROOT,
    dataDir: os.tmpdir(),
    log: silentLogger,
    decryptSecret: v => v,
    encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v),
    sanitizeUrl: v => String(v == null ? "" : v).trim(),
    statusCache: cache
  });
  await purgeCore.load();
  const duplicatiState = purgeCore.states.get("duplicati");
  duplicatiState.tokens.set("https://doublon-a.lan/", "jeton");
  duplicatiState.tokens.set("https://doublon-b.lan/", "jeton");
  // Le jeton d'un serveur encore surveille est conserve, celui du serveur
  // supprime est oublie. Attention : le hook purge() d'un widget ne recoit que
  // les services de SON type (c'est lui qui decide de ce qu'il oublie).
  purgeCore.purge([{ url: "https://portainer.exemple.lan/", widget: { type: "adguard" } }]);
  check("core : purge des entrees orphelines", Object.keys(cache).sort(), [
    "https://portainer.exemple.lan/"
  ]);
  check(
    "core : purge d'un widget sans service actif oublie tout",
    [...duplicatiState.tokens.keys()],
    []
  );

  // --- Exposition HTTP : liste publique et garde-fous de fichiers ---------
  const publicList = core.publicList();
  check(
    "core : liste publique = ids installes",
    publicList.map(w => w.id),
    [
      "adguard",
      "docker",
      "dockerhub",
      "duplicati",
      "github",
      "gotify",
      "lichess",
      "metube",
      "opencode",
      "ping",
      "qbittorrent",
      "uptimekuma",
      "web",
      "youtube"
    ]
  );
  ok(
    "core : aucune fonctionCheck exposee",
    publicList.every(w => typeof w.check === "undefined" && typeof w.createState === "undefined")
  );
  ok(
    "core : la liste publique porte le schema de config",
    publicList.find(w => w.id === "docker").config.length === 2
  );

  const asset = core.clientAsset("docker", "js");
  ok("core : renderer client servi", !!asset && asset.type === "text/javascript");
  ok("core : contenu du renderer", String(asset.body).includes("export function render"));
  check("core : widget inexistant -> pas d'asset", core.clientAsset("inconnu", "js"), null);
  check("core : widget sans CSS declare -> pas d'asset", core.clientAsset("adguard", "css"), null);
  check("core : CSS declare -> asset servi", core.clientAsset("docker", "css").type, "text/css");
  ok(
    "core : le CSS du widget est bien son fichier",
    String(core.clientAsset("docker", "css").body).includes(".widget-status.widget-docker")
  );
  check("core : widget sans client -> pas d'asset", core.clientAsset("inconnu", "css"), null);

  // Un manifest qui designe un fichier hors de son dossier est rejete : c'est
  // la seule defense possible si un tiers tente de servir server.js.
  // (Le nom du dossier est impose : mkdtemp produirait un nom invalide.)
  const evilRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-"));
  const evilDir = path.join(evilRoot, "evil");
  try {
    fs.mkdirSync(evilDir);
    fs.writeFileSync(
      path.join(evilDir, "manifest.json"),
      JSON.stringify({
        id: "evil",
        client: "../serveur.js",
        server: "server.js"
      })
    );
    fs.writeFileSync(path.join(evilDir, "server.js"), "module.exports={check(){}};");
    const evil = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await evil.load();
    check("registre : tentative de traversee rejetee", evil.ids(), []);
    ok("registre : traversee signalee", evil.failures.length === 1, show(evil.failures));

    // Un dossier de plugin dont le nom est invalide (majuscule) doit etre
    // signale, pas ignore en silence.
    fs.mkdirSync(path.join(evilRoot, "MyPlugin"));
    fs.writeFileSync(
      path.join(evilRoot, "MyPlugin", "manifest.json"),
      JSON.stringify({ id: "MyPlugin" })
    );
    const sloppy = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await sloppy.load();
    check("registre : nom de dossier invalide signale", sloppy.failures.map(f => f.id).sort(), [
      "MyPlugin",
      "evil"
    ]);
    // Deux plugins ne peuvent pas revendiquer le meme slot : le second est
    // refuse plutot que de voler la place du premier dans l'ordre de tri.
    for (const id of ["lien-a", "lien-b"]) {
      fs.mkdirSync(path.join(evilRoot, id));
      fs.writeFileSync(
        path.join(evilRoot, id, "manifest.json"),
        JSON.stringify({ id, defaultFor: "link", server: "server.js" })
      );
      fs.writeFileSync(path.join(evilRoot, id, "server.js"), "module.exports={check(){}};");
    }
    const greedy = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await greedy.load();
    check('registre : un seul plugin garde le slot "link"', greedy.bySlot("link").id, "lien-a");
    check("registre : le second plugin du slot est refuse", greedy.get("lien-b"), null);
    ok(
      "registre : conflit de slot signale",
      greedy.failures.some(f => f.id === "lien-b" && /slot|link/i.test(String(f.reason))),
      show(greedy.failures)
    );

    // Un plugin interne (hidden) n'a pas besoin de renderer : c'est le client
    // generique qui dessine son resultat.
    fs.mkdirSync(path.join(evilRoot, "sansvue"));
    fs.writeFileSync(
      path.join(evilRoot, "sansvue", "manifest.json"),
      JSON.stringify({ id: "sansvue", hidden: true, server: "server.js" })
    );
    fs.writeFileSync(path.join(evilRoot, "sansvue", "server.js"), "module.exports={check(){}};");
    const internal = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await internal.load();
    check("registre : plugin interne sans renderer accepte", internal.get("sansvue").hidden, true);

    // Un slot qui n'existe pas dans le core est une erreur de developpement :
    // le plugin n'est pas charge plutot que de devenir un widget injoignable.
    fs.mkdirSync(path.join(evilRoot, "mauvaisslot"));
    fs.writeFileSync(
      path.join(evilRoot, "mauvaisslot", "manifest.json"),
      JSON.stringify({ id: "mauvaisslot", defaultFor: "bidule", server: "server.js" })
    );
    fs.writeFileSync(
      path.join(evilRoot, "mauvaisslot", "server.js"),
      "module.exports={check(){}};"
    );
    const wrong = new Registry({ kind: "widget", roots: [evilRoot], logger: silentLogger });
    await wrong.load();
    check("registre : slot inconnu refuse", wrong.get("mauvaisslot"), null);
    ok(
      "registre : slot inconnu signale",
      wrong.failures.some(f => f.id === "mauvaisslot" && /defaultFor/i.test(String(f.reason))),
      show(wrong.failures)
    );
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
    fs.writeFileSync(
      path.join(mixedDir, "sansbackend", "manifest.json"),
      JSON.stringify({ id: "sansbackend", server: "server.js" })
    );
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
  const { Storage } = require("../lib/widgets/storage");
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-stock-"));
  try {
    const storage = new Storage({ dir: storageDir, log: silentLogger });
    check("storage : defaut quand le fichier n'existe pas", storage.read("absent", { a: 1 }), {
      a: 1
    });
    ok("storage : ecriture acceptee", storage.write("note", { elo: 1500 }));
    check("storage : relecture fidele", storage.read("note"), { elo: 1500 });
    check("storage : nom invalide -> aucun chemin", storage.file("../evasion"), null);
    check("storage : traversee ecrasee", storage.file("a/b"), null);
    ok(
      "storage : ecriture refusee hors espace nomme",
      storage.write("../evasion", { x: 1 }) === false
    );
    ok(
      "storage : rien ecrit a cote",
      !fs.existsSync(path.join(path.dirname(storageDir), "evasion.json"))
    );
    fs.writeFileSync(path.join(storageDir, "widgets", "casse.json"), "{ pas du json");
    check("storage : JSON illisible -> defaut", storage.read("casse", "defaut"), "defaut");
    ok(
      "storage : valeur trop volumineuse refusee",
      storage.write("gros", { s: "x".repeat(1024 * 1024 + 16) }) === false
    );
  } finally {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}

run(main);
