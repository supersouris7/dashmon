"use strict";
// Dashmon server entry point.
//
// createApp() assembles the application from the modules in lib/: it reads the
// settings, prepares the data, then builds the Express pipeline in order —
// security, rate limits, authentication, routes, error handlers. start() loads
// the widgets, listens and runs the status loop.
//
// Where to look:
//   lib/config/   settings (environment), config.json, validation, migrations
//   lib/http/     outgoing HTTP client, security middleware, logging, errors
//   lib/routes/   every HTTP endpoint, one file per topic
//   lib/widgets/  widget registry and core (widgets themselves live in widgets/)
//   lib/status/   status loop of the monitored services
//   lib/host/     metrics of the machine running Dashmon
//   lib/agent/    agent protocol, identity and pairing

// libuv thread pool size, set before any asynchronous work (DNS, fs). Most of
// the work waits on outgoing requests, which do not use the pool: 4 is enough.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "4";

const express = require("express");
const os = require("os");

const { readSettings } = require("./lib/config/settings");
const { ConfigStore } = require("./lib/config/store");
const { createConfigRepository } = require("./lib/config/repository");
const { runStartupMigrations, ensureHostIds } = require("./lib/config/migrations");
const { createConfigNormalizer } = require("./lib/config/normalize");
const { createSecretCodec } = require("./lib/config/secrets");
const { loadAgentIdentity } = require("./lib/agent/identity");
const agentProtocol = require("./lib/agent/protocol");
const { createReplicationConfig } = require("./lib/agent/replication-config");
const httpClient = require("./lib/http/client");
const { createAuth } = require("./lib/http/auth");
const { createSyncTokenCheck } = require("./lib/http/sync-token");
const { securityHeaders } = require("./lib/http/security-headers");
const { verifyRequestOrigin } = require("./lib/http/request-origin");
const { createRequestLimits } = require("./lib/http/rate-limit");
const { agentApiFilter } = require("./lib/http/agent-mode");
const { requestLog } = require("./lib/http/request-log");
const { notFound, errorHandler } = require("./lib/http/errors");
const { WidgetCore } = require("./lib/widgets/core");
const { createStatusMonitor } = require("./lib/status/monitor");
const { createHostMetrics } = require("./lib/host/metrics");
const { registerSessionRoutes } = require("./lib/routes/session");
const { registerSystemRoutes } = require("./lib/routes/system");
const { registerWidgetRoutes } = require("./lib/routes/widgets");
const { registerAgentRoutes } = require("./lib/routes/agents");
const { registerConfigRoutes } = require("./lib/routes/config");
const { registerIconRoutes } = require("./lib/routes/icons");
const { registerThemeRoutes } = require("./lib/routes/themes");
const { registerPageRoutes } = require("./lib/routes/pages");
const { registerHostMetricsRoutes } = require("./lib/routes/host-metrics");
const { registerAgentConfigRoutes } = require("./lib/routes/agent-config");
const { registerStatusRoutes } = require("./lib/routes/status");
const { startServer } = require("./lib/lifecycle");
const { sanitizeText, sanitizeUrl } = require("./lib/sanitize");
const { describeVersion } = require("./lib/version");
const { log } = require("./lib/log");

// Upper bound for one outgoing check, shared by the core and the plugins.
const STATUS_TIMEOUT = 4000;

