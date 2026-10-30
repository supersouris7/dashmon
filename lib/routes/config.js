"use strict";
// Dashboard configuration API.
//
//   GET   /api/config  the whole config, with its revision as ETag
//   PUT   /api/config  replaces the config (If-Match: optimistic locking)
//   PATCH /api/config  replaces some top-level fields
//   POST  /api/usage   counts one click on a service ("most used" sorting)
//
// Widget secrets never leave the server: GET returns masks, and PUT / PATCH
// put the stored secrets back in place of the masks they receive.
//
// The routes know neither the file nor the schema: both are injected by the
// application. Every handler reads, checks and writes synchronously, so a
// write can never interleave with another request.
// Key under which a service's clicks are counted. Must stay identical to
// serviceUsageKey() in public/js/state.js, which sends it.
function usageKey(service) {
  return service.url || `${service.name || ""}|${service.host || ""}|${service.category || ""}`;
}

function registerConfigRoutes(
  app,
  {
    readConfig,
    writeConfig,
    revision,
    normalize,
    ensureHostIds,
    forBrowser,
    restoreSecrets,
    logger = console
  }
) {
  const invalid = value => !value || typeof value !== "object" || Array.isArray(value);
  const conflict = (req, current) =>
    req.get("If-Match") && req.get("If-Match") !== revision(current);
  const rejectConflict = res =>
    res.status(412).json({ error: "La configuration a changé ; rechargez avant d'enregistrer" });

  app.get("/api/config", (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      ensureHostIds();
      const config = readConfig();
      res.set("ETag", revision(config));
      res.json(forBrowser(config));
    } catch (error) {
      logger.error("Reading config failed:", error);
      res.status(500).json({ error: "Lecture de config.json impossible" });
    }
  });

  app.put("/api/config", (req, res) => {
    try {
      const config = req.body;
      if (invalid(config)) return res.status(400).json({ error: "Configuration invalide" });
      const current = readConfig();
      if (conflict(req, current)) return rejectConflict(res);
      const output = normalize(restoreSecrets(config, current));
      if (req.get("If-Match") && req.get("X-Dashmon-Replace-Usage") !== "1")
        output.usageCounts = current.usageCounts || {};
      writeConfig(output);
      res.set("ETag", revision(readConfig()));
      res.json({ ok: true });
    } catch (error) {
      logger.error("Writing config failed:", error);
      res.status(500).json({ error: "Écriture de config.json impossible" });
    }
  });

  app.patch("/api/config", (req, res) => {
    try {
      const patch = req.body;
      if (invalid(patch))
        return res.status(400).json({ error: "Correctif de configuration invalide" });
      const current = readConfig();
      if (conflict(req, current)) return rejectConflict(res);
      const config = { ...current };
      // A patch must never reach the object prototype: these keys are not
      // part of the public schema.
      for (const key of Object.keys(patch)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        config[key] = patch[key];
      }
      const output = normalize(restoreSecrets(config, current));
      writeConfig(output);
      res.set("ETag", revision(readConfig()));
      res.json({ ok: true });
    } catch (error) {
      logger.error("Patching config failed:", error);
      res.status(500).json({ error: "Écriture de config.json impossible" });
    }
  });

  // Light route (small body) usable while the page navigates away
  // (sendBeacon / keepalive). The write is synchronous so that it stays atomic
  // against concurrent PUT /api/config. Click counts are excluded from the
  // revision: counting a click never invalidates an open editor.
  app.post("/api/usage", (req, res) => {
    try {
      const key = req.body && typeof req.body.key === "string" ? req.body.key.trim() : "";
      if (!key || key.length > 200) return res.status(400).json({ error: "Clé invalide" });

      const config = readConfig();
      // Only existing services are counted: arbitrary keys would make the
      // config grow without limit.
      const services = Array.isArray(config.services) ? config.services : [];
      if (!services.some(service => service && usageKey(service) === key)) {
        return res.status(400).json({ error: "Clé invalide" });
      }
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
      logger.error("Counting usage failed:", error);
      res.status(500).json({ error: "Incrément du compteur impossible" });
    }
  });
}
module.exports = { registerConfigRoutes, usageKey };
