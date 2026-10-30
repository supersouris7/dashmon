"use strict";
// Starting and stopping the server process.

// How often the status loop wakes up; each widget then decides, from its
// manifest period, whether its service is due.
const STATUS_INTERVAL = 60000;
// Graceful shutdown gives open requests this long before forcing the exit.
const SHUTDOWN_TIMEOUT = 10000;

async function startServer({ app, settings, widgetCore, statusMonitor, log, onWidgetsLoaded }) {
  let httpServer;
  let statusTimer;

  function shutdown(signal) {
    log.info(`${signal} received, shutting down…`);
    clearInterval(statusTimer);
    const exit = () => {
      log.info("Server stopped.");
      process.exit(0);
    };
    if (httpServer) httpServer.close(exit);
    else exit();
    setTimeout(() => {
      log.error("Forced exit (shutdown timeout).");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT).unref();
  }

  process.on("uncaughtException", error => {
    log.error("Uncaught exception:", error);
    process.exit(1);
  });
  process.on("unhandledRejection", reason => {
    log.error("Unhandled rejection:", reason);
    process.exit(1);
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // An agent has no widgets and no status loop.
  if (!settings.agentMode) {
    // The registry must be loaded before listening and before any status
    // cycle: otherwise /api/widgets could answer an empty list on the very
    // first page load, and the core would ignore types it does not know yet.
    try {
      await widgetCore.load();
    } catch (error) {
      log.error(`Widget registry unreadable: ${error.message}`);
    }
    try {
      if (onWidgetsLoaded) onWidgetsLoaded();
    } catch (error) {
      log.error(`Start-up task after loading widgets failed: ${error.message}`);
    }
    // Web links are services without a widget, checked by the plugin claiming
    // the "link" slot. Without it nothing checks them: say so at start-up
    // rather than leave grey tiles.
    if (!widgetCore.linkPlugin()) {
      log.warn('No link plugin (defaultFor: "link"): web links will not be checked');
    }
  }

  httpServer = app.listen(settings.port, settings.bindAddress, () => {
    log.info(`Dashmon: http://${settings.bindAddress}:${settings.port}`);
  });

  if (!settings.agentMode) {
    statusTimer = setInterval(() => statusMonitor.refresh(), STATUS_INTERVAL);
    await statusMonitor.refresh();
  }
}

module.exports = { startServer };
