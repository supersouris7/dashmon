// Taille du pool libuv définie avant tout usage async (DNS/fs). 16 threads
// étaient surdimensionnés : la majorité des requêtes attendent sur du réseau
// sortant (pas de blocage du pool). 4 suffisent et réduisent le delta libuv.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "4";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const httpClient = require("./lib/http");
const { WidgetCore } = require("./lib/widget-core");
const { ConfigStore } = require("./lib/config-store");
const agentProtocol = require("./lib/agent-protocol");
const { createAuth } = require("./lib/auth");
const { createScheduler } = require("./lib/scheduler");
const { securityHeaders } = require("./lib/security-headers");
const { verifyRequestOrigin } = require("./lib/request-origin");
const { createRateLimiter } = require("./lib/rate-limit");
const { createReplicationConfig } = require("./lib/replication-config");
const { createLocalMetrics } = require("./lib/local-metrics");
const { sanitizeText, sanitizeUrl } = require("./lib/sanitize");
const { createSecretCodec } = require("./lib/secrets");
const { readAptUpdatesReport } = require("./lib/apt-report");
const { readSmartDump } = require("./lib/smart-report");
const { readWireguardDump } = require("./lib/wireguard-report");
const { registerConfigRoutes } = require("./lib/config-routes");
const { registerAgentRoutes } = require("./lib/agent-routes");
const { HOST_MONITORING_TYPES, sanitizeHostMonitoring } = require("./lib/config-fields");
const { createConfigNormalizer } = require("./lib/config-normalize");

