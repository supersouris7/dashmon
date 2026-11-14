"use strict";
// Host settings schemas of the bundled supervision plugins, read from their
// manifests as the server does, for the config tests (server and browser
// normalisation). bundledMetas() gives the shape GET /api/supervisions
// publishes, to register in the browser registry.
const fs = require("fs");
const path = require("path");
const { validateSupervisionManifest } = require("../../lib/supervisions/manifest");

const ROOT = path.join(__dirname, "..", "..", "supervisions");

function bundledMetas() {
  return fs
    .readdirSync(ROOT)
    .filter(name => !name.startsWith("_"))
    .sort()
    .map(id => {
      const raw = JSON.parse(fs.readFileSync(path.join(ROOT, id, "manifest.json"), "utf8"));
      const errors = [];
      const extra = validateSupervisionManifest(raw, errors);
      if (errors.length) throw new Error(id + ": " + errors.join("; "));
      return { id, label: raw.label, icon: raw.icon, ...extra };
    });
}

function bundledSchemas() {
  return bundledMetas().map(meta => ({
    id: meta.id,
    key: meta.settings.key,
    fields: meta.settings.fields
  }));
}

module.exports = { bundledMetas, bundledSchemas };
