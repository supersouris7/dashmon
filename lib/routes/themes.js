"use strict";
// Themes API: list, export, import and delete custom themes.
//
//   GET    /api/themes             native and custom themes
//   GET    /api/themes/:id/export  one theme as a downloadable JSON file
//   POST   /api/themes/import      adds a custom theme (JSON body)
//   DELETE /api/themes/:id         removes a custom theme

const { apiError } = require("../http/api-errors");
const fs = require("fs");
const { normalizeTheme, sanitizeThemeId, readTheme, readThemes, themeFile } = require("../themes");

function registerThemeRoutes(app, { nativeDir, customDir, log }) {
  app.get("/api/themes", (_req, res) => {
    try {
      const native = readThemes(nativeDir);
      const custom = readThemes(customDir);
      res.set("Cache-Control", "no-store");
      res.json({ native, custom });
    } catch (error) {
      log.error("Reading themes failed:", error);
      res.status(500).json({ ...apiError("themes_read_failed") });
    }
  });

  app.get("/api/themes/:id/export", (req, res) => {
    try {
      const id = sanitizeThemeId(req.params.id);
      if (!id) return res.status(400).json({ ...apiError("invalid_theme_id") });

      const theme = readTheme(nativeDir, id) || readTheme(customDir, id);
      if (!theme) return res.status(404).json({ ...apiError("theme_not_found") });

      res.set("Content-Disposition", `attachment; filename="theme-${id}.json"`);
      res.set("Content-Type", "application/json");
      res.send(JSON.stringify(theme, null, 2) + "\n");
    } catch (error) {
      log.error("Theme export failed:", error);
      res.status(500).json({ ...apiError("theme_export_failed") });
    }
  });

  app.post("/api/themes/import", (req, res) => {
    try {
      const theme = normalizeTheme(req.body);
      if (!theme) {
        log.warn("Theme import rejected: invalid JSON or missing variables");
        return res.status(400).json({ ...apiError("invalid_theme") });
      }

      // A custom theme cannot shadow a native one.
      if (fs.existsSync(themeFile(nativeDir, theme.id))) {
        log.warn(`Theme import rejected: "${theme.id}" is reserved by a native theme`);
        return res
          .status(409)
          .json({ error: `L'identifiant « ${theme.id} » est réservé par un thème natif` });
      }

      fs.writeFileSync(
        themeFile(customDir, theme.id),
        JSON.stringify(theme, null, 2) + "\n",
        "utf8"
      );
      log.info(`Theme imported: ${theme.id}.json`);
      res.status(201).json({ ok: true, file: `${theme.id}.json` });
    } catch (error) {
      log.error("Theme import failed:", error);
      res.status(500).json({ ...apiError("theme_import_failed") });
    }
  });

  app.delete("/api/themes/:id", (req, res) => {
    try {
      const id = sanitizeThemeId(req.params.id);
      if (!id) return res.status(400).json({ ...apiError("invalid_theme_id") });

      if (fs.existsSync(themeFile(nativeDir, id))) {
        return res.status(403).json({ ...apiError("builtin_theme") });
      }

      const target = themeFile(customDir, id);
      if (!fs.existsSync(target)) {
        return res.status(404).json({ ...apiError("theme_not_found") });
      }

      fs.unlinkSync(target);
      log.info(`Theme deleted: ${id}.json`);
      res.json({ ok: true });
    } catch (error) {
      log.error("Theme deletion failed:", error);
      res.status(500).json({ ...apiError("theme_delete_failed") });
    }
  });
}

module.exports = { registerThemeRoutes };
