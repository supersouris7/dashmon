"use strict";
// Widget tests: Ping and Uptime Kuma widgets: URL reading, tile state, one line per status page.
// Shared helpers and fixtures: test/widgets/helpers.js.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { WIDGETS, check, run } = require("./widgets/helpers");

async function main() {
  // --- Widget Ping : lecture de l'URL et etat de la tuile -----------------
  // Aucun acces reseau : parseTarget est une fonction pure, et check() n'est
  // exerce que sur des entrees qui echouent avant toute connexion (pas d'hote,
  // nom introuvable).
  const ping = require("../widgets/ping/server.js");
  const pingModule = await import(pathToFileURL(path.join(WIDGETS, "ping", "client.mjs")).href);

  check(
    "ping : URL avec scheme, port par defaut du scheme",
    ping.parseTarget("https://routeur.exemple.lan"),
    { host: "routeur.exemple.lan", port: 443 }
  );
  check("ping : port explicite conserve", ping.parseTarget("http://nas.exemple.lan:8080"), {
    host: "nas.exemple.lan",
    port: 8080
  });
  check("ping : adresse IP nue, port 80 par defaut", ping.parseTarget("192.0.2.10"), {
    host: "192.0.2.10",
    port: 80
  });
  check("ping : chemin et query ignores", ping.parseTarget("http://exemple.lan:8443/soute?a=1#b"), {
    host: "exemple.lan",
    port: 8443
  });
  check("ping : IPv6 entre crochets", ping.parseTarget("http://[2001:db8::1]:9000"), {
    host: "2001:db8::1",
    port: 9000
  });
  check("ping : IPv6 sans port, 80 par defaut", ping.parseTarget("[2001:db8::1]"), {
    host: "2001:db8::1",
    port: 80
  });
  check("ping : adresse invalide refusee", ping.parseTarget("http://"), null);
  check("ping : cible vide refusee", ping.parseTarget("   "), null);

  // Le champ "port" de l'editeur prime sur le port ecrit dans l'hote.
  check("ping : le champ port prime sur l'hote", ping.parseTarget("nas.exemple.lan:8080", 443), {
    host: "nas.exemple.lan",
    port: 443
  });
  check(
    "ping : champ port seul, port par defaut conserve",
    ping.parseTarget("nas.exemple.lan", 8443),
    { host: "nas.exemple.lan", port: 8443 }
  );
  check(
    "ping : champ port a zero = defaut du scheme",
    ping.parseTarget("https://routeur.exemple.lan", 0),
    { host: "routeur.exemple.lan", port: 443 }
  );
  check("ping : champ port hors bornes ignore", ping.parseTarget("nas.exemple.lan", 70000), {
    host: "nas.exemple.lan",
    port: 80
  });

  const pingCtx = (host, url, port) => ({
    config: { type: "ping", host, port: port == null ? 0 : port },
    service: url == null ? { name: "cible" } : { name: "cible", url },
    sanitizeUrl: value => value,
    t: key => key
  });

  // Le champ "host" prime sur l'URL : c'est lui que l'utilisateur choisit.
  const noHost = await ping.check(pingCtx("", ""));
  check(
    "ping : ni host ni URL = down",
    [noHost.state, noHost.ok, noHost.error],
    ["down", false, "missingHost"]
  );

  const noHostNoUrl = await ping.check(pingCtx("", null));
  check(
    "ping : carte sans URL = down",
    [noHostNoUrl.state, noHostNoUrl.error],
    ["down", "missingHost"]
  );

  // Sans champ host, l'URL du service sert de repli.
  const badName = await ping.check(pingCtx("", "http://hote-inexistant.exemple.lan"));
  check(
    "ping : nom introuvable = down",
    [badName.state, badName.ok, badName.error],
    ["down", false, "unresolved (hote-inexistant.exemple.lan)"]
  );

  const badHost = await ping.check(
    pingCtx("hote-inexistant.exemple.lan", "http://autre.exemple.lan")
  );
  check(
    "ping : le champ host prime sur l'URL",
    [badHost.state, badHost.error],
    ["down", "unresolved (hote-inexistant.exemple.lan)"]
  );

  const blockedPing = await ping.check(pingCtx("169.254.169.254:80", null));
  check(
    "ping : link-local refusee avant connexion",
    [blockedPing.state, blockedPing.error],
    ["down", "blockedAddress (169.254.169.254)"]
  );

  // Un port ferme doit nommer le port essaye : c'est le seul moyen pour
  // l'utilisateur de comprendre qu'un hote saisi sans port a ete teste en 80.
  const closedPort = await ping.check(pingCtx("127.0.0.1:1", null));
  check(
    "ping : port ferme nomme dans l'erreur",
    [closedPort.state, closedPort.error],
    ["down", "noAnswer (127.0.0.1:1)"]
  );

  // Le renderer renvoie un noeud DOM : on verifie ici son contrat et la
  // correspondance etat -> glyphe, le DOM lui-meme n'etant pas disponible dans
  // ces tests sans navigateur.
  check("ping : le client expose un rendu sur mesure", typeof pingModule.element, "function");
  check("ping : glyphe up", pingModule.statusIcon("up"), "fa-solid fa-circle-check");
  check("ping : glyphe down", pingModule.statusIcon("down"), "fa-solid fa-circle-xmark");
  check("ping : glyphe pending", pingModule.statusIcon("pending"), "fa-regular fa-circle");

  // --- Widget Uptime Kuma : une ligne par page de statut --------------------
  // Aucun acces reseau : check() est exerce sur un faux client qui repond comme
  // le ferait la page de statut d'Uptime Kuma.
  const kuma = require("../widgets/uptimekuma/server.js");

  // sanitizeUrl exige un schema : une adresse nue doit etre completee, sinon le
  // widget s'annonçait "adresse manquante" alors que le champ etait rempli.
  check(
    "kuma : adresse nue completee en https",
    kuma.normalizeBase("kuma.exemple.lan"),
    "https://kuma.exemple.lan"
  );
  check(
    "kuma : sans schema, https puis http sont essayes",
    kuma.candidateBases("kuma.exemple.lan"),
    ["https://kuma.exemple.lan", "http://kuma.exemple.lan"]
  );
  check("kuma : schema explicite = un seul essai", kuma.candidateBases("http://kuma.exemple.lan"), [
    "http://kuma.exemple.lan"
  ]);
  check("kuma : adresse vide", kuma.normalizeBase("  "), "");

  check(
    "kuma : dernier heartbeat garde",
    kuma.latest([
      { status: 1, time: "2026-01-01 10:00:00" },
      { status: 0, time: "2026-01-01 12:00:00" }
    ]).status,
    0
  );
  check(
    "kuma : ordre inverse tolerated",
    kuma.latest([
      { status: 0, time: "2026-01-01 12:00:00" },
      { status: 1, time: "2026-01-01 10:00:00" }
    ]).status,
    0
  );
  check("kuma : serie vide", kuma.latest([]), null);

  // Le nom affiche vient du titre de la page de statut, pas du slug.
  check(
    "kuma : le titre de la page est prefere au slug",
    kuma.titleOf({ config: { title: "Mes services" } }, "services"),
    "Mes services"
  );
  check("kuma : sans titre, on garde le slug", kuma.titleOf({}, "services"), "services");

  // Deux moniteurs en ligne, un hors ligne, un en maintenance.
  const beatsOf = statuses => {
    const out = {};
    Object.keys(statuses).forEach((id, index) => {
      out[id] = [{ status: statuses[id], time: "2026-01-01 10:0" + index + ":00" }];
    });
    return { heartbeatList: out };
  };
  const pageOf = monitors => ({
    config: { title: "Mes services" },
    publicGroupList: [{ monitorList: monitors }]
  });
  const goodPage = pageOf([
    { id: 10, name: "Site" },
    { id: 11, name: "NAS" }
  ]);

  // Le faux client repond du slug demande : c'est ce qui permet de tester deux
  // pages differentes sur la meme instance.
  const kumaCtx = (config, responder) => ({
    config: Object.assign({ type: "uptimekuma", url: "https://kuma.exemple.lan" }, config),
    service: { name: "kuma" },
    sanitizeUrl: value => (/^https?:\/\//.test(value) ? value : ""),
    t: key => key,
    api: async (_base, path) => responder(path)
  });

  const responder = pages => path => {
    const isHeartbeat = path.startsWith("/api/status-page/heartbeat/");
    const slug = decodeURIComponent(
      isHeartbeat
        ? path.slice("/api/status-page/heartbeat/".length)
        : path.slice("/api/status-page/".length)
    );
    const entry = pages[slug];
    if (!entry) {
      const notFound = new Error("Status Page Not Found");
      notFound.status = 404;
      throw notFound;
    }
    if (entry instanceof Error) throw entry;
    // L'API sert deux contenus distincts : la page d'un cote, les etats de
    // l'autre. Renvoyer la page pour les deux ferait croire a zero etat.
    return isHeartbeat ? entry.beats : entry.page;
  };

  const onePage = await kuma.check(
    kumaCtx(
      { slug1: "services" },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 1 }) }
      })
    )
  );
  check("kuma : une page configuree = une ligne", [onePage.ok, onePage.pages.length], [true, 1]);
  check(
    "kuma : tout en ligne = vert",
    [onePage.pages[0].name, onePage.pages[0].up, onePage.pages[0].healthy],
    ["Mes services", 2, true]
  );

  const oneDown = await kuma.check(
    kumaCtx(
      { slug1: "services" },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 0 }) }
      })
    )
  );
  check(
    "kuma : un seul moniteur hors ligne fait rouge la page",
    [oneDown.ok, oneDown.pages[0].up, oneDown.pages[0].down, oneDown.pages[0].healthy],
    [false, 1, 1, false]
  );
  check("kuma : le nom du moniteur hors ligne est conserve", oneDown.pages[0].downNames, ["NAS"]);

  // La maintenance n'est pas une panne : la page reste verte.
  const maintenance = await kuma.check(
    kumaCtx(
      { slug1: "services" },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 3 }) }
      })
    )
  );
  check(
    "kuma : une maintenance ne fait pas rougir la page",
    [maintenance.ok, maintenance.pages[0].up, maintenance.pages[0].healthy],
    [true, 1, true]
  );

  // Deux pages : une ligne chacune, et la tuile suit le pire etat.
  const twoPages = await kuma.check(
    kumaCtx(
      { slug1: "services", slug2: "infra" },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 1 }) },
        infra: {
          page: {
            config: { title: "Infrastructure" },
            publicGroupList: [{ monitorList: [{ id: 20, name: "Routeur" }] }]
          },
          beats: beatsOf({ 20: 0 })
        }
      })
    )
  );
  check("kuma : deux pages = deux lignes", twoPages.pages.length, 2);
  check(
    "kuma : les deux noms de page sont affiches",
    twoPages.pages.map(page => page.name),
    ["Mes services", "Infrastructure"]
  );
  check(
    "kuma : la tuile entiere rouge des qu'une page l'est",
    [twoPages.pages[0].healthy, twoPages.pages[1].healthy, twoPages.ok],
    [true, false, false]
  );

  // Une page absente ne doit pas empecher l'autre de s'afficher.
  const oneMissing = await kuma.check(
    kumaCtx(
      { slug1: "services", slug2: "absente" },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 1 }) }
      })
    )
  );
  check(
    "kuma : une page introuvable n'efface pas l'autre",
    [oneMissing.pages.length, oneMissing.pages[0].healthy],
    [2, true]
  );
  check(
    "kuma : slug inconnu signale sans code superflu",
    oneMissing.pages[1].error,
    "badSlug (Status Page Not Found)"
  );

  const emptyPage = await kuma.check(
    kumaCtx(
      { slug1: "vide" },
      responder({
        vide: {
          page: { config: { title: "Vide" }, publicGroupList: [] },
          beats: { heartbeatList: {} }
        }
      })
    )
  );
  check(
    "kuma : page repondante mais vide = aucun moniteur public",
    emptyPage.pages[0].error,
    "noMonitors"
  );

  const down = await kuma.check(
    kumaCtx(
      { slug1: "services" },
      responder({
        services: new Error("timeout")
      })
    )
  );
  check(
    "kuma : panne reseau, pas un mauvais slug",
    [down.pages[0].error, down.pages[0].healthy],
    ["unreachable (timeout)", false]
  );

  const noConfig = await kuma.check(kumaCtx({}, responder({})));
  check(
    "kuma : config incomplete signalee",
    [noConfig.ok, noConfig.pages.length, noConfig.error],
    [false, 0, "missingConfig"]
  );

  const noSecond = await kuma.check(
    kumaCtx(
      { slug1: "services", slug2: "  " },
      responder({
        services: { page: goodPage, beats: beatsOf({ 10: 1, 11: 1 }) }
      })
    )
  );
  check("kuma : une seconde page vide est ignoree", noSecond.pages.length, 1);

  // Sans schema, le widget tente https puis http. Il faut remplacer "api" pour
  // voir l'adresse : kumaCtx appelle sinon son responder avec le seul chemin.
  const tried = [];
  const good = { page: goodPage, beats: beatsOf({ 10: 1, 11: 1 }) };
  const schemeFallback = await kuma.check(
    Object.assign(
      kumaCtx({ slug1: "services", url: "kuma.exemple.lan" }, path =>
        responder({ services: good })(path)
      ),
      {
        api: async (base, path) => {
          tried.push(base);
          if (base.startsWith("https:")) throw new Error("ECONNREFUSED");
          return responder({ services: good })(path);
        }
      }
    )
  );
  check(
    "kuma : repli https -> http si le premier echoue",
    [schemeFallback.ok, schemeFallback.pages[0].healthy],
    [true, true]
  );
  // Chaque adresse declenche deux appels (page + heartbeat) : on verifie les
  // adresses distinctes rencontrees, pas le nombre d'appels.
  const distinct = [...new Set(tried)];
  check(
    "kuma : les deux schemas ont bien ete essayes",
    distinct.length === 2 &&
      distinct.some(b => b.startsWith("https:")) &&
      distinct.some(b => b.startsWith("http:")),
    true
  );

  // Le renderer : deux lignes, une couleur par page.
  const kumaModule = await import(
    pathToFileURL(path.join(WIDGETS, "uptimekuma", "client.mjs")).href
  );
  check("kuma : le client expose un rendu sur mesure", typeof kumaModule.element, "function");
  check("kuma : page verte", kumaModule.pageColor(true), "var(--success)");
  check("kuma : page rouge", kumaModule.pageColor(false), "var(--error)");

  // Une page illisible ne doit pas s'afficher "0 en ligne" : Number(null)
  // vaut 0, qui est fini, le test d'etat doit donc exclure null explicitement.
  check("kuma : page illisible = tiret, pas 0", kumaModule.countText(null, "up"), "—");
  check("kuma : page en lecture = tiret", kumaModule.countText(undefined, "up"), "—");
  check("kuma : compte normal", kumaModule.countText(12, "up"), "12 up");
  check("kuma : zero reste zero", kumaModule.countText(0, "up"), "0 up");

  // "up" n'est pas traduit, dans aucune langue : le manifeste ne doit donc pas
  // declarer de chaine "up", sinon elle serait traduite en "en ligne" et la
  // tuile doublerait de largeur.
  const kumaManifest = JSON.parse(
    fs.readFileSync(path.join(WIDGETS, "uptimekuma", "manifest.json"), "utf8")
  );
  check(
    "kuma : aucune chaine traduite pour le mot up",
    ["fr", "en"].every(
      lang => !Object.prototype.hasOwnProperty.call(kumaManifest.strings[lang], "up")
    ),
    true
  );
}

run(main);
