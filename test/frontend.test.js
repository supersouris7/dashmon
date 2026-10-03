"use strict";
// Tests du cote navigateur, sans navigateur.
//
//   1. syntaxe : chaque module de public/js est verifie avec `node --check`
//      (copie en .mjs : le projet est en CommonJS, `node --check` seul
//      interpretterait `import` comme une erreur de syntaxe) ;
//   2. registre : le module est charge avec un `fetch` simule servant la vraie
//      liste publiee par le core, ce qui permet de tester la normalisation de
//      config, les champs conditionnels et le repli de rendu sans DOM ;
//   3. pastilles : les regles d'etat (y compris la supervision non importante)
//      sont testees sans DOM, via le module status.js ;
//   4. preferences d'affichage : leur stockage local (localStorage simule) et
//      leur normalisation, sans DOM.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const { WidgetCore } = require("../lib/widget-core");

const ROOT = path.join(__dirname, "..");
const JS_DIR = path.join(ROOT, "public", "js");

let failures = 0;
function ok(name, condition, detail){
  if (condition) {
    console.log("PASS " + name);
  } else {
    failures++;
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}
function check(name, actual, expected){
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name + " — " + error.message);
  }
}

async function main(){
  // --- 1. Syntaxe de tous les modules du navigateur ---------------------
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-fe-"));
  try {
    const files = fs.readdirSync(JS_DIR).filter(name => name.endsWith(".js"));
    ok("frontend : modules trouves", files.length >= 10, String(files.length));
    for (const name of files) {
      const target = path.join(tmp, name.replace(/\.js$/, ".mjs"));
      fs.copyFileSync(path.join(JS_DIR, name), target);
      const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
      ok("syntaxe : " + name, result.status === 0, (result.stderr || "").trim().split("\n").slice(0, 3).join(" "));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // --- 2. Registre des widgets cote client ------------------------------
  // La liste publique est produite par le vrai core : le test verifie donc
  // aussi que le contrat serveur -> navigateur tient.
  const core = new WidgetCore({
    root: ROOT, dataDir: os.tmpdir(), log: () => {},
    decryptSecret: v => v, encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v), sanitizeUrl: v => String(v == null ? "" : v).trim(),
    statusCache: {}
  });
  await core.load();
  const payload = JSON.stringify(core.publicList());

  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(payload) });
  // Les imports de /widget-client/*.js echouent hors navigateur : attendu ici,
  // le registre doit le constater sans lever.
  console.warn = () => {};
  const registry = await import(pathToFileURL(path.join(JS_DIR, "widget-registry.js")).href);
  const loaded = await registry.loadWidgetRegistry();
  console.warn = realWarn;
  globalThis.fetch = realFetch;

  check("registre client : widgets charges", loaded.slice().sort(),
    ["adguard", "docker", "dockerhub", "duplicati", "github", "lichess", "ping", "web", "youtube"]);
  ok("registre client : metadonnees disponibles", !!registry.getWidgetMeta("docker"));
  ok("registre client : widget inconnu -> null", registry.getWidgetMeta("inconnu") === null);
  // Le plugin de sondage des liens est interne au moteur : il ne doit pas
  // apparaitre dans le menu des widgets propose a l'utilisateur.
  check("registre client : le menu ne propose pas les plugins internes",
    registry.listWidgetMetas().map(m => m.id),
    ["adguard", "docker", "dockerhub", "duplicati", "github", "lichess", "ping", "youtube"]);
  ok("registre client : le plugin interne reste interrogeable (config, libelles)",
    !!registry.getWidgetMeta("web") && registry.widgetLabel(registry.getWidgetMeta("web"), "fr") === "Lien");
  // Les nouveaux widgets de liens sont bien des choix possibles, avec leur
  // schema de config pour l'editeur.
  const githubMeta = registry.getWidgetMeta("github");
  check("registre client : schema GitHub", githubMeta.config.map(f => f.key), ["repo", "metric"]);
  check("registre client : options de la statistique GitHub",
    githubMeta.config[1].options.map(o => o.value), ["stars", "forks", "issues", "watchers"]);
  check("registre client : libelle traduit du champ depot",
    registry.fieldLabel(githubMeta, githubMeta.config[0], "fr"), "Dépôt");
  check("registre client : placeholder traduit du depot",
    registry.fieldPlaceholder(githubMeta, githubMeta.config[0], "en"), "surfeon/Dashmon");

  const dockerMeta = registry.getWidgetMeta("docker");
  check("registre client : libelle traduit", registry.widgetLabel(dockerMeta, "fr"), "Docker");
  check("registre client : libelles de champs traduits",
    registry.fieldLabel(dockerMeta, dockerMeta.config[0], "fr"), "Connexion");
  check("registre client : placeholder traduit",
    registry.fieldPlaceholder(dockerMeta, dockerMeta.config[1], "fr"), "tcp://hôte:2375 ou https://…");
  check("registre client : placeholder anglais",
    registry.fieldPlaceholder(dockerMeta, dockerMeta.config[1], "en"), "tcp://host:2375 or https://…");
  check("registre client : libelle i18n de l'application intact",
    registry.widgetString(dockerMeta, "missingUrl", "fr"), "URL Docker TCP manquante");

  // Champs conditionnels : l'URL n'existe qu'en mode TCP.
  check("registre client : champ masque en mode local",
    registry.visibleFields(dockerMeta, { mode: "local" }).map(f => f.key), ["mode"]);
  check("registre client : champ visible en mode TCP",
    registry.visibleFields(dockerMeta, { mode: "tcp" }).map(f => f.key), ["mode", "url"]);

  // Normalisation : valeurs hors schema corrigees, secret conserve tel quel.
  check("registre client : config Docker normalisee",
    registry.normalizeWidgetConfig({ type: "docker", mode: "tcp", url: " tcp://h:2375 " }),
    { type: "docker", mode: "tcp", url: "tcp://h:2375" });
  // La cle de statut publiee par le serveur doit survivre : sans elle, une
  // tuile Docker (cle par configuration) ne retrouve pas son entree de cache.
  check("registre client : la cle de statut survit a la normalisation",
    registry.normalizeWidgetConfig({ type: "docker", mode: "local", url: "", key: "docker:local|" }),
    { type: "docker", mode: "local", url: "", key: "docker:local|" });
  check("registre client : la cle recopiee reste la cle de la tuile",
    registry.widgetStatusKey({
      url: "https://portainer.exemple.lan/",
      widget: registry.normalizeWidgetConfig({ type: "docker", mode: "local", url: "", key: "docker:local|" })
    }), "docker:local|");
  check("registre client : changement de type = defauts du nouveau widget",
    registry.inheritWidgetConfig("lichess", { type: "docker", mode: "tcp", url: "tcp://h:2375", key: "docker:x" }),
    { type: "lichess", username: "", variant: "" });
  check("registre client : select hors options -> defaut",
    registry.normalizeWidgetConfig({ type: "lichess", username: "exemple", variant: "torpedo" }),
    { type: "lichess", username: "exemple", variant: "" });
  check("registre client : secret chiffre non touche",
    registry.normalizeWidgetConfig({ type: "duplicati", password: "aes1.abc.def.ghi" }).password, "aes1.abc.def.ghi");
  check("registre client : widget inconnu conserve intact",
    registry.normalizeWidgetConfig({ type: "tiers", foo: "bar" }), { type: "tiers", foo: "bar" });
  check("registre client : pas de widget -> null", registry.normalizeWidgetConfig(null), null);
  check("registre client : config neuve = defauts du manifest",
    registry.defaultWidgetConfig("docker"), { type: "docker", mode: "local", url: "" });
  check("registre client : changement de type conserve les cles communes",
    registry.inheritWidgetConfig("adguard", { type: "adguard", username: "u", password: "aes1.x" }).username, "u");

  // Cle de statut : publiee par le serveur, jamais recomposee par le client.
  check("registre client : cle de statut publiee",
    registry.widgetStatusKey({ widget: { type: "docker", key: "docker:local|" } }), "docker:local|");
  check("registre client : repli sur l'URL du service",
    registry.widgetStatusKey({ url: "https://a.lan", widget: { type: "adguard" } }), "https://a.lan");

  // Rendu : sans renderer (import impossible hors navigateur), la tuile doit
  // rester affichable et le widget ne doit jamais faire tomber le dashboard.
  const view = registry.renderWidget({ url: "", widget: { type: "docker", mode: "local" } },
    { ok: true, containers: { active: 1, total: 1 } }, "fr");
  ok("registre client : rendu de repli sans exception", view && typeof view.badge === "string");
  ok("registre client : rendu de repli neutralise", view.badgeClass === "pending");
  ok("registre client : widget inconnu = repli", registry.renderWidget({ widget: { type: "nope" } }, null, "fr").badgeClass === "pending");

  // Les helpers de formatage sont utilises par les renderers de widgets.
  const format = await import(pathToFileURL(path.join(JS_DIR, "format.js")).href);
  // Date de midi : le resultat ne depend pas du fuseau du runner.
  check("format : date FR", format.formatDateTime(new Date(2026, 0, 2, 12, 0).getTime(), "fr"), "02/01/2026");
  check("format : nombre EN", format.formatNumber(1234567, "en"), "1,234,567");
  ok("format : valeur invalide toleree", format.formatDateTime("n'importe quoi", "fr") !== undefined);

  // --- 3. Pastilles de supervision ---------------------------------------
  const status = await import(pathToFileURL(path.join(JS_DIR, "status.js")).href);
  check("pastille : disponible = coche verte", status.statusIcon("up"), "fa-solid fa-circle-check");
  check("pastille : indisponible = croix rouge", status.statusIcon("down"), "fa-solid fa-circle-xmark");
  check("pastille : statut inconnu = rond vide", status.statusIcon("pending"), "fa-regular fa-circle");
  // Supervision non importante : l'etat reste "soft" (l'info-bulle le dit),
  // mais la pastille est un rond vide, exactement comme un statut inconnu.
  check("pastille : supervision non importante = rond vide",
    status.statusIcon(status.effectiveStatus("soft", { state: "down" })),
    status.statusIcon("pending"));
  check("pastille : supervision non importante, etat conserve pour l'info-bulle",
    status.effectiveStatus("soft", { state: "down" }), "soft");
  check("pastille : supervision non importante, service disponible = coche verte",
    status.effectiveStatus("soft", { state: "up" }), "up");
  check("pastille : rien de connu = statut inconnu",
    status.effectiveStatus("soft", null), "pending");

  // --- 4. Preferences d'affichage stockees cote navigateur ---------------
  // Le stockage est simule : view-prefs.js n'y touche qu'a l'appel, jamais a
  // l'import, ce qui le rend testable hors navigateur.
  const saved = new Map();
  const realStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: key => (saved.has(key) ? saved.get(key) : null),
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: key => saved.delete(key)
  };
  try {
    const prefs = await import(pathToFileURL(path.join(JS_DIR, "view-prefs.js")).href);
    const stateModule = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);

    check("prefs : la liste des cles est stable", stateModule.VIEW_PREF_KEYS.slice(),
      ["viewMode", "sortMode", "groupMode", "openMode",
        "smallIcons", "hostsDisplay", "collapsed", "webLinksCollapsed"]);

    // Rien d'ecrit tant que l'utilisateur n'a rien change.
    check("prefs : navigateur neuf = aucune preference", prefs.loadViewPrefs(), {});

    prefs.saveViewPrefs({ viewMode: "rows" });
    check("prefs : la disposition est relue", prefs.loadViewPrefs().viewMode, "rows");

    // Une preference de serveur (langue, services) ne doit jamais atterrir
    // dans le stockage du navigateur.
    prefs.saveViewPrefs({ language: "en", services: [{ name: "x" }], theme: "matrix" });
    check("prefs : rien d'autre que la disposition n'est ecrit",
      Object.keys(JSON.parse(saved.get("dashmon.view"))), ["viewMode"]);

    prefs.saveViewPrefs({ collapsed: { "category:Jeux": true } });
    check("prefs : les prefs s'accumulent sans s'ecraser",
      prefs.loadViewPrefs().collapsed, { "category:Jeux": true });

    // Valeur bricolee a la main dans le navigateur : la normalisation de
    // state.js doit la remplacer par un defaut sur, jamais la propager.
    check("prefs : valeur invalide recalee",
      stateModule.normalizeViewPrefs({ viewMode: "n'importe quoi" }).viewMode, "columns");
    check("prefs : le navigateur prime sur la config serveur",
      stateModule.normalizeViewPrefs(Object.assign(
        { viewMode: "columns" }, prefs.loadViewPrefs())).viewMode, "rows");

    check("prefs : extraction depuis la config serveur",
      prefs.pickViewPrefs({ viewMode: "plain", language: "en", hosts: [] }),
      { viewMode: "plain" });

    // Stockage indisponible (navigation privée) : l'appel ne doit pas lever.
    globalThis.localStorage = {
      getItem: () => { throw new Error("bloqué"); },
      setItem: () => { throw new Error("bloqué"); }
    };
    ok("prefs : stockage indisponible = repli silencieux",
      prefs.loadViewPrefs().viewMode === undefined
      && prefs.saveViewPrefs({ viewMode: "rows" }).viewMode === "rows");
  } finally {
    if (realStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = realStorage;
  }

  if (failures) {
    console.error(failures + " échec(s)");
    process.exit(1);
  }
  console.log("Tous les tests passent");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
