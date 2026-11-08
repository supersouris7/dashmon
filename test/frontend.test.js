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
// The component styles, in their load order (index.html).
const COMPONENT_CSS = [
  "settings-lists.css",
  "dashboard.css",
  "supervision.css",
  "responsive.css",
  "settings-tools.css"
];
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const { WidgetCore } = require("../lib/widgets/core");

const ROOT = path.join(__dirname, "..");
const JS_DIR = path.join(ROOT, "public", "js");
const PUBLIC_DIR = path.join(ROOT, "public");

// Some checks look for code in the source files. Whitespace, and the semicolon
// before a closing brace, are dropped from both the source and the searched
// text: these checks survive any reformatting (Prettier) and only fail when
// the code itself changes.
function squash(text) {
  return text.replace(/\s+/g, "").replace(/;}/g, "}");
}
function readSource(...parts) {
  return squash(fs.readFileSync(path.join(ROOT, ...parts), "utf8"));
}
// The editor: editor.js and its panels and helpers in editor/.
function editorSource() {
  return ["editor.js", ...fs.readdirSync(path.join(JS_DIR, "editor")).map(f => "editor/" + f)]
    .map(file => readSource("public", "js", ...file.split("/")))
    .join("");
}

// The application state and the config schema live in several browser
// modules (state.js, config/, util.js); the checks below use them together.
async function importStateModules() {
  const load = file => import(pathToFileURL(path.join(JS_DIR, ...file.split("/"))).href);
  const modules = await Promise.all(
    ["state.js", "util.js", "config/normalize.js", "config/sanitize.js"].map(load)
  );
  return Object.assign({}, ...modules);
}
function contains(source, needle) {
  return source.includes(squash(needle));
}

let failures = 0;
function ok(name, condition, detail) {
  if (condition) {
    console.log("PASS " + name);
  } else {
    failures++;
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}
function check(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name + " — " + error.message);
  }
}

