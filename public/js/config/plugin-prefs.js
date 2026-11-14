// Host settings of the supervision plugins (supervisions/<id>/, settings in
// their manifest), as stored in config.json.
//
// A plugin's settings live in monitoring.plugins.<id>. The cards that were
// part of the core before the plugins keep their historical key
// (monitoring.aptUpdates, monitoring.smart...): config.json, the host scripts
// that read it (deploy/directory-sizes.sh) and agents not yet updated go on
// working unchanged. That list is closed: LEGACY_KEYS.
//
// Rules, mirrored by lib/config/plugin-prefs.js on the server
// (test/config-parity.test.js):
//   - a card is shown by default: only { enabled: false } and non-empty
//     fields are stored;
//   - a plugin whose schema is known is sanitised field by field;
//   - one whose schema is unknown (plugin removed, registry not loaded yet) is
//     preserved within bounds, so reinstalling it finds its settings again.

import { sanitizeText } from "./sanitize.js";

export const LEGACY_KEYS = Object.freeze([
  "wireguard",
  "smart",
  "aptUpdates",
  "opencode",
  "claude",
  "directorySizes"
]);
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;
const MAX_PLUGINS = 50;
const MAX_ITEMS = 50;

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// Absolute path without control characters: a host script receives it.
export function cleanPath(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    value.length <= 4096 &&
    [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    ? value
    : "";
}

function listValue(field, value) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(value) ? value : []) {
    if (!plain(item)) continue;
    const row = {};
    let valid = true;
    for (const sub of field.fields) {
      const clean =
        sub.type === "path" ? cleanPath(item[sub.key]) : sanitizeText(item[sub.key], sub.maxLength);
      if (sub.required && !clean) {
        valid = false;
        break;
      }
      row[sub.key] = clean;
    }
    if (!valid) continue;
    if (field.unique) {
      if (seen.has(row[field.unique])) continue;
      seen.add(row[field.unique]);
    }
    out.push(row);
    if (out.length >= field.max) break;
  }
  return out;
}

function fieldValue(field, value) {
  if (field.type === "choices")
    return Array.isArray(value)
      ? [...new Set(value.map(item => sanitizeText(item, field.maxLength)).filter(Boolean))].slice(
          0,
          field.max
        )
      : [];
  if (field.type === "list") return listValue(field, value);
  return sanitizeText(value, field.maxLength);
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : value !== "";
}

// Stored shape of one plugin's settings, or undefined when nothing differs
// from the defaults.
export function sanitizePrefs(raw, schema) {
  const src = plain(raw);
  if (!src) return undefined;
  const out = { enabled: src.enabled !== false };
  let meaningful = !out.enabled;
  for (const field of schema.fields) {
    const value = fieldValue(field, src[field.key]);
    if (!hasValue(value)) continue;
    out[field.key] = value;
    meaningful = true;
  }
  return meaningful ? out : undefined;
}

// Settings of a plugin whose schema is unknown: texts, lists of texts and
// lists of flat records, bounded.
export function preservePrefs(raw) {
  const src = plain(raw);
  if (!src) return undefined;
  const out = { enabled: src.enabled !== false };
  let meaningful = !out.enabled;
  for (const [key, value] of Object.entries(src).slice(0, 24)) {
    if (key === "enabled" || !FIELD_KEY_PATTERN.test(key)) continue;
    let kept;
    if (typeof value === "string") kept = sanitizeText(value, 4096);
    else if (Array.isArray(value))
      kept = value
        .slice(0, MAX_ITEMS)
        .map(item => {
          if (typeof item === "string") return sanitizeText(item, 4096);
          const record = plain(item);
          if (!record) return "";
          const row = {};
          for (const [name, text] of Object.entries(record).slice(0, 8))
            if (FIELD_KEY_PATTERN.test(name) && typeof text === "string")
              row[name] = sanitizeText(text, 4096);
          return Object.keys(row).length ? row : "";
        })
        .filter(item => item !== "");
    else continue;
    if (!hasValue(kept)) continue;
    out[key] = kept;
    meaningful = true;
  }
  return meaningful ? out : undefined;
}

// Settings of every plugin, read from a raw monitoring object, as the fields
// to put in the stored one: { aptUpdates: {...}, plugins: { <id>: {...} } }.
// schemas: [{ id, key, fields }] of the installed plugins (key: legacy key
// or null).
export function sanitizePluginSettings(raw, schemas = []) {
  const out = {};
  const plugins = {};
  const handled = new Set();
  const rawPlugins = plain(raw.plugins) || {};
  for (const schema of schemas) {
    const source = schema.key ? raw[schema.key] : rawPlugins[schema.id];
    const prefs = sanitizePrefs(source, schema);
    if (schema.key) handled.add(schema.key);
    else handled.add("plugins." + schema.id);
    if (!prefs) continue;
    if (schema.key) out[schema.key] = prefs;
    else plugins[schema.id] = prefs;
  }
  for (const key of LEGACY_KEYS) {
    if (handled.has(key)) continue;
    const prefs = preservePrefs(raw[key]);
    if (prefs) out[key] = prefs;
  }
  for (const [id, value] of Object.entries(rawPlugins).slice(0, MAX_PLUGINS)) {
    if (!PLUGIN_ID_PATTERN.test(id) || handled.has("plugins." + id)) continue;
    const prefs = preservePrefs(value);
    if (prefs) plugins[id] = prefs;
  }
  if (Object.keys(plugins).length) out.plugins = plugins;
  return out;
}

// Editor shape of one plugin's settings: every field present, defaults filled.
export function workingPrefs(raw, schema) {
  const stored = schema ? sanitizePrefs(raw, schema) : preservePrefs(raw);
  const out = { enabled: true, ...(stored || {}) };
  for (const field of schema ? schema.fields : []) {
    if (out[field.key] === undefined) out[field.key] = field.type === "text" ? "" : [];
  }
  return out;
}
