"use strict";

// Les routes ne connaissent ni le fichier ni le schema : ces responsabilites
// sont injectees par l'application. Les operations synchrones sur le magasin
// restent groupees avant toute attente afin de conserver l'atomicite actuelle.
function registerConfigRoutes(
  app,
  {
    readConfig,
    writeConfig,
    revision,
    normalize,
    replicate,
    ensureHostIds,
    withCacheKeys,
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
      res.json(withCacheKeys(config));
    } catch (error) {
      logger.error("Lecture config:", error);
      res.status(500).json({ error: "Lecture de config.json impossible" });
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const config = req.body;
      if (invalid(config)) return res.status(400).json({ error: "Configuration invalide" });
      const current = readConfig();
      if (conflict(req, current)) return rejectConflict(res);
      const output = normalize(config);
      if (req.get("If-Match") && req.get("X-Dashmon-Replace-Usage") !== "1")
        output.usageCounts = current.usageCounts || {};
      writeConfig(output);
      res.set("ETag", revision(readConfig()));
      res.json({ ok: true, replication: await replicate(output) });
    } catch (error) {
      logger.error("Écriture config:", error);
      res.status(500).json({ error: "Écriture de config.json impossible" });
    }
  });

  app.patch("/api/config", async (req, res) => {
    try {
      const patch = req.body;
      if (invalid(patch))
        return res.status(400).json({ error: "Correctif de configuration invalide" });
      const config = readConfig();
      if (conflict(req, config)) return rejectConflict(res);
      // Ne jamais laisser un correctif modifier le prototype de l'objet de
      // configuration : ces cles ne font pas partie du schema public.
      for (const key of Object.keys(patch)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        config[key] = patch[key];
      }
      const output = normalize(config);
      writeConfig(output);
      res.set("ETag", revision(readConfig()));
      res.json({ ok: true, replication: await replicate(output) });
    } catch (error) {
      logger.error("Écriture config (patch):", error);
      res.status(500).json({ error: "Écriture de config.json impossible" });
    }
  });
}
module.exports = { registerConfigRoutes };