async function main() {
  // --- 1. Syntaxe de tous les modules du navigateur ---------------------
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-fe-"));
  try {
    // Every module, subfolders included (editor/, supervision/, dashboard/...).
    const files = fs
      .readdirSync(JS_DIR, { recursive: true })
      .filter(name => name.endsWith(".js"))
      .map(name => name.split(path.sep).join("/"));
    ok("frontend : modules trouves", files.length >= 10, String(files.length));
    for (const name of files) {
      const target = path.join(tmp, name.replace(/\//g, "__").replace(/\.js$/, ".mjs"));
      fs.copyFileSync(path.join(JS_DIR, name), target);
      const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
      ok(
        "syntaxe : " + name,
        result.status === 0,
        (result.stderr || "").trim().split("\n").slice(0, 3).join(" ")
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Grid density: "auto" or 2 to 5 columns, anything else falls back to auto.
  {
    const { normalizeViewPrefs } = await importStateModules();
    const prefs = normalizeViewPrefs({
      categoryColumns: 4,
      tileColumns: "9",
      supervisionColumns: "2"
    });
    check(
      "grille : colonnes normalisees",
      [prefs.categoryColumns, prefs.tileColumns, prefs.supervisionColumns],
      ["4", "auto", "2"]
    );
  }
  // Interface texts: both languages define exactly the same keys, all of them
  // non-empty strings.
  const texts = Object.fromEntries(
    ["fr", "en"].map(lang => [
      lang,
      JSON.parse(fs.readFileSync(path.join(JS_DIR, "i18n", lang + ".json"), "utf8"))
    ])
  );
  check(
    "i18n : memes cles en francais et en anglais",
    Object.keys(texts.en).sort(),
    Object.keys(texts.fr).sort()
  );
  ok(
    "i18n : textes non vides",
    Object.values(texts.fr)
      .concat(Object.values(texts.en))
      .every(v => typeof v === "string" && v.trim())
  );
  // Language: an explicit choice wins, otherwise the browser decides.
  {
    const { resolveLanguage } = await import(
      pathToFileURL(path.join(JS_DIR, "config", "language.js")).href
    );
    check(
      "langue : choix explicite, sinon navigateur",
      [
        resolveLanguage("fr", ["en-US"]),
        resolveLanguage("en", ["fr-FR"]),
        resolveLanguage("", ["fr-CA", "en"]),
        resolveLanguage("", ["de-DE", "fr"]),
        resolveLanguage("", [])
      ],
      ["fr", "en", "fr", "en", "en"]
    );
  }

  // Example data: added next to what exists, never twice, only documentation
  // addresses, and the Fortune Cookie bar turns on.
  {
    const { withDemo, demoData } = await import(
      pathToFileURL(path.join(JS_DIR, "config", "demo.js")).href
    );
    const empty = {
      services: [],
      categories: [],
      dashboards: [{ id: "main", name: "Dashboard", icon: "fa-solid fa-grip" }],
      hosts: [
        { id: "dashmon-local", name: "Dashmon", monitoring: { type: "local", enabled: true } }
      ]
    };
    const once = withDemo(empty, "fr");
    const twice = withDemo({ ...empty, ...once }, "fr");
    check(
      "exemple : applications, categories et hotes ajoutes",
      [once.services.length, once.categories.length, once.hosts.length, once.fortune],
      [9, 3, 4, true]
    );
    check(
      "exemple : rien n'est ajoute deux fois",
      [twice.services.length, twice.categories.length, twice.hosts.length],
      [9, 3, 4]
    );
    ok(
      "exemple : l'hote local est garde",
      once.hosts[0].id === "dashmon-local" && once.hosts[0].monitoring?.enabled === true
    );
    ok(
      "exemple : categories rangees dans le premier dashboard",
      once.categories.every(category => category.dashboardId === "main")
    );
    ok(
      "exemple : chaque application pointe sur un hote et une categorie de l'exemple",
      once.services.every(
        service =>
          once.hosts.some(host => host.name === service.host) &&
          once.categories.some(category => category.name === service.category)
      )
    );
    ok(
      "exemple : adresses de documentation uniquement, sans supervision",
      ["en", "fr"].every(language =>
        demoData(language).services.every(
          service =>
            /^https?:\/\/([a-z0-9-]+\.exemple\.lan|192\.0\.2\.\d+)(:\d+)?$/.test(service.url) &&
            service.monitor === false
        )
      )
    );
  }

  {
    const masonry = await import(
      pathToFileURL(path.join(JS_DIR, "supervision", "masonry.js")).href
    );
    // A card spans the 4 px rows of its height plus the 16 px gap below it.
    check("mosaique : rangees d'une carte de 100 px", masonry.masonrySpan(100), 29);
    check("mosaique : hauteur fractionnaire arrondie au-dessus", masonry.masonrySpan(100.2), 30);
    check("mosaique : carte encore invisible", masonry.masonrySpan(0), 1);
    check("mosaique : colonnes comptees", masonry.trackCount("413.3px 413.3px 413.3px"), 3);
    check("mosaique : aucune colonne", masonry.trackCount("none"), 1);
  }
  {
    const { placeColumns, rowSpan } = await import(
      pathToFileURL(path.join(JS_DIR, "dashboard", "columns-layout.js")).href
    );
    // 4 px rows plus the 10 px gap below the category.
    check("colonnes : rangees d'une categorie de 90 px", rowSpan(90), 25);
    // In order, each category into the least tall column (leftmost on a tie).
    const tall = rowSpan(400);
    const short = rowSpan(40);
    check(
      "colonnes : mosaique dans l'ordre, colonne la moins haute",
      placeColumns([400, 40, 200, 40, 40], 3).map(item => item.column),
      [0, 1, 2, 1, 1]
    );
    // Folding the first category keeps every column: only rows move.
    const kept = placeColumns([40, 40, 200, 40, 40], 3, [0, 1, 2, 1, 1]);
    check(
      "colonnes : un repli ne change pas de colonne",
      kept.map(item => item.column),
      [0, 1, 2, 1, 1]
    );
    check("colonnes : la suivante remonte dans sa colonne", kept[3].start, short);
    check(
      "colonnes : rangee de depart apres la precedente",
      placeColumns([400, 40], 1)[1].start,
      tall
    );
    // A column count that changed gets a fresh choice.
    check(
      "colonnes : colonne hors grille rechoisie",
      placeColumns([40, 40], 1, [0, 2]).map(item => item.column),
      [0, 0]
    );
  }
  const toolbar = await import(pathToFileURL(path.join(JS_DIR, "toolbar.js")).href);
  {
    const { foldText, serviceMatchesSearch } = await importStateModules();
    check("recherche : accents et casse ignores", foldText(" Sécurité Hôte "), "securite hote");
    const service = { name: "Coffre", category: "Sécurité", url: "https://coffre.exemple.lan" };
    ok("recherche : categorie trouvee sans accent", serviceMatchesSearch(service, "securite"));
    ok("recherche : URL sans le protocole", serviceMatchesSearch(service, "coffre.exemple"));
    ok("recherche : le protocole ne correspond pas", !serviceMatchesSearch(service, "https"));
  }
  check("toolbar : menu a gauche recadre", toolbar.menuRightOffset(-80, 150, 800), -88);
  check("toolbar : menu bien place inchange", toolbar.menuRightOffset(500, 730, 800), 0);
  check("toolbar : menu a droite recadre", toolbar.menuRightOffset(600, 830, 800), 38);
  const indexHtml = readSource("public", "index.html");
  const toolbarHtml = indexHtml.slice(indexHtml.indexOf('class="toolbar"'));
  ok(
    "toolbar : la loupe ouvre les actions, la recherche est sous la barre",
    toolbarHtml.indexOf('id="searchBtn"') < toolbarHtml.indexOf('id="viewBtn"') &&
      toolbarHtml.indexOf('id="searchBox"') > toolbarHtml.indexOf('id="topMenu"') &&
      /id="searchBox"[^>]*hidden/.test(toolbarHtml)
  );
  // Marges : une seule marge de page, calculee sans la barre de defilement
  // (100vw l'inclut et decalait les bandeaux de 7,5 px sur PC).
  {
    const raw = file => fs.readFileSync(path.join(ROOT, "public", ...file.split("/")), "utf8");
    const css = raw("css/base.css") + COMPONENT_CSS.map(file => raw("css/" + file)).join("");
    ok(
      "mise en page : bandeaux alignes sur le contenu, barre de defilement comprise",
      !css.includes("100vw - 1280px") &&
        (css.match(/max\(var\(--page-gutter\), calc\(\(100% - 1280px\) \/ 2\)\)/g) || []).length ===
          4
    );
    ok(
      "reglages : disponibles sur tablette (600 px et plus)",
      raw("js/app.js").includes('matchMedia("(max-width: 599px)")') &&
        !/max-width: 700px\) \{\s*#menuSettingsBtn/.test(css)
    );
  }
  ok(
    "widgets : unite de la valeur masquee sur une tuile etroite",
    contains(
      readSource("public", "css", "dashboard.css"),
      "@container (max-width: 340px){.widget-badge-unit{display:none;}}"
    ) &&
      readSource("public", "js", "widget-registry.js").includes("badgeUnit") &&
      readSource("public", "js", "dashboard", "cards.js").includes("widget-badge-unit")
  );
  ok(
    "toolbar : actions groupees a droite, onglets en dessous si la place manque",
    contains(readSource("public", "css", "base.css"), "flex-wrap:wrap-reverse") &&
      contains(
        readSource("public", "css", "base.css"),
        ".toolbar-actions{display:flex;flex:0 0 auto;align-items:center;gap:10px;margin-left:auto;}"
      )
  );

  // La carte APT partage la commande globale et conserve son etat au refresh.
  // The supervision page (supervision.js) and its cards (supervision/).
  const supervisionSource = [
    "supervision.js",
    ...fs.readdirSync(path.join(JS_DIR, "supervision")).map(f => "supervision/" + f)
  ]
    .map(file => readSource("public", "js", ...file.split("/")))
    .join("");
  const aptSource = readSource("public", "js", "supervision", "apt-card.js");
  ok(
    "APT : carte incluse dans le depliage global",
    contains(supervisionSource, ".supervision-card-apt.has-details")
  );
  ok(
    "supervision : chaque tuile porte son propre titre",
    [
      "supervisionHostTitle",
      "supervisionWireguardTitle",
      "supervisionSmartTitle",
      "supervisionAptTitle"
    ].every(key => contains(supervisionSource, 't("' + key + '")'))
  );
  ok(
    "APT : chevron et clavier",
    contains(aptSource, "supervision-smart-chevron") &&
      contains(aptSource, 'event.key!=="Enter"') &&
      contains(aptSource, 'event.key!==" "')
  );
  ok(
    "APT : etat conserve par instance et hote",
    contains(aptSource, 'isExpanded("supervisionAptExpanded",key)') &&
      contains(supervisionSource, "selectedSupervisionInstanceId(),host.id")
  );
  ok(
    "supervision : le depliage est enregistre en direct",
    contains(supervisionSource, 'setExpanded("supervisionSmartExpanded",key,expanded)') &&
      contains(supervisionSource, 'setExpanded("supervisionHostExpanded",key,expanded)') &&
      contains(supervisionSource, 'setExpanded("supervisionAptExpanded",key,open)') &&
      contains(supervisionSource, "saveViewPrefs({[field]:state[field]})")
  );
  ok(
    "APT : sortie affichee comme texte",
    contains(aptSource, "message.textContent=") && !contains(aptSource, "message.innerHTML")
  );
  ok(
    "APT : statut a jour/pas a jour avec coche comme la sante de l'hote",
    contains(aptSource, 'className="supervision-health"') &&
      contains(aptSource, "aptHealth(report)") &&
      !contains(aptSource, "supervision-apt-dot")
  );
  {
    const health = await import(
      pathToFileURL(path.join(JS_DIR, "supervision", "directory-health.js")).href
    );
    const { state } = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);
    const language = state.language;
    state.language = "fr";
    const now = 1_000_000;
    check(
      "repertoires : etat, cause d'echec et pourcentage localise",
      [
        health.directoryHealth({ updatedAt: now, directories: [{ bytes: 1 }, { bytes: 2 }] }, now),
        health.directoryHealth({ updatedAt: now - 3 * 86400, directories: [] }, now).key,
        health.directoryHealth({ updatedAt: now, directories: [{ bytes: null }] }, now).key,
        health.directoryErrorKey({ error: "invalid_directory" }),
        health.directoryErrorKey({ error: "not_measured" }),
        health.directoryErrorKey({}),
        health.sharePercentText(47.5).replace(/\s/g, " ")
      ],
      [
        { level: "healthy", key: "directorySizesSummary", count: 2, total: 3 },
        "directorySizesStale",
        "directorySizesUnmeasured",
        "directorySizesErrorMissing",
        "directorySizesNotMeasured",
        "directorySizesError",
        "47,5 %"
      ]
    );
    state.language = language;
  }
  {
    const { aptHealth } = await import(
      pathToFileURL(path.join(JS_DIR, "supervision", "apt-health.js")).href
    );
    check(
      "APT : paquets installes = a jour, seuls l'echec et le redemarrage alertent",
      [
        aptHealth(null).label,
        aptHealth({ status: "success", updated: 7 }).label,
        aptHealth({ status: "success", updated: 0 }).label,
        aptHealth({ status: "success", updated: 3, rebootRequired: true }).label,
        aptHealth({ status: "failed", updated: 3 }).label
      ],
      [
        "aptUpdatesNoReport",
        "aptUpdatesUpToDate",
        "aptUpdatesUpToDate",
        "aptUpdatesRebootRequired",
        "aptUpdatesFailed"
      ]
    );
  }
  ok(
    "APT : prochain passage sous le dernier passage",
    aptSource.indexOf(squash("aptUpdatesNextRun")) > aptSource.indexOf(squash("aptUpdatesLastRun"))
  );
  ok(
    "APT : details replies par defaut",
    (() => {
      const css = readSource("public", "css", "supervision.css");
      return (
        contains(css, ".supervision-apt-details{display:none") &&
        contains(css, ".supervision-card-apt.expanded .supervision-apt-details{display:grid}")
      );
    })()
  );
  const agentEditorSource = editorSource();
  ok(
    "agents : test depuis le principal sans bouton parametrer redondant",
    contains(agentEditorSource, 'fetch("/api/agents/test"') &&
      !contains(agentEditorSource, "agent-configure")
  );
  ok(
    "agents : hote associe a chaque pairage",
    contains(agentEditorSource, "agentHosts") && contains(agentEditorSource, 't("agentHostLabel")')
  );
  ok(
    "agents : enregistrement possible sans hote",
    contains(agentEditorSource, 't("agentHostRequiredTitle")') &&
      contains(agentEditorSource, 't("agentHostSaveAnyway")') &&
      contains(agentEditorSource, "createHostDraft")
  );
  const confirmSource = readSource("public", "js", "editor", "confirm-dialog.js");
  ok(
    "agents : dialogue d'avertissement signale et aligne",
    contains(agentEditorSource, "fa-triangle-exclamation") && contains(confirmSource, '" multi"')
  );
  ok(
    "agents : couleur reprise de l'hote au survol, icone processeur",
    contains(supervisionSource, "agentHosts[selected.id]") &&
      contains(supervisionSource, "fa-solid fa-microchip") &&
      contains(supervisionSource, "sanitizeTileColor(linked?.color)")
  );
  for (const doc of ["WIREGUARD.md", "SMART.md", "APT_UPDATES.md"]) {
    ok(
      "agents : guide accessible depuis les parametres : " + doc,
      contains(agentEditorSource, doc)
    );
  }
  ok(
    "agents : guide de deploiement accessible depuis le principal",
    contains(agentEditorSource, "GETTING_STARTED.md#3-install-an-agent")
  );

  // --- 2. Registre des widgets cote client ------------------------------
  // La liste publique est produite par le vrai core : le test verifie donc
  // aussi que le contrat serveur -> navigateur tient.
  const core = new WidgetCore({
    root: ROOT,
    dataDir: os.tmpdir(),
    log: () => {},
    decryptSecret: v => v,
    encryptSecret: v => v,
    sanitizeText: v => String(v == null ? "" : v),
    sanitizeUrl: v => String(v == null ? "" : v).trim(),
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

  check("registre client : widgets charges", loaded.slice().sort(), [
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
  ]);
  ok("registre client : metadonnees disponibles", !!registry.getWidgetMeta("docker"));
  ok("registre client : widget inconnu -> null", registry.getWidgetMeta("inconnu") === null);
  check(
    "registre client : widget suggere depuis le titre",
    [
      registry.suggestedWidgetId("MeTube"),
      registry.suggestedWidgetId("me tube"),
      registry.suggestedWidgetId("application inconnue"),
      registry.suggestedWidgetId("opencode")
    ],
    ["metube", "metube", "", "opencode"]
  );
  // Les sources des compteurs de liens (GitHub, Docker Hub, YouTube) sont aussi
  // internes au moteur : elles ne doivent pas apparaitre dans le menu des
  // widgets de tuile.
  check(
    "registre client : le menu ne propose pas les plugins internes",
    registry.listWidgetMetas().map(m => m.id),
    [
      "adguard",
      "docker",
      "duplicati",
      "gotify",
      "lichess",
      "metube",
      "opencode",
      "ping",
      "qbittorrent",
      "uptimekuma"
    ]
  );
  ok(
    "registre client : le plugin interne reste interrogeable (config, libelles)",
    !!registry.getWidgetMeta("web") &&
      registry.widgetLabel(registry.getWidgetMeta("web"), "fr") === "Lien"
  );
  // Les compteurs de liens gardent leur schema de config, meme internes : c'est
  // lui qui decrit les champs du compteur dans l'editeur des liens web.
  const githubMeta = registry.getWidgetMeta("github");
  check(
    "registre client : schema GitHub",
    githubMeta.config.map(f => f.key),
    ["repo", "metric"]
  );
  check(
    "registre client : options de la statistique GitHub",
    githubMeta.config[1].options.map(o => o.value),
    ["stars", "forks", "issues", "watchers"]
  );
  check(
    "registre client : libelle traduit du champ depot",
    registry.fieldLabel(githubMeta, githubMeta.config[0], "fr"),
    "Dépôt"
  );
  check(
    "registre client : placeholder traduit du depot",
    registry.fieldPlaceholder(
      { ...githubMeta, strings: { en: { repoPlaceholder: "owner/name" } } },
      githubMeta.config[0],
      "en"
    ),
    "owner/name"
  );

  const dockerMeta = registry.getWidgetMeta("docker");
  check("registre client : libelle traduit", registry.widgetLabel(dockerMeta, "fr"), "Docker");
  check(
    "registre client : libelles de champs traduits",
    registry.fieldLabel(dockerMeta, dockerMeta.config[0], "fr"),
    "Connexion"
  );
  check(
    "registre client : placeholder traduit",
    registry.fieldPlaceholder(dockerMeta, dockerMeta.config[1], "fr"),
    "tcp://hôte:2375 ou https://…"
  );
  check(
    "registre client : placeholder anglais",
    registry.fieldPlaceholder(dockerMeta, dockerMeta.config[1], "en"),
    "tcp://host:2375 or https://…"
  );
  check(
    "registre client : libelle i18n de l'application intact",
    registry.widgetString(dockerMeta, "missingUrl", "fr"),
    "URL Docker TCP manquante"
  );

  // Champs conditionnels : l'URL n'existe qu'en mode TCP.
  check(
    "registre client : champ masque en mode local",
    registry.visibleFields(dockerMeta, { mode: "local" }).map(f => f.key),
    ["mode"]
  );
  check(
    "registre client : champ visible en mode TCP",
    registry.visibleFields(dockerMeta, { mode: "tcp" }).map(f => f.key),
    ["mode", "url"]
  );

  // Normalisation : valeurs hors schema corrigees, secret conserve tel quel.
  check(
    "registre client : config Docker normalisee",
    registry.normalizeWidgetConfig({ type: "docker", mode: "tcp", url: " tcp://h:2375 " }),
    { type: "docker", mode: "tcp", url: "tcp://h:2375" }
  );
  // La cle de statut publiee par le serveur doit survivre : sans elle, une
  // tuile Docker (cle par configuration) ne retrouve pas son entree de cache.
  check(
    "registre client : la cle de statut survit a la normalisation",
    registry.normalizeWidgetConfig({
      type: "docker",
      mode: "local",
      url: "",
      key: "docker:local|"
    }),
    { type: "docker", mode: "local", url: "", key: "docker:local|" }
  );
  check(
    "registre client : la cle recopiee reste la cle de la tuile",
    registry.widgetStatusKey({
      url: "https://portainer.exemple.lan/",
      widget: registry.normalizeWidgetConfig({
        type: "docker",
        mode: "local",
        url: "",
        key: "docker:local|"
      })
    }),
    "docker:local|"
  );
  check(
    "registre client : changement de type = defauts du nouveau widget",
    registry.inheritWidgetConfig("lichess", {
      type: "docker",
      mode: "tcp",
      url: "tcp://h:2375",
      key: "docker:x"
    }),
    { type: "lichess", username: "", variant: "" }
  );
  check(
    "registre client : select hors options -> defaut",
    registry.normalizeWidgetConfig({ type: "lichess", username: "exemple", variant: "torpedo" }),
    { type: "lichess", username: "exemple", variant: "" }
  );
  const encryptedSecret = "aes1." + require("crypto").randomBytes(32).toString("base64");
  check(
    "registre client : secret chiffre non touche",
    registry.normalizeWidgetConfig({ type: "duplicati", password: encryptedSecret }).password,
    encryptedSecret
  );
  check(
    "registre client : widget inconnu conserve intact",
    registry.normalizeWidgetConfig({ type: "tiers", foo: "bar" }),
    { type: "tiers", foo: "bar" }
  );
  check("registre client : pas de widget -> null", registry.normalizeWidgetConfig(null), null);
  check(
    "registre client : config neuve = defauts du manifest",
    registry.defaultWidgetConfig("docker"),
    { type: "docker", mode: "local", url: "" }
  );
  check(
    "registre client : changement de type conserve les cles communes",
    registry.inheritWidgetConfig("adguard", {
      type: "adguard",
      username: "exemple",
      password: encryptedSecret
    }).username,
    "exemple"
  );

  // Cle de statut : publiee par le serveur, jamais recomposee par le client.
  check(
    "registre client : cle de statut publiee",
    registry.widgetStatusKey({ widget: { type: "docker", key: "docker:local|" } }),
    "docker:local|"
  );
  check(
    "registre client : repli sur l'URL du service",
    registry.widgetStatusKey({ url: "https://exemple.lan", widget: { type: "adguard" } }),
    "https://exemple.lan"
  );

  // Rendu : sans renderer (import impossible hors navigateur), la tuile doit
  // rester affichable et le widget ne doit jamais faire tomber le dashboard.
  const view = registry.renderWidget(
    { url: "", widget: { type: "docker", mode: "local" } },
    { ok: true, containers: { active: 1, total: 1 } },
    "fr"
  );
  ok("registre client : rendu de repli sans exception", view && typeof view.badge === "string");
  ok("registre client : rendu de repli neutralise", view.badgeClass === "pending");
  ok(
    "registre client : widget inconnu = repli",
    registry.renderWidget({ widget: { type: "nope" } }, null, "fr").badgeClass === "pending"
  );
  // A failed check looks the same on every widget: yellow "!" and one word.
  const unreachable = registry.renderWidget(
    { widget: { type: "docker" } },
    { ok: false, error: "connect ECONNREFUSED 192.0.2.1:2375" },
    "fr"
  );
  check(
    "widget en echec : injoignable",
    [unreachable.badge, unreachable.badgeClass, unreachable.icon],
    ["Injoignable", "error", "fa-solid fa-circle-exclamation"]
  );
  ok("widget en echec : cause en infobulle", /ECONNREFUSED/.test(unreachable.title));
  check(
    "widget en echec : autre erreur",
    registry.renderWidget({ widget: { type: "nope" } }, { ok: false, error: "HTTP 401" }, "en")
      .badge,
    "Error"
  );

  // Les helpers de formatage sont utilises par les renderers de widgets.
  const format = await import(pathToFileURL(path.join(JS_DIR, "format.js")).href);
  // Date de midi : le resultat ne depend pas du fuseau du runner.
  check(
    "format : date FR",
    format.formatDateTime(new Date(2026, 0, 2, 12, 0).getTime(), "fr"),
    "02/01/2026"
  );
  check("format : nombre EN", format.formatNumber(1234567, "en"), "1,234,567");
  ok(
    "format : valeur invalide toleree",
    format.formatDateTime("n'importe quoi", "fr") !== undefined
  );

  // --- 3. Pastilles de supervision ---------------------------------------
  const status = await import(pathToFileURL(path.join(JS_DIR, "status.js")).href);
  check("pastille : disponible = coche verte", status.statusIcon("up"), "fa-solid fa-circle-check");
  check(
    "pastille : indisponible = croix rouge",
    status.statusIcon("down"),
    "fa-solid fa-circle-xmark"
  );
  check(
    "pastille : statut inconnu = rond vide",
    status.statusIcon("pending"),
    "fa-regular fa-circle"
  );
  // Supervision non importante : l'etat reste "soft" (l'info-bulle le dit),
  // mais la pastille est un rond vide, exactement comme un statut inconnu.
  check(
    "pastille : supervision non importante = rond vide",
    status.statusIcon(status.effectiveStatus("soft", { state: "down" })),
    status.statusIcon("pending")
  );
  check(
    "pastille : supervision non importante, etat conserve pour l'info-bulle",
    status.effectiveStatus("soft", { state: "down" }),
    "soft"
  );
  check(
    "pastille : supervision non importante, service disponible = coche verte",
    status.effectiveStatus("soft", { state: "up" }),
    "up"
  );
  check(
    "pastille : rien de connu = statut inconnu",
    status.effectiveStatus("soft", null),
    "pending"
  );

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
    const stateModule = await importStateModules();

    check("prefs : la liste des cles est stable", stateModule.VIEW_PREF_KEYS.slice(), [
      "viewMode",
      "sortMode",
      "groupMode",
      "openMode",
      "smallIcons",
      "collapsed",
      "webLinksHidden",
      "page",
      "dashboardId",
      "supervisionInstanceId",
      "supervisionSmartExpanded",
      "supervisionHostExpanded",
      "supervisionDirectoryExpanded",
      "supervisionAptExpanded",
      "supervisionOpencodeExpanded",
      "supervisionClaudeExpanded",
      "supervisionSpeedtestExpanded",
      "categoryColumns",
      "tileColumns",
      "supervisionColumns"
    ]);

    // Rien d'ecrit tant que l'utilisateur n'a rien change.
    check("prefs : navigateur neuf = aucune preference", prefs.loadViewPrefs(), {});

    saved.set(
      "dashmon.view",
      JSON.stringify({ viewMode: "rows", webLinksCollapsed: true, hostsDisplay: "icon" })
    );
    check("prefs : anciens reglages retires ignores", prefs.loadViewPrefs(), { viewMode: "rows" });
    saved.clear();

    prefs.saveViewPrefs({ webLinksHidden: true, webLinksColor: "blue" });
    check("prefs : masquage local sans couleur globale", prefs.loadViewPrefs(), {
      webLinksHidden: true
    });
    saved.clear();
    check(
      "prefs : masquage invalide ignore",
      stateModule.normalizeViewPrefs({ webLinksHidden: "true" }).webLinksHidden,
      false
    );

    check(
      "pages : tableau de bord par defaut",
      stateModule.normalizeViewPrefs({}).page,
      "dashboard"
    );
    check(
      "pages : supervision conservee",
      stateModule.normalizeViewPrefs({ page: "supervision" }).page,
      "supervision"
    );
    check(
      "pages : page inconnue recalee",
      stateModule.normalizeViewPrefs({ page: "admin" }).page,
      "dashboard"
    );
    check(
      "pages : dashboard actif normalise",
      stateModule.normalizeViewPrefs({ dashboardId: " main " }).dashboardId,
      "main"
    );
    check(
      "pages : dashboard actif vide par defaut",
      stateModule.normalizeViewPrefs({}).dashboardId,
      ""
    );
    check(
      "pages : instance de supervision conservee",
      stateModule.normalizeViewPrefs({ supervisionInstanceId: "https://dashmon.exemple.lan" })
        .supervisionInstanceId,
      "https://dashmon.exemple.lan"
    );
    check(
      "pages : instance de supervision vide recalee sur local",
      stateModule.normalizeViewPrefs({ supervisionInstanceId: " " }).supervisionInstanceId,
      "local"
    );
    check(
      "tuiles : etat de depliage normalise",
      stateModule.normalizeViewPrefs({
        supervisionSmartExpanded: ['["local","hote"]', 42, "", '["local","hote"]'],
        supervisionHostExpanded: "oops",
        supervisionAptExpanded: ['["local","hote"]']
      }),
      {
        viewMode: "columns",
        openMode: "same",
        groupMode: "category",
        sortMode: "alphabetical",
        page: "dashboard",
        dashboardId: "",
        supervisionInstanceId: "local",
        smallIcons: false,
        webLinksHidden: false,
        collapsed: {},
        supervisionSmartExpanded: ['["local","hote"]'],
        supervisionHostExpanded: [],
        supervisionDirectoryExpanded: [],
        supervisionAptExpanded: ['["local","hote"]'],
        supervisionOpencodeExpanded: [],
        supervisionClaudeExpanded: [],
        supervisionSpeedtestExpanded: [],
        categoryColumns: "auto",
        tileColumns: "auto",
        supervisionColumns: "auto"
      }
    );

    check("dashboards : un onglet par defaut", stateModule.normalizeConfig({}).dashboards, [
      { id: "main", name: "Dashboard", icon: "fa-solid fa-grip" }
    ]);
    const catsDefault = stateModule.normalizeConfig({
      dashboards: [{ id: "main", name: "Dashboard" }],
      categories: [{ name: "Infra" }, { name: "Apps", dashboardId: "main" }]
    }).categories;
    check(
      "dashboards : categorie rattachee au premier dashboard",
      catsDefault.map(c => c.dashboardId),
      ["main", "main"]
    );
    const catsUnknown = stateModule.normalizeConfig({
      dashboards: [
        { id: "main", name: "A" },
        { id: "second", name: "B" }
      ],
      categories: [
        { name: "Infra", dashboardId: "second" },
        { name: "Apps", dashboardId: "ghost" }
      ]
    }).categories;
    check(
      "dashboards : dashboardId inconnu recale sur le premier",
      catsUnknown.map(c => c.dashboardId),
      ["second", "main"]
    );
    const dashReserved = stateModule.normalizeConfig({
      dashboards: [
        { id: "supervision", name: "A" },
        { id: "supervision", name: "B" }
      ]
    }).dashboards;
    check(
      "dashboards : identifiant reserve regenere",
      dashReserved.every(d => d.id !== "supervision"),
      true
    );
    check(
      "dashboards : identifiants uniques",
      new Set(dashReserved.map(d => d.id)).size,
      dashReserved.length
    );

    check(
      "liens : ancienne couleur du bandeau retiree",
      "webLinksColor" in stateModule.normalizeConfig({ webLinksColor: "blue" }),
      false
    );

    const legacy = stateModule.normalizeConfig({
      hosts: [
        {
          name: "Hote",
          icon: "fa-solid fa-server",
          color: "#123456",
          monitoring: { enabled: true, type: "local" }
        }
      ],
      faviconEnabled: false,
      webLinksCollapsed: true
    });
    check(
      "config : hote conserve avec sa supervision",
      [
        legacy.hosts[0].name,
        legacy.hosts[0].color,
        legacy.hosts[0].monitoring && legacy.hosts[0].monitoring.enabled,
        legacy.hosts[0].monitoring && legacy.hosts[0].monitoring.type
      ],
      ["Hote", "#123456", true, "local"]
    );
    // Comme sur le serveur (lib/config/fields.js) : un autre type est ecarte.
    check(
      "config : supervision de type inconnu ignoree",
      stateModule.normalizeConfig({
        hosts: [{ name: "H", monitoring: { enabled: true, type: "n'importe quoi" } }]
      }).hosts[0].monitoring,
      null
    );
    check(
      "config : supervision sans type consideree locale",
      stateModule.normalizeConfig({
        hosts: [{ name: "H", monitoring: { enabled: true } }]
      }).hosts[0].monitoring.type,
      "local"
    );
    check(
      "config : seul local est un type de supervision",
      stateModule.HOST_MONITORING_TYPES.slice(),
      ["local"]
    );
    check(
      "config : ancienne supervision Proxmox ignoree",
      stateModule.normalizeHostMonitoring({ enabled: true, type: "proxmox" }),
      null
    );
    check(
      "config : rapport APT actif par defaut",
      stateModule.normalizeHostMonitoring({ enabled: true, type: "local" }).aptUpdates,
      { enabled: true }
    );
    check(
      "config : rapport APT desactive conserve",
      stateModule.normalizeHostMonitoring({
        enabled: true,
        type: "local",
        aptUpdates: { enabled: false }
      }).aptUpdates,
      { enabled: false }
    );
    check(
      "config : hote sans supervision reste sans objet",
      stateModule.normalizeConfig({ hosts: [{ name: "H", icon: "fa-solid fa-server" }] }).hosts[0]
        .monitoring,
      null
    );
    check(
      "config : options retirees ignorees",
      [legacy.faviconEnabled, legacy.webLinksCollapsed],
      [undefined, undefined]
    );

    prefs.saveViewPrefs({ viewMode: "rows" });
    check("prefs : la disposition est relue", prefs.loadViewPrefs().viewMode, "rows");

    // Une preference de serveur (langue, services) ne doit jamais atterrir
    // dans le stockage du navigateur.
    prefs.saveViewPrefs({ language: "en", services: [{ name: "x" }], theme: "matrix" });
    check(
      "prefs : rien d'autre que la disposition n'est ecrit",
      Object.keys(JSON.parse(saved.get("dashmon.view"))),
      ["viewMode"]
    );

    prefs.saveViewPrefs({ collapsed: { "category:Jeux": true } });
    check("prefs : les prefs s'accumulent sans s'ecraser", prefs.loadViewPrefs().collapsed, {
      "category:Jeux": true
    });

    prefs.saveViewPrefs({ supervisionAptExpanded: ['["local","hote"]'] });
    check("prefs : depliage des tuiles relu", prefs.loadViewPrefs().supervisionAptExpanded, [
      '["local","hote"]'
    ]);

    // Valeur bricolee a la main dans le navigateur : la normalisation de
    // state.js doit la remplacer par un defaut sur, jamais la propager.
    check(
      "prefs : valeur invalide recalee",
      stateModule.normalizeViewPrefs({ viewMode: "n'importe quoi" }).viewMode,
      "columns"
    );
    check(
      "prefs : le navigateur prime sur la config serveur",
      stateModule.normalizeViewPrefs(Object.assign({ viewMode: "columns" }, prefs.loadViewPrefs()))
        .viewMode,
      "rows"
    );

    check(
      "prefs : extraction depuis la config serveur",
      prefs.pickViewPrefs({ viewMode: "plain", language: "en", hosts: [] }),
      { viewMode: "plain" }
    );

    // Stockage indisponible (navigation privée) : l'appel ne doit pas lever.
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("bloqué");
      }
    };
    ok(
      "prefs : stockage indisponible = repli silencieux",
      prefs.loadViewPrefs().viewMode === undefined &&
        prefs.saveViewPrefs({ viewMode: "rows" }).viewMode === "rows"
    );
  } finally {
    if (realStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = realStorage;
  }

  // — Couleur des tuiles : toujours attribuee, jamais en double ————————
  // Une categorie ou un hote sans couleur se confondait avec une section non
  // configuree. L'affectation se fait a la normalisation, donc elle doit
  // fonctionner meme sans jamais ouvrir l'editeur.
  const stateModule = await importStateModules();
  const namedAgent = stateModule.normalizeConfig({
    replication: {
      secondaries: ["https://exemple.lan"],
      agentNames: { "https://exemple.lan": "Supervision" },
      agentIcons: { "https://exemple.lan": "fa-solid fa-server" },
      agentHosts: { "https://exemple.lan": "host-1" }
    }
  }).replication;
  check(
    "agent : icone d'onglet normalisee",
    namedAgent.agentIcons["https://exemple.lan/"],
    "fa-solid fa-server"
  );
  check(
    "agent : nom et URL normalises",
    namedAgent.agentNames["https://exemple.lan/"],
    "Supervision"
  );
  check("agent : hote associe normalise", namedAgent.agentHosts["https://exemple.lan/"], "host-1");
  check(
    "agent : ancienne configuration sans noms",
    stateModule.normalizeConfig({ replication: { secondaries: ["https://exemple.lan"] } })
      .replication.agentNames,
    {}
  );
  check(
    "agent : ancienne configuration sans hotes",
    stateModule.normalizeConfig({ replication: { secondaries: ["https://exemple.lan"] } })
      .replication.agentHosts,
    {}
  );
  const PALETTE = stateModule.TILE_COLORS;
  const assign = stateModule.assignTileColors;
  const cats = [{ name: "A" }, { name: "B" }, { name: "C" }];
  assign(cats, new Set());
  ok(
    "couleur : attribuee quand elle manque",
    cats.every(c => c.color && PALETTE.includes(c.color)),
    JSON.stringify(cats)
  );
  ok(
    "couleur : trois couleurs distinctes",
    new Set(cats.map(c => c.color)).size === 3,
    JSON.stringify(cats)
  );

  // Categories et hotes n'ont AUCUN lien de couleur : les deux listes sont
  // traitees separement, donc une couleur d'hote peut legitimement reprendre
  // celle d'une categorie.
  const hostColors = [{ name: "nas" }, { name: "pve" }];
  assign(hostColors, new Set());
  ok(
    "couleur : un hote peut porter la meme couleur qu'une categorie",
    hostColors[0].color === cats[0].color,
    "categorie=" + cats[0].color + " hote=" + hostColors[0].color
  );

  const kept = [{ name: "D", color: "#ef476f" }, { name: "E" }];
  assign(kept, new Set());
  ok(
    "couleur : le choix de l'utilisateur est conserve",
    kept[0].color === "#ef476f",
    kept[0].color
  );

  // Palette epuisee : on reboucle plutot que de laisser un element sans
  // couleur.
  const many = Array.from({ length: 14 }, (_, i) => ({ name: "x" + i }));
  assign(many, new Set());
  ok(
    "couleur : palette epuisee, tout le monde a une couleur",
    many.every(c => c.color),
    many.filter(c => !c.color).length + " sans couleur"
  );

  const dirty = [
    { name: "F", color: "red" },
    { name: "G", color: "var(--x)" }
  ];
  assign(dirty, new Set());
  ok(
    "couleur : valeur non hexadecimale remplacee",
    dirty.every(c => /^#[0-9a-f]{6}$/.test(c.color)),
    JSON.stringify(dirty)
  );

  ok("couleur : validation refuse rgb()", stateModule.sanitizeTileColor("rgb(1,2,3)") === "");
  ok(
    "couleur : validation refuse la forme courte #abc",
    stateModule.sanitizeTileColor("#abc") === ""
  );

  // --- 5. Barre fortune : phrase du jour, clic, fermeture, expiration ------
  // Le module touche localStorage a la lecture seule, jamais a l'import, donc
  // il se teste hors navigateur avec un stockage simule.
  const fortuneSaved = new Map();
  const fortuneRealStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: key => (fortuneSaved.has(key) ? fortuneSaved.get(key) : null),
    setItem: (key, value) => fortuneSaved.set(key, String(value)),
    removeItem: key => fortuneSaved.delete(key)
  };
  try {
    const fortune = await import(pathToFileURL(path.join(JS_DIR, "fortune.js")).href);
    fortune.setFortunes([
      { id: "m1", fr: "Phrase une", en: "Phrase one" },
      { id: "m2", fr: "Phrase deux", en: "Phrase two" },
      { id: "m3", fr: "Phrase trois", en: "Phrase three" }
    ]);

    // L'identite d'une tuile speciale est son type : une seule memoire.
    const tileKey = "fortune";

    ok(
      "fortune : le fichier livre contient des phrases",
      fs.existsSync(path.join(PUBLIC_DIR, "fortune-messages.json"))
    );

    // Le jour local, pas UTC : la phrase change au minuit du lecteur.
    ok(
      "fortune : le jour est au format AAAA-MM-JJ",
      /^\d{4}-\d{2}-\d{2}$/.test(fortune.dayStamp(new Date(2026, 0, 5)))
    );

    ok("fortune : l'identite est le type de la tuile", fortune.fortuneKey(tileKey) === tileKey);

    const today = fortune.fortuneText(tileKey, "fr");
    ok("fortune : une phrase s'affiche", today.length > 0, today);
    ok(
      "fortune : la langue suit le reglage",
      fortune.fortuneText(tileKey, "en") !== "" &&
        /Phrase (one|two|three)/.test(fortune.fortuneText(tileKey, "en")),
      fortune.fortuneText(tileKey, "en")
    );

    // Deterministe : un rechargement ne doit pas changer la phrase du jour.
    ok("fortune : la phrase du jour est stable", fortune.fortuneText(tileKey, "fr") === today);

    // Le clic change la phrase, et le choix survit au rechargement.
    const before = fortune.fortuneText(tileKey, "fr");
    let changed = false;
    for (let i = 0; i < 12 && !changed; i++) {
      changed = fortune.pickFortune(tileKey, "fr") !== before;
    }
    ok("fortune : le clic change de phrase", changed);
    ok(
      "fortune : le choix est memorise",
      fortune.fortuneText(tileKey, "fr") !== before,
      fortune.fortuneText(tileKey, "fr")
    );

    // Une entree d'un autre jour doit etre ignoree : la tuile repart sur la
    // phrase du jour, pas sur un choix d'hier.
    const key = fortune.fortuneKey(tileKey);
    const yesterday = fortune.dayStamp(new Date(2020, 0, 1));
    globalThis.localStorage.setItem(
      "dashmon.fortune",
      JSON.stringify({ [key]: { day: yesterday, index: 0 } })
    );
    ok(
      "fortune : une phrase d'hier est ignoree",
      fortune.fortuneText(tileKey, "fr") === today,
      fortune.fortuneText(tileKey, "fr")
    );

    // Un fichier tri defaillant ne doit pas casser le rendu.
    // Fermee par la croix : jusqu'a minuit, puis de retour ; « Rafraichir » la
    // fait revenir aussitot.
    const day = fortune.dayStamp(new Date(2026, 10, 4));
    ok("fortune : ouverte par defaut", !fortune.fortuneClosedToday(day));
    fortune.closeFortune(day);
    ok("fortune : fermee pour la journee", fortune.fortuneClosedToday(day));
    ok(
      "fortune : de retour le lendemain",
      !fortune.fortuneClosedToday(fortune.dayStamp(new Date(2026, 10, 5)))
    );
    fortune.reopenFortune();
    ok("fortune : rafraichir la fait revenir", !fortune.fortuneClosedToday(day));
    check(
      "fortune : retour a minuit pile",
      fortune.msUntilMidnight(new Date(2026, 10, 4, 23, 59, 30)),
      30000
    );

    fortune.setFortunes([{ id: "x" }, null, { fr: "seule" }]);
    ok(
      "fortune : un fichier invalide est filtre",
      fortune.fortuneText(tileKey, "fr") === "seule",
      fortune.fortuneText(tileKey, "fr")
    );

    // Stockage indisponible : le clic doit rester fonctionnel.
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("bloqué");
      }
    };
    ok(
      "fortune : stockage indisponible = repli silencieux",
      typeof fortune.pickFortune(tileKey, "fr") === "string" &&
        fortune.fortuneText(tileKey, "fr") !== ""
    );
  } finally {
    if (fortuneRealStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = fortuneRealStorage;
  }

  // --- 6. La barre fortune remplace la tuile speciale ---------------------
  const specialState = await importStateModules();
  check("fortune : desactivee par defaut", specialState.normalizeConfig({}).fortune, false);
  check(
    "fortune : une ancienne tuile active la barre",
    specialState.normalizeConfig({ specialTile: { type: "fortune", category: "Divers" } }).fortune,
    true
  );
  check(
    "fortune : le choix explicite l'emporte",
    specialState.normalizeConfig({ fortune: false, specialTile: { type: "fortune" } }).fortune,
    false
  );
  ok(
    "fortune : plus de tuile speciale dans la config",
    !("specialTile" in specialState.normalizeConfig({ specialTile: { type: "fortune" } }))
  );
  const editorSrcForSpecial = editorSource();
  const serverSrcForSpecial =
    readSource("lib", "status", "monitor.js") + readSource("lib", "config", "normalize.js");
  // Cote serveur, le reglage fortune est verifie par son comportement :
  // config-fields.test.js et config-normalize.test.js.

  // L'ecriture durable de config.json est testee dans config-store.test.js.

  // Le genre par service n'existe plus.
  ok(
    "services : le champ kind par service a disparu",
    !/kind:service\.kind/.test(editorSrcForSpecial) && !/kind:svc\.kind/.test(serverSrcForSpecial)
  );

  // --- 6a bis. Dashboards et rattachement des categories ----------------
  // Chaque categorie est rattachee a un dashboard, cote serveur comme cote
  // client : la config publiee porte la liste "dashboards" et chaque categorie
  // son "dashboardId", pour que l'affichage par onglet reste coherent.
  ok(
    "dashboards : le serveur publie la liste des dashboards",
    /dashboards,/.test(serverSrcForSpecial) &&
      /dashboardIds\.has\(sanitizeText\(cat\.dashboardId,64\)\)/.test(serverSrcForSpecial)
  );
  ok(
    "dashboards : l'editeur enregistre les dashboards",
    /state\.dashboards=cleanedDashboards/.test(editorSrcForSpecial)
  );

  // --- 6b. Compteurs du bandeau "Liens web" -----------------------------
  // Un lien web peut porter un compteur public (etoiles GitHub, pulls Docker
  // Hub, abonnes YouTube). La cible est obligatoire, le type est valide contre
  // une liste blanche, et le chiffre est relu depuis l'entree de statut du
  // backend widget correspondant.
  check(
    "compteur de lien : type valide normalise",
    specialState.normalizeLinkCounter({ type: "github", target: "owner/name" }),
    { type: "github", target: "owner/name" }
  );

  ok(
    "compteur de lien : type inconnu refuse",
    specialState.normalizeLinkCounter({ type: "bidon", target: "x/y" }) === null
  );

  ok(
    "compteur de lien : cible obligatoire",
    specialState.normalizeLinkCounter({ type: "github", target: "  " }) === null
  );

  ok(
    "compteur de lien : conserve dans la config normalisee",
    JSON.stringify(
      specialState.normalizeConfig({
        webLinks: [
          {
            name: "GitHub",
            url: "https://github.com/a/b",
            icon: "x",
            counter: { type: "github", target: "a/b" }
          }
        ]
      }).webLinks[0].counter
    ),
    JSON.stringify({ type: "github", target: "a/b" })
  );

  check(
    "compteur de lien : valeur GitHub lue dans 'value'",
    specialState.linkCounterValue({ type: "github" }, { ok: true, value: 109 }),
    109
  );
  check(
    "compteur de lien : valeur Docker Hub lue dans 'pulls'",
    specialState.linkCounterValue({ type: "dockerhub" }, { ok: true, pulls: 12000 }),
    12000
  );
  check(
    "compteur de lien : valeur YouTube lue dans 'subscribers'",
    specialState.linkCounterValue({ type: "youtube" }, { ok: true, subscribers: 3000 }),
    3000
  );
  ok(
    "compteur de lien : aucune valeur quand le statut a echoue",
    specialState.linkCounterValue({ type: "github" }, { ok: false }) === null
  );

  check("compteur de lien : nombre < 1000 affiche tel quel", specialState.compactCount(109), "109");
  check("compteur de lien : milliers compacts en k", specialState.compactCount(3000), "3k");
  check("compteur de lien : milliers avec une decimale", specialState.compactCount(10150), "10.2k");
  check("compteur de lien : millions compacts en M", specialState.compactCount(64600000), "64.6M");
  check(
    "compteur de lien : le million ne s'ecrit pas en k",
    specialState.compactCount(1000000),
    "1M"
  );
  check(
    "compteur de lien : arrondi de bord passe au million",
    specialState.compactCount(999999),
    "1M"
  );

  ok(
    "compteur de lien : valide a l'enregistrement (editeur)",
    /counter:normalizeLinkCounter\(link\.counter\)/.test(editorSrcForSpecial)
  );
  ok(
    "compteur de lien : conserve a l'enregistrement (serveur)",
    /counter:sanitizeLinkCounter\(link\.counter\)/.test(serverSrcForSpecial) &&
      /linkCounterService\(link\)/.test(serverSrcForSpecial)
  );

  // L'editeur reconstruit les categories et les hotes avant l'enregistrement.
  // Si ce nettoyage oublie le champ "color", la teinte disparait de
  // config.json a chaque sauvegarde et l'attribution par defaut remet tout a
  // la meme couleur — le symptome observe. Ce test lit le code de l'editeur et
  // echoue si le champ cesse d'y etre copie.
  const editorSrc = editorSrcForSpecial;
  ok(
    "couleur : l'editeur conserve la couleur a l'enregistrement",
    /color:sanitizeTileColor\(c\.color\)/.test(editorSrc) &&
      /color:sanitizeTileColor\(h\.color\)/.test(editorSrc),
    "champs color absents du nettoyage avant sauvegarde"
  );

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
