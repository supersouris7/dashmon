"use strict";
// Widget tests: Link widgets (YouTube, Docker Hub, GitHub) and the service widgets with a fake HTTP client.
// Shared helpers and fixtures: test/widgets/helpers.js.

const path = require("path");
const { WIDGETS, check, ok, run } = require("./widgets/helpers");

async function main() {
  // --- Widgets de liens : YouTube, Docker Hub, GitHub ---------------------
  // Ces trois widgets lisent une API tierce : on leur fournit un faux client,
  // jamais le reseau.
  const httpError = status => {
    const error = new Error("HTTP " + status);
    error.status = status;
    return error;
  };
  const linkCtx = over =>
    Object.assign(
      {
        config: {},
        service: { url: "https://exemple.test/", monitor: true },
        state: {},
        sanitizeUrl: v => String(v == null ? "" : v).trim(),
        t: k => k,
        api: async () => ({})
      },
      over || {}
    );

  // YouTube -----------------------------------------------------------------
  const youtubeServer = require(path.join(WIDGETS, "youtube", "server.js"));
  const youtubeParse = require(path.join(WIDGETS, "youtube", "parse.js"));
  check(
    "youtube : identifiant accepte sous ses trois formes",
    ["exemple", "@exemple", "youtube.com/@exemple"].map(u => youtubeParse.normalizeInput(u)),
    ["@exemple", "@exemple", "@exemple"]
  );
  check("youtube : identifiant vide refuse", youtubeParse.normalizeInput("   "), null);
  check(
    "youtube : adresse d'une video refusee",
    youtubeParse.normalizeInput("https://www.youtube.com/watch?v=abc"),
    null
  );
  check(
    "youtube : identifiant de chaine conserve",
    youtubeParse.normalizeInput("UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "UC_x5XG1OV2P6uZZ5FSM9Ttw"
  );
  check("youtube : chemin de chaine construit", youtubeParse.channelPath("@exemple"), "/@exemple");
  check(
    "youtube : ancienne URL /c/ supportee",
    youtubeParse.channelPath("https://www.youtube.com/c/exemple"),
    "/c/exemple"
  );
  check(
    "youtube : chemin d'un identifiant de chaine",
    youtubeParse.channelPath("UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"
  );
  // Les deux ecritures rencontrees dans la page : "3,45 M" (fr) et "3.45K" (en).
  check(
    "youtube : nombres compacts lus",
    ["3,45 M", "1,2 M", "3.45K", "3 450", "1 234", "12,3K", "8,62 k", "1.2B"].map(
      youtubeParse.parseNumber
    ),
    [3450000, 1200000, 3450, 3450, 1234, 12300, 8620, 1200000000]
  );
  check("youtube : texte sans nombre", youtubeParse.parseNumber("abonnés"), null);
  check("youtube : page sans la cle", youtubeParse.parseSubscribers("vanilla JS"), null);
  check(
    "youtube : la cle interne suffit, quelle que soit la langue",
    youtubeParse.parseSubscribers('"subscriberCountText":{"simpleText":"3 450 abonnés"}'),
    3450
  );
  check(
    "youtube : compteur en anglais lu aussi",
    youtubeParse.parseSubscribers('"subscriberCountText":{"simpleText":"3.45M subscribers"}'),
    3450000
  );
  // Une chaine privee ou supprimee repond sans compteur : le widget le dit.
  const privateChannel = await youtubeServer.check(
    linkCtx({
      config: { username: "@prive" },
      api: async () => ({ status: 200, body: "<html>ytInitialData</html>" })
    })
  );
  check(
    "youtube : page sans donnees = lien vivant, compteur inconnu",
    [privateChannel.state, privateChannel.ok, privateChannel.subscribers],
    ["up", false, null]
  );
  const okChannel = await youtubeServer.check(
    linkCtx({
      config: { username: "@exemple" },
      api: async () => ({
        status: 200,
        body: '"subscriberCountText":{"simpleText":"3 450 abonnés"}'
      })
    })
  );
  check(
    "youtube : abonnements lus",
    [okChannel.state, okChannel.ok, okChannel.subscribers],
    ["up", true, 3450]
  );
  const noRepo = await youtubeServer.check(linkCtx({ config: {} }));
  check(
    "youtube : identifiant manquant = tuile rouge",
    [noRepo.state, noRepo.ok, noRepo.subscribers],
    ["down", false, null]
  );
  // Une adresse qui n'est pas une chaine ne doit pas partir sur /about.
  const notAChannel = await youtubeServer.check(
    linkCtx({
      config: { username: "https://www.youtube.com/watch?v=abc" },
      api: async () => {
        throw new Error("la page ne devrait pas etre demandee");
      }
    })
  );
  check("youtube : adresse de video refusee avant tout appel", notAChannel.state, "down");
  const youTubeDown = await youtubeServer.check(
    linkCtx({
      config: { username: "@exemple" },
      api: async () => {
        throw httpError(503);
      }
    })
  );
  check(
    "youtube : lien en panne = tuile rouge",
    [youTubeDown.state, youTubeDown.ok],
    ["down", false]
  );
  const youTubeBridged = await youtubeServer.check(
    linkCtx({
      config: { username: "@exemple" },
      api: async () => {
        throw httpError(429);
      }
    })
  );
  check(
    "youtube : requete bridée = lien vivant, compteur inconnu",
    [youTubeBridged.state, youTubeBridged.ok, youTubeBridged.throttled],
    ["up", false, true]
  );
  const consent = await youtubeServer.check(
    linkCtx({
      config: { username: "@exemple" },
      api: async () => ({
        status: 200,
        body: '<form action="https://consent.youtube.com/s"><input id="consentButton"></form>'
      })
    })
  );
  check(
    "youtube : page de consentement = lien vivant, compteur inconnu",
    [consent.state, consent.ok, consent.throttled],
    ["up", false, true]
  );
  const tooBig = await youtubeServer.check(
    linkCtx({
      config: { username: "@exemple" },
      api: async () => {
        throw new Error("Réponse trop volumineuse");
      }
    })
  );
  check(
    "youtube : page trop grosse = lien vivant, compteur inconnu",
    [tooBig.state, tooBig.ok, tooBig.error],
    ["up", false, "tooBig"]
  );

  // Docker Hub --------------------------------------------------------------
  const dockerHubServer = require(path.join(WIDGETS, "dockerhub", "server.js"));
  check("dockerhub : depot officiel complete", dockerHubServer.repoPath("nginx"), "library/nginx");
  check(
    "dockerhub : depot de l'utilisateur tel quel",
    dockerHubServer.repoPath("exemple-org/exemple-repo"),
    "exemple-org/exemple-repo"
  );
  check("dockerhub : depot vide", dockerHubServer.repoPath("  "), "");
  const pulls = await dockerHubServer.check(
    linkCtx({
      config: { repo: "library/nginx" },
      api: async (base, path) => {
        check(
          "dockerhub : URL d'API construite",
          base + path,
          "https://hub.docker.com/v2/repositories/library/nginx/"
        );
        return { pull_count: 12000000000, star_count: 20000, last_updated: "2026-09-01T10:00:00Z" };
      }
    })
  );
  check(
    "dockerhub : pulls lus",
    [pulls.state, pulls.ok, pulls.pulls, pulls.stars],
    ["up", true, 12000000000, 20000]
  );
  const hubMissing = await dockerHubServer.check(linkCtx({ config: {} }));
  check(
    "dockerhub : depot manquant = tuile rouge",
    [hubMissing.state, hubMissing.ok],
    ["down", false]
  );
  check("dockerhub : nom de depot refuse", dockerHubServer.isValidRepo("pas un depot"), false);
  const hubThrottled = await dockerHubServer.check(
    linkCtx({
      config: { repo: "nginx" },
      api: async () => {
        throw httpError(429);
      }
    })
  );
  check(
    "dockerhub : API throttle = lien vivant, compteur inconnu",
    [hubThrottled.state, hubThrottled.ok, hubThrottled.throttled],
    ["up", false, true]
  );
  const hubGone = await dockerHubServer.check(
    linkCtx({
      config: { repo: "nginx" },
      api: async () => {
        throw httpError(404);
      }
    })
  );
  check(
    "dockerhub : depot introuvable = tuile rouge",
    [hubGone.state, hubGone.ok],
    ["down", false]
  );

  // qBittorrent -------------------------------------------------------------
  const qBittorrentServer = require(path.join(WIDGETS, "qbittorrent", "server.js"));
  check(
    "qbittorrent : cookie de session lu",
    qBittorrentServer.cookieOf({ headers: { "set-cookie": ["SID=abc; HttpOnly"] } }),
    "SID=abc"
  );
  check("qbittorrent : valeur negative ramenee a zero", qBittorrentServer.numberOf(-1), 0);
  const qBittorrentCalls = [];
  const qBittorrent = await qBittorrentServer.check(
    linkCtx({
      config: { username: "admin", password: "motdepasse" },
      state: qBittorrentServer.createState(),
      api: async (base, requestPath, options) => {
        qBittorrentCalls.push([
          base + requestPath,
          options && options.headers && options.headers.Cookie
        ]);
        if (requestPath === "/api/v2/auth/login")
          return { headers: { "set-cookie": ["SID=abc; HttpOnly"] } };
        return {
          connection_status: "connected",
          dl_info_speed: 1234567,
          up_info_speed: 4567,
          dl_info_data: 9876543,
          up_info_data: 7654321
        };
      }
    })
  );
  check(
    "qbittorrent : authentification puis vitesses lues",
    [qBittorrent.ok, qBittorrent.downloadSpeed, qBittorrent.uploadSpeed, qBittorrentCalls],
    [
      true,
      1234567,
      4567,
      [
        ["https://exemple.test/api/v2/auth/login", undefined],
        ["https://exemple.test/api/v2/transfer/info", "SID=abc"]
      ]
    ]
  );
  const qBittorrentMissing = await qBittorrentServer.check(
    linkCtx({
      config: {},
      state: qBittorrentServer.createState()
    })
  );
  check(
    "qbittorrent : identifiants manquants",
    [qBittorrentMissing.ok, qBittorrentMissing.error],
    [false, "Identifiants qBittorrent manquants"]
  );

  // MeTube ------------------------------------------------------------------
  const metubeServer = require(path.join(WIDGETS, "metube", "server.js"));
  check(
    "metube : file resumee",
    metubeServer.summarize({ queue: [{}, {}], pending: [{}], done: [{}, {}, {}] }),
    { active: 2, queued: 1, completed: 3 }
  );
  const metube = await metubeServer.check(
    linkCtx({
      api: async (base, requestPath) => {
        check("metube : URL d'historique", base + requestPath, "https://exemple.test/history");
        return { queue: [{}], pending: [{}, {}], done: [] };
      }
    })
  );
  check(
    "metube : activite lue",
    [metube.ok, metube.active, metube.queued, metube.completed],
    [true, 1, 2, 0]
  );

  // Gotify ------------------------------------------------------------------
  const gotifyServer = require(path.join(WIDGETS, "gotify", "server.js"));
  check(
    "gotify : dernier message normalise",
    gotifyServer.latestMessage(
      {
        messages: [
          { title: "Sauvegarde", message: "Terminée", priority: 5, date: "2026-10-25T12:00:00Z" }
        ]
      },
      value => String(value).slice(0, 200)
    ),
    { title: "Sauvegarde", message: "Terminée", priority: 5, receivedAt: 1792929600000 }
  );
  const gotify = await gotifyServer.check(
    linkCtx({
      config: { token: "jeton" },
      api: async (base, requestPath, options) => {
        check(
          "gotify : dernier message demande",
          [base + requestPath, options.headers["X-Gotify-Key"]],
          ["https://exemple.test/message?limit=1", "jeton"]
        );
        return { messages: [] };
      }
    })
  );
  check("gotify : aucune notification toleree", [gotify.ok, gotify.latest], [true, null]);

  // GitHub ------------------------------------------------------------------
  const githubServer = require(path.join(WIDGETS, "github", "server.js"));
  check(
    "github : depot valide",
    [githubServer.isValidRepo("exemple-org/exemple-repo"), githubServer.isValidRepo("a/")],
    [true, false]
  );
  const ghStars = await githubServer.check(
    linkCtx({
      config: { repo: "exemple-org/exemple-repo", metric: "stars" },
      api: async (base, path, options) => {
        check(
          "github : URL d'API construite",
          base + path,
          "https://api.github.com/repos/exemple-org/exemple-repo"
        );
        ok("github : entete Accept v3", options.headers.Accept === "application/vnd.github+json");
        return {
          stargazers_count: 302,
          forks_count: 21,
          open_issues_count: 4,
          subscribers_count: 17,
          license: { spdx_id: "MIT" },
          pushed_at: "2026-09-20T08:00:00Z"
        };
      }
    })
  );
  check(
    "github : etoiles par defaut",
    [ghStars.state, ghStars.ok, ghStars.metric, ghStars.value],
    ["up", true, "stars", 302]
  );
  check("github : autres compteurs mis en cache", [ghStars.forks, ghStars.openIssues], [21, 4]);
  const ghForks = await githubServer.check(
    linkCtx({
      config: { repo: "exemple-org/exemple-repo", metric: "forks" },
      api: async () => ({ stargazers_count: 302, forks_count: 21 })
    })
  );
  check("github : forks demandes", [ghForks.metric, ghForks.value], ["forks", 21]);
  const ghUnknownMetric = await githubServer.check(
    linkCtx({
      config: { repo: "exemple-org/exemple-repo", metric: "commits" },
      api: async () => ({ stargazers_count: 302 })
    })
  );
  check(
    "github : statistique hors options -> etoiles",
    [ghUnknownMetric.metric, ghUnknownMetric.value],
    ["stars", 302]
  );
  const ghThrottled = await githubServer.check(
    linkCtx({
      config: { repo: "a/b" },
      api: async () => {
        throw httpError(403);
      }
    })
  );
  check(
    "github : API throttle = lien vivant, compteur inconnu",
    [ghThrottled.state, ghThrottled.ok, ghThrottled.throttled],
    ["up", false, true]
  );
  const ghNoRepo = await githubServer.check(linkCtx({ config: { repo: "" } }));
  check("github : depot manquant = tuile rouge", [ghNoRepo.state, ghNoRepo.ok], ["down", false]);
}

run(main);