function createApp() {
  const app = express();

  function ts() {
    return new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "");
  }

  // Derrière un reverse proxy unique (nginx) : TRUST_PROXY=1 pour que req.ip,
  // req.secure et le rate limiter utilisent l'adresse réelle du client.
  const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;
  if (TRUST_PROXY > 0) app.set("trust proxy", TRUST_PROXY);

  const PORT = Number(process.env.PORT) || 8080;
  const ROOT = __dirname;
  const PUBLIC_DIR = path.join(ROOT, "public");
  const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
  const CONFIG_FILE = process.env.CONFIG_FILE || path.join(DATA_DIR, "config.json");
  const configStore = new ConfigStore(CONFIG_FILE);
  // Sortie de `wg show all dump` deja ecrite sur disque pour un hote "local".
  // Chemin fixe (surchargeable par l'administrateur) : la configuration web ne
  // peut donc pas faire lire un fichier arbitraire au serveur.
  const WIREGUARD_DUMP_FILE =
    process.env.WIREGUARD_DUMP_FILE || path.join(DATA_DIR, "wireguard.dump");
  // Sortie JSON de `smartctl -j -a`, ecrite par deploy/smart-dump.sh pour les
  // disques de l'hote local. Comme pour WireGuard, le chemin n'est jamais choisi
  // depuis l'interface web.
  const SMART_DUMP_FILE = process.env.SMART_DUMP_FILE || path.join(DATA_DIR, "smart.json");
  const APT_UPDATES_REPORT_FILE =
    process.env.APT_UPDATES_REPORT_FILE || path.join(DATA_DIR, "apt-updates.json");
  const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");
  const ICONS_DIR = process.env.ICONS_DIR || path.join(DATA_DIR, "icons");
  const THEMES_NATIVE_DIR = process.env.THEMES_NATIVE_DIR || path.join(PUBLIC_DIR, "themes");
  const THEMES_CUSTOM_DIR = process.env.THEMES_CUSTOM_DIR || path.join(DATA_DIR, "themes");
  const LOGIN_FILE = path.join(PUBLIC_DIR, "login.html");

  // Version de release affichee dans le pied de page. Elle suit le tag plutot que
  // le champ "version" du paquet, qui reste fige entre deux releases : sur une
  // image construite depuis un tag v*, la CI passe DASHMON_RELEASE et le pied de
  // page annonce la version publiee.
  //
  // Un build depuis main — l'image "unstable", celle de la preprod — ne peut pas
  // pretendre etre une release, et afficher le numero du paquet serait doublement
  // trompeur : fige a 1.0.0 entre deux releases, il laisserait croire que
  // l'image tourne a jour alors qu'elle avance a chaque push. On affiche donc
  // "unstable", et c'est le commit affiche a cote qui change a chaque build.
  const RELEASE = (process.env.DASHMON_RELEASE || "").trim();
  const APP_VERSION = /^v?\d+(\.\d+){0,2}([-.][0-9A-Za-z.-]+)?$/.test(RELEASE)
    ? RELEASE.startsWith("v")
      ? RELEASE
      : "v" + RELEASE
    : "unstable";
  // SHA du commit qui a produit l'image (Dockerfile : ARG DASHMON_COMMIT, alimentee
  // par la CI). Il est affiche a cote du numero de version pour verifier d'un coup
  // d'oeil quelle version tourne apres un "docker pull".
  // La valeur vient de l'environnement : elle est validee avant d'atteindre le
  // HTML, et un SHA absent ou inattendu ("unknown" par defaut) fait disparaitre
  // le suffixe plutot que d'afficher un marqueur trompeur.
  const APP_COMMIT = (process.env.DASHMON_COMMIT || "").trim();
  const APP_COMMIT_SHORT = /^[0-9a-f]{7,40}$/.test(APP_COMMIT) ? APP_COMMIT.slice(0, 7) : "";
  // Le SHA vient de l'IMAGE. Si /app est monte depuis l'hote, le code execute
  // n'est pas celui de l'image : afficher ce SHA decrit donc un depot qui n'est
  // pas celui-la. Dans ce cas on ne montre que la version plutot qu'une etiquette
  // fausse — c'etait exactement ce qui se passait, avec un commit centenaire
  // alors que le code etait a jour.
  const APP_CODE_MOUNTED = appIsMounted();
  const APP_LABEL =
    APP_COMMIT_SHORT && !APP_CODE_MOUNTED ? APP_VERSION + " · " + APP_COMMIT_SHORT : APP_VERSION;
  // Instant de demarrage : sert a distinguer "l'image est ancienne" de "le
  // conteneur tourne depuis le dernier redemarrage sans avoir ete recree".
  const STARTED_AT = new Date().toISOString();
  // Intervalle de rafraichissement des mesures d'hotes, en secondes. Le client
  // lit la valeur injectee dans le HTML ; le serveur s'en sert aussi comme duree
  // de cache pour mutualiser les requetes. 60 s par defaut : la page supervision
  // n'a pas besoin de plus fin, et cela menage les hotes modestes (Raspberry Pi).
  const HOST_METRICS_INTERVAL = (() => {
    const value = Number(process.env.HOST_METRICS_INTERVAL);
    if (!Number.isFinite(value) || value < 5) return 60000;
    return Math.min(value, 3600) * 1000;
  })();
  const INDEX_HTML = fs
    .readFileSync(INDEX_FILE, "utf8")
    .replace(/\{\{VERSION\}\}/g, APP_LABEL)
    .replace(/\{\{HOST_METRICS_INTERVAL\}\}/g, String(HOST_METRICS_INTERVAL));

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb", strict: true }));

  const pngBody = express.raw({
    type: "image/png",
    limit: "10mb"
  });

  const INSECURE_TLS = process.env.DASHBOARD_INSECURE_TLS === "1";
  const DASHMON_PASSWORD = process.env.DASHMON_PASSWORD || "";
  // Secret partage exclusivement entre instances couplees. Il ne transite jamais
  // dans config.json ni dans une reponse HTTP.
  const DASHMON_SYNC_TOKEN = String(process.env.DASHMON_SYNC_TOKEN || "");
  const AGENT_MODE = process.env.DASHMON_MODE === "agent";
  if (AGENT_MODE && (!DASHMON_PASSWORD || !DASHMON_SYNC_TOKEN)) {
    throw new Error("Le mode agent exige DASHMON_PASSWORD et DASHMON_SYNC_TOKEN");
  }
  const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  // Sans mot de passe, Dashmon ne doit pas devenir une interface d'administration
  // accessible au reseau. Dans Docker, l'ecoute doit rester disponible pour le
  // proxy et le port publie : un mot de passe y est donc obligatoire.
  const RUNNING_IN_DOCKER = fs.existsSync("/.dockerenv");
  if (RUNNING_IN_DOCKER && !DASHMON_PASSWORD) {
    throw new Error("DASHMON_PASSWORD est obligatoire dans Docker");
  }
  const DASHBOARD_BIND = DASHMON_PASSWORD ? "0.0.0.0" : "127.0.0.1";
  // Delai maximal d'une sonde de statut, partage par le core et les plugins.
  const STATUS_TIMEOUT = 4000;

  const { validSession, validBasicAuth, setSessionCookie } = createAuth({
    password: DASHMON_PASSWORD
  });

  app.use(securityHeaders);

  app.use(verifyRequestOrigin);

  const writesLimiter = createRateLimiter({
    windowMs: 60000,
    max: 60,
    skip: req => ["GET", "HEAD", "OPTIONS"].includes(req.method),
    retryAfter: true
  });
  const readsLimiter = createRateLimiter({ windowMs: 60000, max: 120 });
  const rateLimit = writesLimiter.middleware;
  const rateLimitGet = readsLimiter.middleware;
  setInterval(() => {
    writesLimiter.cleanup();
    readsLimiter.cleanup();
  }, 300000).unref();

  app.use("/api", rateLimit);

  app.use("/api/status", rateLimitGet);
  app.use("/api/sync/metrics", rateLimitGet);
  // Limite les demandes de mesures locales.
  app.use("/api/host-metrics", rateLimitGet);

  if (DASHMON_PASSWORD) {
    app.post("/login", rateLimit, (req, res) => {
      res.set("Cache-Control", "no-store");
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const expected = Buffer.from(DASHMON_PASSWORD);
      const received = Buffer.from(password);
      const ok = received.length === expected.length && crypto.timingSafeEqual(received, expected);
      if (!ok) return res.status(401).json({ error: "Authentification invalide" });
      setSessionCookie(req, res, Date.now() + SESSION_MAX_AGE);
      res.json({ ok: true });
    });

    app.post("/logout", rateLimit, (req, res) => {
      res.set("Cache-Control", "no-store");
      setSessionCookie(req, res, 0);
      res.json({ ok: true });
    });

    app.use("/api", (req, res, next) => {
      // Les deux routes de federation ont leur propre authentification par jeton
      // afin qu'une instance n'ait pas a connaitre le mot de passe web d'une autre.
      if (req.path.startsWith("/sync/")) return next();
      if (validSession(req) || validBasicAuth(req)) return next();
      res.status(401).json({ error: "Authentification requise" });
    });
  }

  // L'agent n'expose que sa configuration locale et ses mesures authentifiees.
  app.use("/api", (req, res, next) => {
    if (
      !AGENT_MODE ||
      req.path === "/sync/metrics" ||
      req.path === "/agent/config" ||
      req.path === "/agent/metrics"
    )
      return next();
    res.status(404).json({ error: "Route indisponible en mode agent" });
  });

  app.use((_req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      console.log(`${_req.method} ${_req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  // Secrets de widget chiffrés au repos : clé maîtresse en DASHMON_MASTER_KEY.
  // Sans clé, repli sur le stockage en clair (warning au démarrage) pour rester
  // utilisable sans configuration.
  const MASTER_KEY = String(process.env.DASHMON_MASTER_KEY || "");
  const { isEncryptedSecret, encryptSecret, decryptSecret } = createSecretCodec(MASTER_KEY);
  if (!MASTER_KEY) {
    console.warn(
      `${ts()} ⚠ DASHMON_MASTER_KEY absente : les mots de passe des widgets sont stockés EN CLAIR dans config.json.`
    );
  }

  // Le core widgets charge le registre, dispatche les checks, gere le cache, les
  // frequences, les secrets et la purge. Le core ne connait aucun widget nomme :
  // ajouter un widget n'oblige donc jamais a modifier ce fichier.
  const statusCache = {};
  const widgetCore = new WidgetCore({
    root: ROOT,
    dataDir: DATA_DIR,
    log: message => console.log(`${ts()} ${message}`),
    decryptSecret,
    encryptSecret,
    sanitizeText,
    sanitizeUrl,
    statusCache
  });
  httpClient.configure({ insecure: INSECURE_TLS, timeout: STATUS_TIMEOUT });

  function ensureDataFiles() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.mkdirSync(THEMES_CUSTOM_DIR, { recursive: true });
    fs.mkdirSync(THEMES_NATIVE_DIR, { recursive: true });

    if (!fs.existsSync(CONFIG_FILE)) {
      const bundled = path.join(ROOT, "config.json");
      if (fs.existsSync(bundled)) {
        fs.copyFileSync(bundled, CONFIG_FILE);
      } else {
        writeConfig({
          services: [],
          categories: [],
          dashboards: [{ id: "main", name: "Dashboard", icon: "fa-solid fa-grip" }],
          hosts: [],
          collapsed: {},
          viewMode: "columns",
          openMode: "same",
          groupMode: "category",
          theme: "dark",
          webLinks: [],
          smallIcons: false
        });
      }
    }
  }

  ensureDataFiles();

  function readConfig() {
    const config = configStore.read();
    // Les anciens reglages retires ne sont plus exposes ni recopies lors d'une
    // sauvegarde. Le fichier existant reste lisible sans migration destructive.
    for (const key of ["favicon", "faviconEnabled", "hostsDisplay", "webLinksCollapsed"]) {
      delete config[key];
    }
    return ensureLocalHost(config);
  }

  function ensureLocalHost(config) {
    config.hosts = Array.isArray(config.hosts) ? config.hosts : [];
    let local =
      config.hosts.find(
        host => host?.monitoring?.type === "local" && host.monitoring.enabled === true
      ) || config.hosts.find(host => host?.monitoring?.type === "local");
    if (!local) {
      const used = new Set(config.hosts.map(host => host?.id));
      let id = "dashmon-local";
      while (used.has(id)) id += "-local";
      local = {
        id,
        name: AGENT_MODE ? "Agent" : "Dashmon",
        icon: "fa-solid fa-server",
        monitoring: { type: "local" }
      };
      config.hosts.unshift(local);
    }
    for (const host of config.hosts) {
      if (host?.monitoring?.type === "local") host.monitoring.enabled = host === local;
    }
    return config;
  }

  // NOTE : aucun hôte d'exemple n'est injecté — la config est celle de
  // l'utilisateur (vide à la première installation), adaptable à tout environnement.

  const DEFAULT_WEB_LINKS = [
    { name: "YouTube", url: "https://www.youtube.com", icon: "fa-brands fa-youtube" },
    { name: "Outlook", url: "https://outlook.office.com", icon: "fa-solid fa-envelope" },
    { name: "Google Drive", url: "https://drive.google.com", icon: "fa-brands fa-google-drive" },
    { name: "GitHub", url: "https://github.com", icon: "fa-brands fa-github" }
  ];
  const WEB_LINKS_SEED_VERSION = 2;

  function ensureWebLinksSeeded() {
    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return;
    }

    const currentVersion = Number(config.webLinksSeedVersion || 0);

    if (currentVersion >= WEB_LINKS_SEED_VERSION) return;

    // Ne jamais ecraser une liste de liens existante : une liste vide (liens
    // supprimes volontairement) ou personnalisee doit etre respectee. On
    // n'ajoute les liens par defaut qu'a une installation qui n'a pas de champ.
    if (!Array.isArray(config.webLinks)) config.webLinks = DEFAULT_WEB_LINKS;
    config.webLinksSeedVersion = WEB_LINKS_SEED_VERSION;

    try {
      writeConfig(config);
    } catch (_error) {
      // Ne pas bloquer le démarrage si l'écriture de migration échoue.
    }
  }

  ensureWebLinksSeeded();

  // Identifiants stables des hôtes : le widget Docker référence host.id pour
  // survivre au renommage d'un serveur. Attribue un id aux hôtes qui n'en ont
  // pas (ex. configs antérieures) et garantit leur unicité.
  function ensureHostIds() {
    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return;
    }
    if (!Array.isArray(config.hosts)) return;

    let changed = false;
    const used = new Set();
    config.hosts.forEach(host => {
      const current = String((host && host.id) || "").trim();
      if (!current || current.length > 64 || used.has(current)) {
        host.id = "host-" + crypto.randomBytes(6).toString("hex");
        changed = true;
      }
      used.add(host.id);
    });
    if (changed) {
      try {
        writeConfig(config);
      } catch (_error) {}
    }
  }

  ensureHostIds();
  function agentIdentity() {
    const file = path.join(DATA_DIR, "agent-id");
    try {
      const existing = fs.readFileSync(file, "utf8").trim();
      if (/^[0-9a-f]{32}$/.test(existing)) return existing;
      throw new Error("Identité d'agent invalide");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const id = crypto.randomBytes(16).toString("hex");
      try {
        fs.writeFileSync(file, id + "\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
        return id;
      } catch (writeError) {
        if (writeError.code === "EEXIST") return agentIdentity();
        throw writeError;
      }
    }
  }
  const AGENT_ID = AGENT_MODE ? agentIdentity() : "";
  if (AGENT_MODE) {
    const config = readConfig();
    const local = (config.hosts || []).find(host => host.monitoring?.type === "local");
    if (!local) {
      config.hosts = Array.isArray(config.hosts) ? config.hosts : [];
      config.hosts.push({
        id: "host-" + crypto.randomBytes(6).toString("hex"),
        name: "Agent",
        icon: "fa-solid fa-server",
        monitoring: { enabled: true, type: "local" }
      });
      writeConfig(config);
    } else if (local.monitoring.enabled !== true) {
      local.monitoring.enabled = true;
      writeConfig(config);
    }
  }

  app.get("/healthz", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  // Quelle version tourne, reellement. Le pied de page de l'interface est une
  // page HTML, donc passe par le cache du navigateur et par celui d'un eventuel
  // reverse proxy : y lire la version peut montrer une valeur perimee alors que
  // l'image, elle, est a jour. Cette route n'est qu'un objet JSON, jamais mise en
  // cache, et elle renvoie aussi la valeur brute du SHA d'image : c'est le seul
  // point de controle qui ne puisse pas mentir.
  // Le dossier /app vient-il d'un montage de l'hote plutot que de l'image ?
  // C'est la cause la plus frequente d'un deploiement ou "le code est a jour
  // mais la version affichee reste ancienne" : l'image fournit les variables
  // d'environnement (dont le SHA) tandis que le code vient du bind mount, donc
  // un git pull sur l'hote change les fichiers sans changer l'etiquette.
  // On ne renvoie qu'un booleen : les chemins de l'hote n'ont rien a faire dans
  // une reponse d'API. La fonction est declaree ici mais appelee plus haut, pour
  // construire le libelle du pied de page des le demarrage.
  // Un chemin est-il un point de montage du noyau ? C'est ce qui distingue une
  // donnee servie par un volume de ce qui n'est qu'un fichier de l'image. La
  // fonction est declaree ici mais appelee plus haut, pour construire le libelle
  // du pied de page des le demarrage.
  function isMountedPath(target) {
    try {
      const info = fs.readFileSync("/proc/self/mountinfo", "utf8");
      return info.split("\n").some(line => {
        const parts = line.split(" ");
        return parts.length > 4 && parts[4] === target;
      });
    } catch (_error) {
      return null;
    }
  }

  function appIsMounted() {
    try {
      const info = fs.readFileSync("/proc/self/mountinfo", "utf8");
      return info.split("\n").some(line => {
        const parts = line.split(" ");
        return parts.length > 4 && (parts[4] === "/app" || parts[4].startsWith("/app/"));
      });
    } catch (_error) {
      return null;
    }
  }

  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      version: APP_VERSION,
      // Le commit de l'IMAGE. A lire avec appMounted : s'il vaut true, il
      // decrit une image qui ne fournit pas le code en cours d'execution.
      commit: APP_COMMIT || "",
      commitShort: APP_COMMIT_SHORT,
      // Le champ "version" du paquet n'est mis a jour qu'a la publication d'un
      // tag : sur une image "unstable" il reste fige, ce qui est sans rapport
      // avec l'etat reel du deploiement.
      packageVersion: require("./package.json").version,
      appMounted: APP_CODE_MOUNTED,
      // true quand /app/data est montee separement. C'est LA question qui decide
      // si l'on peut retirer le montage du code sans perdre la configuration :
      // si les donnees sont a l'interieur du montage /app, les retirer les met
      // hors du conteneur — elles restent sur le disque, mais plus rien ne les
      // sert. Volume et donnees sont donc deux choses distinctes a verifier.
      dataMounted: isMountedPath(DATA_DIR),
      // Reperage de l'emplacement des donnees, utile avant une intervention sur
      // les montages. Aucun chemin hote n'est renvoye : seulement une position
      // dans la hierarchie du conteneur.
      dataPath: DATA_DIR,
      startedAt: STARTED_AT
    });
  });

  // Publie la cle de statut calculee par le core, sans repasser par la
  // serialisation complete : le client ne recompose donc jamais la cle, et les
  // deux cotes ne peuvent pas diverger. Le champ n'est jamais persiste car
  // buildConfigOutput() ne copie que les champs declares par le manifest.
  function withCacheKeys(config) {
    const services = Array.isArray(config.services) ? config.services : [];
    return {
      ...config,
      services: services.map(svc => {
        if (!svc?.widget?.type) return svc;
        return { ...svc, widget: { ...svc.widget, key: widgetCore.cacheKey(svc) } };
      })
    };
  }

  // Registre des widgets installees : metadonnees publiques (schema de config,
  // libelles, icone, periode). Ni code serveur, ni secret.
  app.get("/api/widgets", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(widgetCore.publicList());
  });

  // Code client d'un widget, servi depuis le dossier du widget. Le nom de fichier
  // vient exclusivement du manifest valide par le registre : aucune traversée de
  // chemin possible et aucun fichier serveur exposé.
  app.get("/widget-client/:id.js", (req, res) => {
    const asset = widgetCore.clientAsset(req.params.id, "js");
    if (!asset) return res.status(404).type("text/plain").send("Introuvable");
    res.set("Cache-Control", "public, max-age=300");
    res.type("text/javascript").send(asset.body);
  });

  app.get("/widget-client/:id.css", (req, res) => {
    const asset = widgetCore.clientAsset(req.params.id, "css");
    if (!asset) return res.status(404).type("text/plain").send("Introuvable");
    res.set("Cache-Control", "public, max-age=300");
    res.type("text/css").send(asset.body);
  });

  // Un widget installe est serialise depuis son manifest (chiffrement des secrets
  // compris) ; un widget inconnu est conserve tel quel, pour ne pas perdre sa
  // config si le plugin est momentanement absent.
  function serializeWidget(widget) {
    if (!widget?.type) return null;
    return widgetCore.has(widget.type)
      ? widgetCore.sanitizeWidget(widget)
      : widgetCore.preserveWidget(widget);
  }

  const buildConfigOutput = createConfigNormalizer({
    serializeWidget,
    sanitizeReplication: value => sanitizeReplication(value)
  });

  function writeConfig(output) {
    configStore.write(output);
  }

  function keepOneLocalHost(config) {
    return ensureLocalHost(config);
  }

  async function replicateConfig(config) {
    // Les agents ne recoivent jamais la configuration du tableau de bord.
    return [];
  }

  function validSyncToken(req) {
    const received = Buffer.from(req.get("X-Dashmon-Sync-Token") || "");
    const expected = Buffer.from(DASHMON_SYNC_TOKEN);
    return (
      expected.length > 0 &&
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected)
    );
  }

  // Les routes de federation ne reposent pas sur la session navigateur. Elles
  // restent toutefois inaccessibles sans le secret d'environnement partage.
  app.put("/api/sync/config", (req, res) => {
    res.status(410).json({ error: "La réplication est remplacée par le mode agent" });
  });

  app.get("/readyz", (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      readConfig();
      fs.accessSync(CONFIG_FILE, fs.constants.R_OK);
      fs.accessSync(path.dirname(CONFIG_FILE), fs.constants.W_OK);
      res.json({ ok: true, role: AGENT_MODE ? "agent" : "primary" });
    } catch (_error) {
      res.status(503).json({ ok: false, role: AGENT_MODE ? "agent" : "primary" });
    }
  });

  app.get("/api/sync/metrics", (req, res) => {
    if (!validSyncToken(req))
      return res.status(401).json({ error: "Authentification de synchronisation requise" });
    if (!AGENT_MODE) return res.status(404).json({ error: "Agent non activé" });
    return serveHostMetrics(req, res);
  });

  registerAgentRoutes(app, {
    readConfig,
    sanitizeReplication: value => sanitizeReplication(value),
    sanitizeSyncUrl: value => sanitizeSyncUrl(value),
    request: httpClient.apiRequest,
    assess: agentProtocol.assess,
    token: DASHMON_SYNC_TOKEN,
    timeout: STATUS_TIMEOUT
  });

  registerConfigRoutes(app, {
    readConfig,
    writeConfig,
    revision: config => configStore.revision(config),
    normalize: config => keepOneLocalHost(buildConfigOutput(config)),
    replicate: replicateConfig,
    ensureHostIds,
    withCacheKeys
  });

  // Incrément du compteur d'utilisation depuis un clic. Route légère (petit corps)
  // compatible avec la navigation de page (sendBeacon/keepalive) ; écriture
  // synchrone pour rester atomique face aux PUT /api/config simultanés.
  app.post("/api/usage", (req, res) => {
    try {
      const key = req.body && typeof req.body.key === "string" ? req.body.key.trim() : "";
      if (!key || key.length > 200) return res.status(400).json({ error: "Clé invalide" });

      const config = readConfig();
      config.usageCounts =
        config.usageCounts &&
        typeof config.usageCounts === "object" &&
        !Array.isArray(config.usageCounts)
          ? config.usageCounts
          : {};
      const n = Number(config.usageCounts[key]);
      config.usageCounts[key] = Number.isFinite(n) && n >= 0 ? Math.floor(n) + 1 : 1;

      writeConfig(config);
      res.json({ ok: true });
    } catch (error) {
      console.error("Incrément usage:", error);
      res.status(500).json({ error: "Incrément du compteur impossible" });
    }
  });

  app.get("/api/icons", (_req, res) => {
    try {
      fs.mkdirSync(ICONS_DIR, { recursive: true });
      const files = fs
        .readdirSync(ICONS_DIR, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      res.set("Cache-Control", "no-store");
      res.json(files);
    } catch (error) {
      console.error("Lecture des images:", error);
      res.status(500).json({ error: "Lecture des images impossible" });
    }
  });

  function parsePngSize(buffer) {
    try {
      if (buffer.length < 24) return { width: 0, height: 0 };
      const w = buffer.readUInt32BE(16);
      const h = buffer.readUInt32BE(20);
      return { width: w, height: h };
    } catch (_error) {
      return { width: 0, height: 0 };
    }
  }

  app.post("/api/icons", pngBody, (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length < 8) {
        console.warn(`${ts()} Import image rejeté : corps vide ou trop court`);
        return res.status(400).json({ error: "Image PNG invalide" });
      }

      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (!req.body.subarray(0, 8).equals(signature)) {
        console.warn(`${ts()} Import image rejeté : signature PNG absente`);
        return res.status(400).json({ error: "Le fichier n'est pas un PNG valide" });
      }

      const { width, height } = parsePngSize(req.body);
      const MAX_IMG_DIM = 8192;
      const MAX_IMG_PIXELS = 64 * 1024 * 1024;
      if (
        !width ||
        !height ||
        width > MAX_IMG_DIM ||
        height > MAX_IMG_DIM ||
        width * height > MAX_IMG_PIXELS
      ) {
        console.warn(`${ts()} Import image rejeté : PNG trop grand (${width}×${height})`);
        return res
          .status(400)
          .json({ error: `Image trop grande (max ${MAX_IMG_DIM}×${MAX_IMG_DIM})` });
      }

      const requested = decodeURIComponent(req.get("X-File-Name") || "image.png");
      const base =
        path
          .basename(requested)
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "image.png";

      const stem = path.parse(base).name || "image";
      let filename = `${stem}.png`;
      let counter = 2;

      fs.mkdirSync(ICONS_DIR, { recursive: true });
      while (fs.existsSync(path.join(ICONS_DIR, filename))) {
        filename = `${stem}-${counter++}.png`;
      }

      fs.writeFileSync(path.join(ICONS_DIR, filename), req.body);
      console.log(`${ts()} Image importée : ${filename} (${req.body.length} octets)`);
      res.status(201).json({ ok: true, file: filename });
    } catch (error) {
      console.error("Import image:", error);
      res.status(500).json({ error: "Import de l'image impossible" });
    }
  });

  app.delete("/api/icons/:file", (req, res) => {
    try {
      const requested = decodeURIComponent(req.params.file || "");
      const filename = path.basename(requested);

      if (!filename || filename !== requested || !filename.toLowerCase().endsWith(".png")) {
        return res.status(400).json({ error: "Nom d'image invalide" });
      }

      const target = path.join(ICONS_DIR, filename);
      if (!fs.existsSync(target)) {
        return res.status(404).json({ error: "Image introuvable" });
      }

      fs.unlinkSync(target);
      console.log(`${ts()} Image supprimée : ${filename}`);
      res.json({ ok: true, file: filename });
    } catch (error) {
      console.error("Suppression image:", error);
      res.status(500).json({ error: "Suppression de l'image impossible" });
    }
  });

  app.use("/icons", express.static(ICONS_DIR, { dotfiles: "deny", index: false, maxAge: "5m" }));

  const THEME_REQUIRED_VARS = [
    "bg",
    "surface",
    "surface-2",
    "surface-3",
    "border",
    "text",
    "muted",
    "accent",
    "danger",
    "shadow"
  ];
  const THEME_OPTIONAL_VARS = ["success", "error"];

  function sanitizeThemeId(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Doit rester identique à public/js/themes.js (sanitizeVarValue) : sans blocage
  // identique, une valeur comme `red} body{display:none` casserait la règle
  // [data-theme] injectée et s'appliquerait à tous les visiteurs.
  function sanitizeVarValue(value) {
    return String(value || "")
      .trim()
      .replace(/[\{\}\;\n\r\"\'\<\>\\]/g, "")
      .slice(0, 200);
  }

  function sanitizeThemeCss(css) {
    const s = String(css || "").slice(0, 65536);
    let out = s.replace(/<\s*\/?style/gi, "");
    out = out.replace(/@(import|charset|font-face)\b/gi, "");
    out = out.replace(/url\s*\(/gi, "none");
    out = out.replace(
      /(expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:)/gi,
      ""
    );
    return out;
  }

  function normalizeThemeObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const id = sanitizeThemeId(input.id || input.name);
    if (!id) return null;

    const variables = input.variables || {};
    const clean = {};
    for (const key of THEME_REQUIRED_VARS) {
      const value = variables[key];
      if (typeof value === "string" && value.trim()) clean[key] = sanitizeVarValue(value);
    }
    if (Object.keys(clean).length !== THEME_REQUIRED_VARS.length) return null;

    // Variables sémantiques optionnelles (couleurs de statut) : sinon le thème
    // hérite des défauts CSS (--success/--error).
    for (const key of THEME_OPTIONAL_VARS) {
      const value = variables[key];
      if (typeof value === "string" && value.trim())
        clean[key] = sanitizeVarValue(value).slice(0, 40);
    }

    return {
      id,
      name: String(input.name || id)
        .trim()
        .slice(0, 80),
      author: String(input.author || "")
        .trim()
        .slice(0, 80),
      description: String(input.description || "")
        .trim()
        .slice(0, 300),
      version: String(input.version || "1.0.0")
        .trim()
        .slice(0, 20),
      variables: clean,
      css: sanitizeThemeCss(typeof input.css === "string" ? input.css : "")
    };
  }

  function readThemeFile(dir, id) {
    try {
      const target = path.join(dir, id + ".json");
      if (!fs.existsSync(target)) return null;
      const theme = JSON.parse(fs.readFileSync(target, "utf8"));
      return normalizeThemeObject({ ...theme, id });
    } catch (_error) {
      return null;
    }
  }

  function listThemeFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map(entry => path.parse(entry.name).name)
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }

  app.get("/api/themes", (_req, res) => {
    try {
      const native = listThemeFiles(THEMES_NATIVE_DIR)
        .map(id => readThemeFile(THEMES_NATIVE_DIR, id))
        .filter(Boolean);
      const custom = listThemeFiles(THEMES_CUSTOM_DIR)
        .map(id => readThemeFile(THEMES_CUSTOM_DIR, id))
        .filter(Boolean);
      res.set("Cache-Control", "no-store");
      res.json({ native, custom });
    } catch (error) {
      console.error("Lecture des thèmes:", error);
      res.status(500).json({ error: "Lecture des thèmes impossible" });
    }
  });

  app.get("/api/themes/:id/export", (req, res) => {
    try {
      const id = sanitizeThemeId(req.params.id);
      if (!id) return res.status(400).json({ error: "Identifiant de thème invalide" });

      const theme = readThemeFile(THEMES_NATIVE_DIR, id) || readThemeFile(THEMES_CUSTOM_DIR, id);
      if (!theme) return res.status(404).json({ error: "Thème introuvable" });

      res.set("Content-Disposition", `attachment; filename="theme-${id}.json"`);
      res.set("Content-Type", "application/json");
      res.send(JSON.stringify(theme, null, 2) + "\n");
    } catch (error) {
      console.error("Export de thème:", error);
      res.status(500).json({ error: "Export du thème impossible" });
    }
  });

  app.post("/api/themes/import", (req, res) => {
    try {
      const normalized = normalizeThemeObject(req.body);
      if (!normalized) {
        console.warn(`${ts()} Import thème rejeté : JSON invalide ou variables manquantes`);
        return res
          .status(400)
          .json({ error: "Thème invalide : id et les 10 variables requises sont obligatoires" });
      }

      if (normalized.css && normalized.css.length > 65536) {
        console.warn(
          `${ts()} Import thème rejeté : CSS trop volumineux (${normalized.css.length} octets)`
        );
        return res.status(400).json({ error: "CSS trop volumineux (max 64 Ko)" });
      }

      const nativeConflict = fs.existsSync(path.join(THEMES_NATIVE_DIR, normalized.id + ".json"));
      if (nativeConflict) {
        console.warn(
          `${ts()} Import thème rejeté : « ${normalized.id} » réservé par un thème natif`
        );
        return res
          .status(409)
          .json({ error: `L'identifiant « ${normalized.id} » est réservé par un thème natif` });
      }

      const target = path.join(THEMES_CUSTOM_DIR, normalized.id + ".json");
      fs.writeFileSync(target, JSON.stringify(normalized, null, 2) + "\n", "utf8");

      console.log(`${ts()} Thème importé : ${normalized.id}.json`);
      res.status(201).json({ ok: true, file: `${normalized.id}.json` });
    } catch (error) {
      console.error("Import thème:", error);
      res.status(500).json({ error: "Import du thème impossible" });
    }
  });

  app.delete("/api/themes/:id", (req, res) => {
    try {
      const id = sanitizeThemeId(req.params.id);
      if (!id) return res.status(400).json({ error: "Identifiant de thème invalide" });

      if (fs.existsSync(path.join(THEMES_NATIVE_DIR, id + ".json"))) {
        return res.status(403).json({ error: "Impossible de supprimer un thème natif" });
      }

      const target = path.join(THEMES_CUSTOM_DIR, id + ".json");
      if (!fs.existsSync(target)) {
        return res.status(404).json({ error: "Thème introuvable" });
      }

      fs.unlinkSync(target);
      console.log(`${ts()} Thème supprimé : ${id}.json`);
      res.json({ ok: true });
    } catch (error) {
      console.error("Suppression thème:", error);
      res.status(500).json({ error: "Suppression du thème impossible" });
    }
  });

  app.get("/login", (req, res) => {
    if (!DASHMON_PASSWORD || validSession(req) || validBasicAuth(req)) return res.redirect("/");
    res.set("Cache-Control", "no-store");
    res.sendFile(LOGIN_FILE);
  });

  app.get(["/", "/index.html"], (req, res) => {
    if (DASHMON_PASSWORD && !validSession(req) && !validBasicAuth(req))
      return res.redirect("/login");
    // La page doit toujours etre revalidee : elle porte le libelle de version du
    // pied de page et les references des scripts. Sans cet en-tete, un
    // navigateur garde le HTML en cache et affiche une version perimee alors que
    // les scripts, eux, sont bien charges a jour. Les routes API sont deja en
    // no-store pour la meme raison.
    res.set("Cache-Control", "no-store");
    if (AGENT_MODE) return res.sendFile(path.join(PUBLIC_DIR, "agent.html"));
    res.type("html").send(INDEX_HTML);
  });
  app.use(express.static(PUBLIC_DIR));

  const STATUS_INTERVAL = 60000;

  // Frequence de re-verification et cle de cache : deleguees au registre, qui lit
  // la periode declaree dans le manifest.json de chaque widget.
  function checkInterval(svc) {
    return widgetCore.interval(svc);
  }
  function serviceCacheKey(svc) {
    return widgetCore.cacheKey(svc);
  }

  // Un service est couvert par un plugin : son widget s'il en a un, sinon le
  // plugin qui revendique le slot "link" (les liens web). Le core n'a plus de
  // sonde codee en dur, donc ajouter un type de lien est une question de plugin.
  async function checkService(service) {
    if (widgetCore.handles(service)) {
      await widgetCore.check(service);
      return;
    }
    // Aucun plugin ne sait surveiller ce service (widget d'un plugin absent, ou
    // plugin de lien non installé) : on ne publie rien plutot qu'un faux etat.
    if (!service.url || service.monitor === false) return;
    if (service.widget?.type) return;
    console.warn(`${ts()} Aucun plugin ne surveille ${service.url} — lien non contrôlé`);
  }

  // Service virtuel pour un lien web porteur d'un compteur : le bandeau emprunte
  // le backend du widget correspondant (github/dockerhub/youtube), donc le core
  // ne connait aucun nouveau type de sonde. Le chiffre atterrit dans statusCache
  // sous la cle de l'URL du lien, que le client relit pour l'afficher.
  function linkCounterService(link) {
    const counter = link && link.counter;
    const url = link && sanitizeUrl(link.url);
    if (!counter || !url) return null;
    if (counter.type === "github")
      return { url, widget: { type: "github", repo: counter.target, metric: "stars" } };
    if (counter.type === "dockerhub")
      return { url, widget: { type: "dockerhub", repo: counter.target } };
    if (counter.type === "youtube")
      return { url, widget: { type: "youtube", username: counter.target } };
    return null;
  }

  function linkCounterServices(config) {
    const links = Array.isArray(config.webLinks) ? config.webLinks : [];
    return links.map(linkCounterService).filter(Boolean);
  }

  const refreshStatuses = createScheduler({ runCycle: refreshStatusesCycle });

  const { sanitizeSyncUrl, sanitizeReplication } = createReplicationConfig({
    sanitizeUrl,
    sanitizeText,
    defaultName: os.hostname().slice(0, 100)
  });

  async function refreshStatusesCycle(force) {
    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return;
    }

    const services = Array.isArray(config.services) ? config.services : [];
    // Les liens web porteurs d'un compteur sont surveilles comme des services
    // virtuels : meme boucle, meme cache, meme purge. Sans quoi leur entree de
    // statut serait purgee a chaque cycle et le compteur disparaitrait du bandeau.
    const monitored = services.concat(linkCounterServices(config));
    // Purge des entrées de cache devenues orphelines et des mémoires internes
    // des widgets (jetons, historiques) : chaque widget purge ce qu'il veut via
    // son hook purge(), le core ne connaît aucun widget.
    widgetCore.purge(monitored);
    const candidates = force
      ? monitored
      : monitored.filter(svc => {
          const cache = statusCache[serviceCacheKey(svc)];
          return !(cache && cache.lastCheck && Date.now() - cache.lastCheck < checkInterval(svc));
        });
    // Les widgets a cle de configuration (Docker, par exemple) peuvent etre
    // affiches plusieurs fois. Une seule sonde suffit par cle et evite de frapper
    // la meme API ou le meme registre en parallele.
    const due = [];
    const seen = new Set();
    for (const svc of candidates) {
      const key = serviceCacheKey(svc);
      if (seen.has(key)) continue;
      seen.add(key);
      due.push(svc);
    }
    // Checks par lots de 3 espacés : évite les rafales de connexions en gardant
    // un cycle de rafraîchissement raisonnable.
    for (let i = 0; i < due.length; i += 3) {
      await Promise.all(due.slice(i, i + 3).map(svc => checkService(svc)));
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    // Marque la dernière vérification de chaque service traité.
    due.forEach(svc => {
      const cache = statusCache[serviceCacheKey(svc)];
      if (cache) cache.lastCheck = Date.now();
    });
  }

  // --- Supervision des hotes ------------------------------------------------
  // CPU, RAM, temperature et disque de la machine locale (os, /sys, statfs).
  // Chaque valeur est un pourcentage 0..100, sauf la temperature en degres. Une
  // metrique indisponible vaut null (affichee "—") : zero est une mesure, son
  // absence n'en est pas une, et les confondre ferait croire a un hote au repos.

  function positiveInteger(value, max) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) return null;
    return Math.min(n, max);
  }

  const {
    localCpuPercent,
    localRamPercent,
    localSystemDetails,
    localTemperature,
    localDiskPercent
  } = createLocalMetrics({ sanitizeText });

  const HOST_METRICS_TTL = HOST_METRICS_INTERVAL;
  let hostMetricsCache = { ts: 0, payload: null };
  let hostMetricsInflight = null;
  let lastLocalSuccessAt = null;

  async function serveHostMetrics(_req, res) {
    res.set("Cache-Control", "no-store");

    if (hostMetricsCache.payload && Date.now() - hostMetricsCache.ts < HOST_METRICS_TTL) {
      return res.json(hostMetricsCache.payload);
    }
    // Deduplication : plusieurs navigateurs simultanes partagent une seule salve
    // de mesures plutot que d'interroger chaque hote une fois par onglet.
    if (hostMetricsInflight) {
      try {
        return res.json(await hostMetricsInflight);
      } catch (_error) {
        return res.status(500).json({ error: "Lecture des mesures impossible" });
      }
    }

    let config;
    try {
      config = readConfig();
    } catch (_error) {
      return res.status(500).json({ error: "Lecture de config.json impossible" });
    }

    const configuredHosts = Array.isArray(config.hosts) ? config.hosts : [];
    const localHost = configuredHosts.find(
      host => host?.monitoring?.type === "local" && host.monitoring.enabled === true
    );
    const hosts = localHost ? [localHost] : [];

    // Les mesures locales sont lues une seule fois : deux hotes "local" designent
    // la meme machine, on ne consomme donc le delta CPU qu'une fois par requete.
    const localCpu = localCpuPercent();
    const localRam = localRamPercent();
    const localDetails = localSystemDetails();
    const localTemp = localTemperature();
    const localDump = readWireguardDump(WIREGUARD_DUMP_FILE);
    const localSmart = readSmartDump(SMART_DUMP_FILE);
    const localAptUpdates = hosts.some(
      host =>
        host.monitoring?.enabled &&
        host.monitoring.type === "local" &&
        host.monitoring.aptUpdates?.enabled !== false
    )
      ? readAptUpdatesReport(APT_UPDATES_REPORT_FILE)
      : null;

    const refresh = Promise.all(
      hosts.map(async host => {
        const type = HOST_MONITORING_TYPES.has(host.monitoring?.type)
          ? host.monitoring.type
          : "local";
        try {
          let metrics;
          let wireguardFetchedAt = null;
          let smartFetchedAt = null;
          {
            // Le dump local est le meme pour tous les hotes "local" : on le lit une
            // fois et on date chaque copie de l'heure du fichier.
            metrics = {
              cpu: localCpu,
              ram: localRam,
              temperature: localTemp,
              disk: localDiskPercent(host.monitoring?.path),
              wireguard:
                host.monitoring?.wireguard?.enabled === false
                  ? null
                  : localDump?.interfaces || null,
              smart: host.monitoring?.smart?.enabled === false ? null : localSmart?.disks || null,
              aptUpdates: localAptUpdates,
              ...localDetails
            };
            if (host.monitoring?.wireguard?.interface && metrics.wireguard)
              metrics.wireguard = metrics.wireguard.filter(
                item => item.interface === host.monitoring.wireguard.interface
              );
            if (host.monitoring?.smart?.disks?.length && metrics.smart)
              metrics.smart = metrics.smart.filter(item =>
                host.monitoring.smart.disks.includes(item.device)
              );
            wireguardFetchedAt = localDump?.fetchedAt || null;
            smartFetchedAt = localSmart?.fetchedAt || null;
          }
          return {
            id: sanitizeText(host.id, 64),
            name: sanitizeText(host.name, 100) || "Hote",
            type,
            ok: true,
            cpu: metrics.cpu,
            ram: metrics.ram,
            temperature: metrics.temperature,
            disk: metrics.disk,
            os: sanitizeText(metrics.os, 200),
            cpuModel: sanitizeText(metrics.cpuModel, 200),
            cpuCores: positiveInteger(metrics.cpuCores, 1024),
            ramTotal: positiveInteger(metrics.ramTotal, Number.MAX_SAFE_INTEGER),
            wireguard: metrics.wireguard || null,
            wireguardFetchedAt,
            smart: metrics.smart || null,
            smartFetchedAt,
            aptUpdates: metrics.aptUpdates || null
          };
        } catch (error) {
          return {
            id: sanitizeText(host.id, 64),
            name: sanitizeText(host.name, 100) || "Hote",
            type,
            ok: false,
            error: error.message
          };
        }
      })
    ).then(results => {
      if (!AGENT_MODE) return { hosts: results };
      const collectedAt = new Date().toISOString();
      const ok = results.length > 0 && results.every(result => result.ok);
      if (ok) lastLocalSuccessAt = collectedAt;
      return {
        hosts: results,
        protocol: agentProtocol.PROTOCOL,
        agent: { id: AGENT_ID, capabilities: agentProtocol.CAPABILITIES },
        collection: {
          status: ok ? "available" : "unavailable",
          collectedAt,
          lastSuccessAt: lastLocalSuccessAt,
          maxAgeMs: HOST_METRICS_INTERVAL * 3
        }
      };
    });

    hostMetricsInflight = refresh;
    try {
      const payload = await refresh;
      hostMetricsCache = { ts: Date.now(), payload };
      res.json(payload);
    } catch (error) {
      console.error("Refresh mesures:", error);
      res.status(500).json({ error: "Lecture des mesures impossible" });
    } finally {
      if (hostMetricsInflight === refresh) hostMetricsInflight = null;
    }
  }
  app.get("/api/host-metrics", serveHostMetrics);
  app.get("/api/agent/metrics", (req, res) =>
    AGENT_MODE ? serveHostMetrics(req, res) : res.sendStatus(404)
  );

  app.get("/api/agent/config", (req, res) => {
    if (!AGENT_MODE) return res.sendStatus(404);
    try {
      const config = readConfig();
      if (req.get("If-Match") && req.get("If-Match") !== configStore.revision(config)) {
        return res
          .status(412)
          .json({ error: "La configuration a changé ; rechargez avant d'enregistrer" });
      }
      const host = (config.hosts || []).find(
        item => item.monitoring?.type === "local" && item.monitoring.enabled
      );
      res.set("Cache-Control", "no-store");
      res.json({
        name: host?.name || "Agent",
        monitoring: host?.monitoring || { enabled: true, type: "local" }
      });
    } catch (_error) {
      res.status(500).json({ error: "Lecture impossible" });
    }
  });
  app.put("/api/agent/config", (req, res) => {
    if (!AGENT_MODE) return res.sendStatus(404);
    try {
      const current = readConfig();
      const old = (current.hosts || []).find(
        item => item.monitoring?.type === "local" && item.monitoring.enabled
      );
      const monitoring = sanitizeHostMonitoring({
        ...req.body?.monitoring,
        type: "local",
        enabled: true
      });
      const host = {
        id: old?.id || "host-" + crypto.randomBytes(6).toString("hex"),
        name: sanitizeText(req.body?.name, 100) || "Agent",
        icon: old?.icon || "fa-solid fa-server",
        color: old?.color || "",
        monitoring
      };
      current.hosts = (Array.isArray(current.hosts) ? current.hosts : []).filter(
        item => item !== old
      );
      current.hosts.push(host);
      writeConfig(current);
      hostMetricsCache = { ts: 0, payload: null };
      res.json({ ok: true });
    } catch (_error) {
      res.status(500).json({ error: "Enregistrement impossible" });
    }
  });

  app.get("/api/status", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(statusCache);
  });

  // Rafraîchissement manuel forcé de tous les statuts/pastilles/widgets.
  app.post("/api/refresh", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await refreshStatuses(true);
    } catch (_error) {}
    res.json(statusCache);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });

  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Corps JSON invalide" });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Fichier trop volumineux" });
    }
    console.error("Erreur serveur:", err.message);
    res.status(500).json({ error: "Erreur interne" });
  });

  let httpServer;
  let statusTimer;

  function shutdownGraceful(signal) {
    console.log(`${ts()} ${signal} reçu, arrêt propre…`);
    clearInterval(statusTimer);
    const bye = () => {
      console.log(`${ts()} Serveur arrêté proprement.`);
      process.exit(0);
    };
    if (httpServer) httpServer.close(bye);
    else bye();
    setTimeout(() => {
      console.error(`${ts()} Arrêt forcé (délai dépassé).`);
      process.exit(1);
    }, 10000).unref();
  }

  // Le registre doit etre charge avant l'ecoute HTTP et avant tout cycle de
  // statut : sinon /api/widgets pourrait repondre une liste vide au tout premier
  // chargement du navigateur, et le core ignorerait les types qu'il ne connait
  // pas encore.
  let widgetsReady = false;

  async function start() {
    process.on("uncaughtException", error => {
      console.error(`${ts()} Uncaught exception :`, error);
      process.exit(1);
    });
    process.on("unhandledRejection", reason => {
      console.error(`${ts()} Unhandled rejection :`, reason);
      process.exit(1);
    });
    process.on("SIGTERM", () => shutdownGraceful("SIGTERM"));
    process.on("SIGINT", () => shutdownGraceful("SIGINT"));
    if (!AGENT_MODE) {
      try {
        await widgetCore.load();
      } catch (error) {
        console.error(`${ts()} Registre de widgets illisible : ${error.message}`);
      }
    }
    // Les liens web sont des services sans widget : ils sont surveilles par le
    // plugin qui revendique le slot "link". Sans lui, plus rien ne les controle,
    // autant le dire au demarrage plutot que de laisser des tuiles grises.
    if (!AGENT_MODE && !widgetCore.linkPlugin()) {
      console.warn(
        `${ts()} Aucun plugin de lien (defaultFor: "link") : les liens web ne seront pas contrôlés`
      );
    }
    widgetsReady = true;
    httpServer = app.listen(PORT, DASHBOARD_BIND, () => {
      console.log(`${ts()} Dashmon : http://${DASHBOARD_BIND}:${PORT}`);
    });
    statusTimer = setInterval(() => {
      if (widgetsReady && !AGENT_MODE) refreshStatuses();
    }, STATUS_INTERVAL);
    if (!AGENT_MODE) await refreshStatuses();
  }

  return { app, start };
}

if (require.main === module) {
  createApp()
    .start()
    .catch(error => {
      console.error("Demarrage impossible :", error);
      process.exit(1);
    });
}
module.exports = { createApp };
