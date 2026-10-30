"use strict";
// Service icons: PNG images uploaded by the user into the data folder.
//
//   GET    /api/icons        names of the stored images
//   POST   /api/icons        uploads a PNG (raw body, name in X-File-Name)
//   DELETE /api/icons/:file  removes an image
//   GET    /icons/<file>     serves an image

const express = require("express");
const fs = require("fs");
const path = require("path");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_DIMENSION = 8192;
const MAX_PIXELS = 64 * 1024 * 1024;

// Width and height from the IHDR chunk, which always follows the signature.
function pngSize(buffer) {
  try {
    if (buffer.length < 24) return { width: 0, height: 0 };
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } catch (_error) {
    return { width: 0, height: 0 };
  }
}

// Keeps a safe file name ([a-zA-Z0-9._-]) and never overwrites an existing
// image: "logo.png" becomes "logo-2.png", "logo-3.png"...
function availableFileName(dir, requested) {
  const base =
    path
      .basename(requested)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image.png";
  const stem = path.parse(base).name || "image";
  let filename = `${stem}.png`;
  let counter = 2;
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${stem}-${counter++}.png`;
  }
  return filename;
}

function registerIconRoutes(app, { iconsDir, log }) {
  const pngBody = express.raw({ type: "image/png", limit: "10mb" });

  app.get("/api/icons", (_req, res) => {
    try {
      fs.mkdirSync(iconsDir, { recursive: true });
      const files = fs
        .readdirSync(iconsDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      res.set("Cache-Control", "no-store");
      res.json(files);
    } catch (error) {
      log.error("Reading icons failed:", error);
      res.status(500).json({ error: "Lecture des images impossible" });
    }
  });

  app.post("/api/icons", pngBody, (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length < 8) {
        log.warn("Icon upload rejected: empty or too short body");
        return res.status(400).json({ error: "Image PNG invalide" });
      }
      if (!req.body.subarray(0, 8).equals(PNG_SIGNATURE)) {
        log.warn("Icon upload rejected: missing PNG signature");
        return res.status(400).json({ error: "Le fichier n'est pas un PNG valide" });
      }

      const { width, height } = pngSize(req.body);
      if (
        !width ||
        !height ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION ||
        width * height > MAX_PIXELS
      ) {
        log.warn(`Icon upload rejected: PNG too large (${width}×${height})`);
        return res
          .status(400)
          .json({ error: `Image trop grande (max ${MAX_DIMENSION}×${MAX_DIMENSION})` });
      }

      fs.mkdirSync(iconsDir, { recursive: true });
      const filename = availableFileName(
        iconsDir,
        decodeURIComponent(req.get("X-File-Name") || "image.png")
      );
      fs.writeFileSync(path.join(iconsDir, filename), req.body);
      log.info(`Icon uploaded: ${filename} (${req.body.length} bytes)`);
      res.status(201).json({ ok: true, file: filename });
    } catch (error) {
      log.error("Icon upload failed:", error);
      res.status(500).json({ error: "Import de l'image impossible" });
    }
  });

  app.delete("/api/icons/:file", (req, res) => {
    try {
      const requested = decodeURIComponent(req.params.file || "");
      const filename = path.basename(requested);
      // A name with a directory part ("../x.png") is refused, not reduced.
      if (!filename || filename !== requested || !filename.toLowerCase().endsWith(".png")) {
        return res.status(400).json({ error: "Nom d'image invalide" });
      }

      const target = path.join(iconsDir, filename);
      if (!fs.existsSync(target)) {
        return res.status(404).json({ error: "Image introuvable" });
      }

      fs.unlinkSync(target);
      log.info(`Icon deleted: ${filename}`);
      res.json({ ok: true, file: filename });
    } catch (error) {
      log.error("Icon deletion failed:", error);
      res.status(500).json({ error: "Suppression de l'image impossible" });
    }
  });

  app.use("/icons", express.static(iconsDir, { dotfiles: "deny", index: false, maxAge: "5m" }));
}

module.exports = { registerIconRoutes };
