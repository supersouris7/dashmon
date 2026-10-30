// Taille du pool libuv définie avant tout usage async (DNS/fs). 16 threads
// étaient surdimensionnés : la majorité des requêtes attendent sur du réseau
// sortant (pas de blocage du pool). 4 suffisent et réduisent le delta libuv.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "4";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const httpClient = require("./lib/http/client");
const { WidgetCore } = require("./lib/widgets/core");
const { ConfigStore } = require("./lib/config/store");
const agentProtocol = require("./lib/agent/protocol");
const { createAuth } = require("./lib/http/auth");
const { createScheduler } = require("./lib/status/scheduler");
const { securityHeaders } = require("./lib/http/security-headers");
const { verifyRequestOrigin } = require("./lib/http/request-origin");
const { createRateLimiter } = require("./lib/http/rate-limit");
const { createReplicationConfig } = require("./lib/agent/replication-config");
const { createLocalMetrics } = require("./lib/host/local-metrics");
const { sanitizeText, sanitizeUrl } = require("./lib/sanitize");
const { createSecretCodec } = require("./lib/config/secrets");
const { readAptUpdatesReport } = require("./lib/host/apt-report");
const { readSmartDump } = require("./lib/host/smart-report");
const { readWireguardDump } = require("./lib/host/wireguard-report");
const { registerConfigRoutes } = require("./lib/routes/config");
const { registerAgentRoutes } = require("./lib/routes/agents");
const { HOST_MONITORING_TYPES, sanitizeHostMonitoring } = require("./lib/config/fields");
const { createConfigNormalizer } = require("./lib/config/normalize");
const { readSettings } = require("./lib/config/settings");
const { createConfigRepository } = require("./lib/config/repository");
const { runStartupMigrations, ensureHostIds } = require("./lib/config/migrations");
const { loadAgentIdentity } = require("./lib/agent/identity");
const { log } = require("./lib/log");
const { registerIconRoutes } = require("./lib/routes/icons");
const { registerThemeRoutes } = require("./lib/routes/themes");
const { registerSessionRoutes } = require("./lib/routes/session");
const { registerPageRoutes } = require("./lib/routes/pages");
const { registerSystemRoutes } = require("./lib/routes/system");
const { registerWidgetRoutes } = require("./lib/routes/widgets");
const { requestLog } = require("./lib/http/request-log");
const { notFound, errorHandler } = require("./lib/http/errors");
const { describeVersion } = require("./lib/version");

function createApp() {
  const app = express();

  function ts() {
    return new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "");
  }

  const settings = readSettings(process.env, { root: __dirname });
  if (settings.trustProxy > 0) app.set("trust proxy", settings.trustProxy);

  const {
    port: PORT,
    bindAddress: DASHBOARD_BIND,
    rootDir: ROOT,
    publicDir: PUBLIC_DIR,
    dataDir: DATA_DIR,
    configFile: CONFIG_FILE,
    iconsDir: ICONS_DIR,
    themesNativeDir: THEMES_NATIVE_DIR,
    themesCustomDir: THEMES_CUSTOM_DIR,
    wireguardDumpFile: WIREGUARD_DUMP_FILE,
    smartDumpFile: SMART_DUMP_FILE,
    aptUpdatesReportFile: APT_UPDATES_REPORT_FILE,
    password: DASHMON_PASSWORD,
    syncToken: DASHMON_SYNC_TOKEN,
    agentMode: AGENT_MODE,
    insecureTls: INSECURE_TLS,
    hostMetricsInterval: HOST_METRICS_INTERVAL
  } = settings;
  const configStore = new ConfigStore(CONFIG_FILE);
  const versionInfo = describeVersion(settings);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb", strict: true }));

  // Upper bound for one status probe, shared by the core and the plugins.
  const STATUS_TIMEOUT = 4000;

  const auth = createAuth({ password: DASHMON_PASSWORD });

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

  registerSessionRoutes(app, { password: DASHMON_PASSWORD, auth, rateLimit });

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

  app.use(requestLog(log));

  // Secrets de widget chiffrés au repos : clé maîtresse en DASHMON_MASTER_KEY.
  // Sans clé, repli sur le stockage en clair (warning au démarrage) pour rester
  // utilisable sans configuration.
  const MASTER_KEY = settings.masterKey;
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

  const configRepository = createConfigRepository({ store: configStore, agentMode: AGENT_MODE });
  const readConfig = () => configRepository.read();
  const writeConfig = config => configRepository.write(config);
  runStartupMigrations(settings, configRepository);
  const AGENT_ID = AGENT_MODE ? loadAgentIdentity(DATA_DIR) : "";

  registerSystemRoutes(app, { settings, version: versionInfo, readConfig });

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

  registerWidgetRoutes(app, { widgetCore });

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

  function keepOneLocalHost(config) {
    return configRepository.ensureLocalHost(config);
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
    revision: config => configRepository.revision(config),
    normalize: config => keepOneLocalHost(buildConfigOutput(config)),
    replicate: replicateConfig,
    ensureHostIds: () => ensureHostIds(configRepository),
    withCacheKeys,
    logger: log
  });

  registerIconRoutes(app, { iconsDir: ICONS_DIR, log });
  registerThemeRoutes(app, { nativeDir: THEMES_NATIVE_DIR, customDir: THEMES_CUSTOM_DIR, log });

  registerPageRoutes(app, {
    publicDir: PUBLIC_DIR,
    password: DASHMON_PASSWORD,
    auth,
    agentMode: AGENT_MODE,
    versionLabel: versionInfo.label,
    hostMetricsInterval: HOST_METRICS_INTERVAL
  });

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
      if (req.get("If-Match") && req.get("If-Match") !== configRepository.revision(config)) {
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

  app.use(notFound);
  app.use(errorHandler(log));

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
