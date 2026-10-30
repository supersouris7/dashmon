"use strict";
// Health and version endpoints, used by Docker, reverse proxies and support.
//
//   GET /healthz      the process answers (no authentication)
//   GET /readyz       config.json is readable and writable (no authentication)
//   GET /api/version  which build is running and where its data lives

const fs = require("fs");
const path = require("path");
const { isMountedPath } = require("../version");
const packageVersion = require("../../package.json").version;

function registerSystemRoutes(app, { settings, version, readConfig }) {
  const role = settings.agentMode ? "agent" : "primary";

  app.get("/healthz", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.get("/readyz", (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      readConfig();
      fs.accessSync(settings.configFile, fs.constants.R_OK);
      fs.accessSync(path.dirname(settings.configFile), fs.constants.W_OK);
      res.json({ ok: true, role });
    } catch (_error) {
      res.status(503).json({ ok: false, role });
    }
  });

  // The footer of the interface goes through browser and proxy caches; this
  // JSON never does, and also returns the raw image SHA: it is the one check
  // that cannot show a stale value.
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      version: version.version,
      // The IMAGE commit. Read it with appMounted: when true, it describes an
      // image that does not provide the running code.
      commit: version.commit,
      commitShort: version.commitShort,
      // Only updated when a tag is published: frozen on "unstable" images.
      packageVersion,
      appMounted: version.codeMounted,
      // true when the data folder is a separate mount. It decides whether the
      // code mount can be removed without losing the configuration: data kept
      // inside the /app mount would stay on disk but nothing would serve it.
      dataMounted: isMountedPath(settings.dataDir),
      // A position inside the container, never a host path.
      dataPath: settings.dataDir,
      startedAt: version.startedAt
    });
  });
}

module.exports = { registerSystemRoutes };
