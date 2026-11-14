"use strict";
// Manifest keys specific to the supervision plugins, on top of the ones every
// plugin shares (lib/widgets/registry.js). Everything is optional; an invalid
// value refuses the plugin, a missing one takes its default.
//
//   order      position among the cards (built-in cards: 10 to 60; default 100)
//   showEmpty  true: the card is drawn even without a report (install hint)
//   script     host script of deploy/ that writes the report (outdated notice,
//              install help): "apt-updates"
//   guide      documentation: a file of docs/ ("APT_UPDATES.md") or an https URL
//   files      report files, path chosen by the administrator:
//              { "report": { "env": "APT_UPDATES_REPORT_FILE", "default": "apt-updates.json" } }
//   modules    other browser modules of the folder the client imports
//   settings   host settings form: { key, title, show, help, fields }

const { LEGACY_KEYS, FIELD_KEY_PATTERN } = require("../config/plugin-prefs");

const FILE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const TEXT_KEY = /^[a-zA-Z0-9_.-]{1,60}$/;

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function bounded(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

// A text of the form: a key of the manifest strings (or of the interface).
function textKey(value) {
  return typeof value === "string" && TEXT_KEY.test(value) ? value : "";
}

function validateSubField(raw, at, errors) {
  if (!plain(raw) || !FIELD_KEY_PATTERN.test(String(raw.key || ""))) {
    errors.push(`${at}: "key" must match ${FIELD_KEY_PATTERN}`);
    return null;
  }
  const type = raw.type || "text";
  if (type !== "text" && type !== "path") {
    errors.push(`${at}: type must be "text" or "path"`);
    return null;
  }
  return {
    key: raw.key,
    type,
    label: textKey(raw.label) || raw.key,
    maxLength: type === "path" ? 4096 : bounded(raw.maxLength, 100, 1, 300),
    required: raw.required === true
  };
}

function validateSettingField(raw, index, errors) {
  const at = `settings.fields[${index}]`;
  if (!plain(raw) || !FIELD_KEY_PATTERN.test(String(raw.key || "")) || raw.key === "enabled") {
    errors.push(`${at}: "key" must match ${FIELD_KEY_PATTERN} and not be "enabled"`);
    return null;
  }
  const field = {
    key: raw.key,
    type: raw.type || "text",
    label: textKey(raw.label) || raw.key,
    placeholder: textKey(raw.placeholder)
  };
  if (field.type === "text") {
    field.maxLength = bounded(raw.maxLength, 100, 1, 300);
  } else if (field.type === "choices") {
    field.maxLength = bounded(raw.maxLength, 100, 1, 200);
    field.max = bounded(raw.max, 20, 1, 50);
    // Values offered from the plugin's report: { list: "disks", key: "device" }.
    const detect = plain(raw.detect);
    field.detect =
      detect &&
      FIELD_KEY_PATTERN.test(String(detect.list)) &&
      FIELD_KEY_PATTERN.test(String(detect.key))
        ? { list: detect.list, key: detect.key }
        : null;
    field.detectedLabel = textKey(raw.detectedLabel);
  } else if (field.type === "list") {
    field.max = bounded(raw.max, 20, 1, 50);
    field.add = textKey(raw.add);
    field.up = textKey(raw.up);
    field.down = textKey(raw.down);
    const subs = Array.isArray(raw.fields) ? raw.fields.slice(0, 8) : [];
    field.fields = subs.map((sub, i) => validateSubField(sub, `${at}.fields[${i}]`, errors));
    if (!field.fields.length || field.fields.some(sub => !sub)) {
      errors.push(`${at}: a "list" needs valid "fields"`);
      return null;
    }
    field.unique = field.fields.some(sub => sub.key === raw.unique) ? raw.unique : "";
  } else {
    errors.push(`${at}: unknown type "${field.type}" (text, choices, list)`);
    return null;
  }
  return field;
}

function validateSettings(raw, errors) {
  const src = raw == null ? {} : plain(raw);
  if (!src) {
    errors.push("settings: object expected");
    return null;
  }
  // The historical key of a card that was part of the core; other plugins
  // store their settings in monitoring.plugins.<id>.
  if (src.key != null && !LEGACY_KEYS.includes(src.key)) {
    errors.push(`settings.key: reserved to the built-in cards (${LEGACY_KEYS.join(", ")})`);
    return null;
  }
  const fields = [];
  const seen = new Set();
  for (const [index, item] of (Array.isArray(src.fields) ? src.fields : [])
    .slice(0, 12)
    .entries()) {
    const field = validateSettingField(item, index, errors);
    if (!field) continue;
    if (seen.has(field.key)) {
      errors.push(`settings.fields: duplicate key "${field.key}"`);
      continue;
    }
    seen.add(field.key);
    fields.push(field);
  }
  return {
    key: src.key || null,
    title: textKey(src.title),
    show: textKey(src.show),
    help: textKey(src.help),
    fields
  };
}

function validateFiles(raw, errors) {
  const out = {};
  if (raw == null) return out;
  if (!plain(raw)) {
    errors.push("files: object expected");
    return out;
  }
  for (const [name, spec] of Object.entries(raw).slice(0, 8)) {
    // The variable only names a path; it must say so (..._FILE).
    if (
      !FIELD_KEY_PATTERN.test(name) ||
      !plain(spec) ||
      !FILE_NAME.test(String(spec.default || "")) ||
      (spec.env != null && !/^[A-Z][A-Z0-9_]{0,60}_FILE$/.test(String(spec.env)))
    ) {
      errors.push(`files.${name}: { "env": "..._FILE", "default": "<file name>" } expected`);
      continue;
    }
    out[name] = { env: spec.env || "", default: spec.default };
  }
  return out;
}

function validateSupervisionManifest(raw, errors) {
  const modules = Array.isArray(raw.modules) ? raw.modules.slice(0, 20) : [];
  if (modules.some(name => typeof name !== "string" || !/^[a-zA-Z0-9_-]{1,60}\.mjs$/.test(name)))
    errors.push('modules: bare ".mjs" file names expected');
  const guide = typeof raw.guide === "string" ? raw.guide : "";
  if (guide && !/^[A-Z][A-Z0-9_]{0,40}\.md$/.test(guide) && !/^https:\/\/\S{1,300}$/.test(guide))
    errors.push('guide: a file of docs/ ("NAME.md") or an https URL expected');
  const script = typeof raw.script === "string" ? raw.script : "";
  if (script && !/^[a-z][a-z0-9-]{0,40}$/.test(script)) errors.push("script: invalid name");
  return {
    order: bounded(raw.order, 100, 0, 1000),
    showEmpty: raw.showEmpty === true,
    script,
    guide,
    files: validateFiles(raw.files, errors),
    modules,
    settings: validateSettings(raw.settings, errors)
  };
}

module.exports = { validateSupervisionManifest };
