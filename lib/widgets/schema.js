"use strict";
// Generic handling of a widget configuration, driven by the `config` list of
// its manifest.
//
// The exact shape of a widget config used to be rewritten by hand in four
// places (server API output, editor defaults, state normalisation, save
// serialisation), and any mismatch lost the widget on save. Here the shape
// comes from a single source, the manifest: adding a field there is enough.

const { isPlainObject } = require("./registry");

const SECRET_PREFIX = "aes1.";

function str(value, max) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, max);
}

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

// Configuration value of the field, or "" when missing.
function fieldValue(widget, key) {
  return widget && widget[key] !== undefined ? widget[key] : "";
}

// Defaults from the manifest: the starting point of any new config.
function defaultConfig(manifest) {
  const config = { type: manifest.id };
  for (const field of manifest.config || []) {
    config[field.key] = field.default === undefined ? "" : field.default;
  }
  return config;
}

// "Trusted" normalisation: truncates, coerces and fills in defaults. Used
// by the browser (config received from the server) and by the editor.
function normalizeConfig(manifest, widget) {
  if (!isPlainObject(widget) || widget.type !== manifest.id) return null;
  const out = { type: manifest.id };
  for (const field of manifest.config || []) {
    const raw = fieldValue(widget, field.key);
    if (field.type === "checkbox") {
      out[field.key] = raw === true || raw === "true" || raw === "on" || raw === 1;
    } else if (field.type === "number") {
      let n = Number(raw);
      if (!Number.isFinite(n)) n = Number(field.default) || 0;
      out[field.key] = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
    } else if (field.type === "select") {
      const wanted = str(raw, 100);
      const known = (field.options || []).some(option => option.value === wanted);
      out[field.key] = known ? wanted : str(field.default, 100);
    } else {
      // An already encrypted secret is kept as is (never re-encrypted by the
      // browser): only the server holds the master key.
      out[field.key] = isEncryptedSecret(raw) ? raw : str(raw, field.maxLength);
    }
  }
  return out;
}

// Reuses an existing config when the widget type changes, or on first
// setup: only the keys both types share are kept.
function inheritConfig(manifest, previous) {
  const base = defaultConfig(manifest);
  if (!isPlainObject(previous) || previous.type !== manifest.id) return base;
  for (const field of manifest.config || []) {
    if (previous[field.key] !== undefined) base[field.key] = previous[field.key];
  }
  return base;
}

module.exports = {
  SECRET_PREFIX,
  isEncryptedSecret,
  fieldValue,
  defaultConfig,
  normalizeConfig,
  inheritConfig
};
