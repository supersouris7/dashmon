"use strict";
// Dashboard configuration API.
//
//   GET   /api/config  the whole config, with its revision as ETag
//   PUT   /api/config  replaces the config (If-Match: optimistic locking)
//   PATCH /api/config  replaces some top-level fields
//   POST  /api/usage   counts one click on a service ("most used" sorting),
//                      written in groups (USAGE_FLUSH_DELAY)
//
// Widget secrets never leave the server: GET returns masks, and PUT / PATCH
// put the stored secrets back in place of the masks they receive.
//
// The routes know neither the file nor the schema: both are injected by the
// application. Every handler reads, checks and writes synchronously, so a
// write can never interleave with another request.
// Key under which a service's clicks are counted. Must stay identical to
// serviceUsageKey() in public/js/state.js, which sends it.
const { apiError } = require("../http/api-errors");

function usageKey(service) {
  return service.url || `${service.name || ""}|${service.host || ""}|${service.category || ""}`;
}

// Clicks are grouped in memory and written at most this often: one rewrite of
// config.json per click wore out the SD card of a small host for nothing.
const USAGE_FLUSH_DELAY = 30000;

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
    logger = console,
    usageFlushDelay = USAGE_FLUSH_DELAY
  }
) {
  const invalid = value => !value || typeof value !== "object" || Array.isArray(value);
  const conflict = (req, current) =>
    req.get("If-Match") && req.get("If-Match") !== revision(current);
  const rejectConflict = res => res.status(412).json({ ...apiError("config_conflict") });

  // Clicks not yet written: key -> count to add.
  const pendingUsage = new Map();
  let usageTimer = null;
  const withPendingUsage = config => {
    if (!pendingUsage.size) return config;
    const counts = { ...countsOf(config) };
    for (const [key, added] of pendingUsage) {
      const n = Number(counts[key]);
      counts[key] = (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0) + added;
    }
    return { ...config, usageCounts: counts };
  };
  function flushUsage() {
    clearTimeout(usageTimer);
    usageTimer = null;
    if (!pendingUsage.size) return;
    try {
      writeConfig(withPendingUsage(readConfig()));
      pendingUsage.clear();
    } catch (error) {
      logger.error("Writing usage counts failed:", error);
    }
  }

  app.get("/api/config", (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      ensureHostIds();
      const config = readConfig();
      res.set("ETag", revision(config));
      res.json(forBrowser(withPendingUsage(config)));
    } catch (error) {
      logger.error("Reading config failed:", error);
      res.status(500).json({ ...apiError("config_read_failed") });
    }
  });

  app.put("/api/config", (req, res) => {
    try {
      const config = req.body;
      if (invalid(config)) return res.status(400).json({ ...apiError("invalid_config") });
      const current = readConfig();
      if (conflict(req, current)) return rejectConflict(res);
      const output = normalize(restoreSecrets(config, current));
      if (req.get("If-Match") && req.get("X-Dashmon-Replace-Usage") !== "1")
        output.usageCounts = current.usageCounts || {};
      // Counts replaced on purpose (import, reset): clicks made before are
      // part of what was replaced.
      if (req.get("X-Dashmon-Replace-Usage") === "1") pendingUsage.clear();
      writeConfig(output);
      res.set("ETag", revision(readConfig()));
      res.json({ ok: true });
    } catch (error) {
      logger.error("Writing config failed:", error);
      res.status(500).json({ ...apiError("config_write_failed") });
    }
  });

  app.patch("/api/config", (req, res) => {
    try {
      const patch = req.body;
      if (invalid(patch)) return res.status(400).json({ ...apiError("invalid_config_patch") });
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
      res.status(500).json({ ...apiError("config_write_failed") });
    }
  });

  // Light route (small body) usable while the page navigates away
  // (sendBeacon / keepalive). The click is added to the pending counts, written
  // with the next flush (or at shutdown). Click counts are excluded from the
  // revision: counting a click never invalidates an open editor.
  app.post("/api/usage", (req, res) => {
    try {
      const key = req.body && typeof req.body.key === "string" ? req.body.key.trim() : "";
      if (!key || key.length > 200) return res.status(400).json({ ...apiError("invalid_key") });

      const config = readConfig();
      // Only existing services are counted: arbitrary keys would make the
      // config grow without limit.
      const services = Array.isArray(config.services) ? config.services : [];
      if (!services.some(service => service && usageKey(service) === key)) {
        return res.status(400).json({ ...apiError("invalid_key") });
      }
      pendingUsage.set(key, (pendingUsage.get(key) || 0) + 1);
      if (!usageTimer) {
        usageTimer = setTimeout(flushUsage, usageFlushDelay);
        usageTimer.unref?.();
      }
      res.json({ ok: true });
    } catch (error) {
      logger.error("Counting usage failed:", error);
      res.status(500).json({ ...apiError("usage_increment_failed") });
    }
  });

  // Called at shutdown so that no click is lost.
  return { flushUsage };
}

function countsOf(config) {
  const counts = config.usageCounts;
  return counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {};
}

module.exports = { registerConfigRoutes, usageKey, USAGE_FLUSH_DELAY };