function createApp() {
  const settings = readSettings(process.env, { root: __dirname });
  const version = describeVersion(settings);
  const { agentMode } = settings;

  // --- Services ----------------------------------------------------------

  // Widget secrets are encrypted at rest with DASHMON_MASTER_KEY. Without a
  // key they are stored in clear text, so Dashmon works without any setup.
  const secrets = createSecretCodec(settings.masterKey);
  if (!settings.masterKey) {
    log.warn(
      "⚠ DASHMON_MASTER_KEY is not set: widget passwords are stored IN CLEAR TEXT in config.json."
    );
  }

  // The widget core loads the registry and runs the checks. It knows no widget
  // by name: adding a widget never requires changing this file.
  httpClient.configure({ insecure: settings.insecureTls, timeout: STATUS_TIMEOUT });
  const statusCache = {};
  const widgetCore = new WidgetCore({
    root: settings.rootDir,
    dataDir: settings.dataDir,
    log: message => log.info(message),
    decryptSecret: secrets.decryptSecret,
    encryptSecret: secrets.encryptSecret,
    sanitizeText,
    sanitizeUrl,
    statusCache
  });

  const configRepository = createConfigRepository({
    store: new ConfigStore(settings.configFile),
    agentMode
  });
  runStartupMigrations(settings, configRepository);
  const readConfig = () => configRepository.read();
  const agentId = agentMode ? loadAgentIdentity(settings.dataDir) : "";

  // Pairing: the agents this dashboard reads metrics from.
  const pairing = createReplicationConfig({
    sanitizeUrl,
    sanitizeText,
    defaultName: os.hostname().slice(0, 100)
  });
  const normalizeConfig = createConfigNormalizer({
    serializeWidget: widget => widgetCore.serializeWidget(widget),
    sanitizeReplication: pairing.sanitizeReplication
  });

  const statusMonitor = createStatusMonitor({ widgetCore, statusCache, readConfig, log });
  const hostMetrics = createHostMetrics({ settings, readConfig, agentId, log });
  const auth = createAuth({ password: settings.password });
  const limits = createRequestLimits();

  // --- Express pipeline (order matters) ------------------------------------

  const app = express();
  if (settings.trustProxy > 0) app.set("trust proxy", settings.trustProxy);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(securityHeaders);
  app.use(verifyRequestOrigin);

  app.use("/api", limits.writes);
  app.use("/api/status", limits.reads);
  app.use("/api/sync/metrics", limits.reads);
  app.use("/api/host-metrics", limits.reads);

  // Login and logout, then authentication of every /api route.
  registerSessionRoutes(app, { password: settings.password, auth, rateLimit: limits.writes });
  if (agentMode) app.use("/api", agentApiFilter);
  app.use(requestLog(log));

  registerSystemRoutes(app, { settings, version, readConfig });
  registerWidgetRoutes(app, { widgetCore });

  registerAgentRoutes(app, {
    readConfig,
    sanitizeReplication: pairing.sanitizeReplication,
    sanitizeSyncUrl: pairing.sanitizeSyncUrl,
    request: httpClient.apiRequest,
    assess: agentProtocol.assess,
    token: settings.syncToken,
    timeout: STATUS_TIMEOUT
  });
  registerConfigRoutes(app, {
    readConfig,
    writeConfig: config => configRepository.write(config),
    revision: config => configRepository.revision(config),
    normalize: config => configRepository.ensureLocalHost(normalizeConfig(config)),
    ensureHostIds: () => ensureHostIds(configRepository),
    withCacheKeys: config => widgetCore.withCacheKeys(config),
    logger: log
  });
  registerIconRoutes(app, { iconsDir: settings.iconsDir, log });
  registerThemeRoutes(app, {
    nativeDir: settings.themesNativeDir,
    customDir: settings.themesCustomDir,
    log
  });
  registerPageRoutes(app, {
    publicDir: settings.publicDir,
    password: settings.password,
    auth,
    agentMode,
    versionLabel: version.label,
    hostMetricsInterval: settings.hostMetricsInterval
  });
  registerHostMetricsRoutes(app, {
    hostMetrics,
    agentMode,
    validSyncToken: createSyncTokenCheck(settings.syncToken)
  });
  registerAgentConfigRoutes(app, { agentMode, configRepository, hostMetrics });
  registerStatusRoutes(app, { statusMonitor });

  app.use(notFound);
  app.use(errorHandler(log));

  return {
    app,
    start: () => startServer({ app, settings, widgetCore, statusMonitor, log })
  };
}

if (require.main === module) {
  createApp()
    .start()
    .catch(error => {
      log.error("Start-up failed:", error);
      process.exit(1);
    });
}
module.exports = { createApp };
