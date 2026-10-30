"use strict";
// Dashmon plugin engine: discovers, validates and loads plugins (tile widgets
// today; host metrics or probes could follow).
//
// Principles:
//  - a plugin is a folder plus a declarative manifest.json;
//  - a broken plugin MUST NOT prevent the application from starting;
//  - no dependency, no build step, no mandatory import: a contributor copies a
//    folder, edits three files, and is done.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

// Identifiers: lowercase letters, digits and dashes, 32 characters at most.
// "_template" and other folders starting with a forbidden character are not
// plugins.
const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

const FIELD_TYPES = new Set(["text", "secret", "select", "number", "checkbox"]);

const MAX_FIELDS = 24;
const MAX_OPTIONS = 32;
const MAX_STRINGS = 200;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value, max) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, max);
}

function asLocalized(value) {
  if (isPlainObject(value)) {
    const out = {};
    for (const lang of ["fr", "en"]) {
      if (value[lang] != null) out[lang] = str(value[lang], 200);
    }
    return Object.keys(out).length ? out : null;
  }
  if (typeof value === "string" && value.trim()) return { fr: value.trim(), en: value.trim() };
  return null;
}

function validateField(raw, index, errors) {
  const at = `config[${index}]`;
  if (!isPlainObject(raw)) {
    errors.push(`${at}: invalid field`);
    return null;
  }
  const key = str(raw.key, 40);
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
    errors.push(`${at}: "key" must match ^[a-z][a-z0-9_]{0,39}$`);
    return null;
  }
  const type = str(raw.type, 20) || "text";
  if (!FIELD_TYPES.has(type)) {
    errors.push(`${at}: unknown type "${type}" (${[...FIELD_TYPES].join(", ")})`);
    return null;
  }
  const field = {
    key,
    type,
    label: str(raw.label, 80) || key,
    default: raw.default === undefined ? "" : raw.default
  };

  if (type === "select") {
    const options = Array.isArray(raw.options) ? raw.options.slice(0, MAX_OPTIONS) : [];
    if (!options.length) {
      errors.push(`${at}: a "select" field requires options`);
      return null;
    }
    field.options = options.map(option => ({
      value: str(option && option.value, 100),
      label: str(option && option.label, 100) || str(option && option.value, 100)
    }));
  }

  if (type === "number") {
    const min = Number(raw.min);
    const max = Number(raw.max);
    field.min = Number.isFinite(min) ? min : 0;
    field.max = Number.isFinite(max) ? max : 1000;
  }

  // Maximum length, a safety bound: the value is stored in config.json, so it
  // persists and is read back on every GET /api/config.
  const maxLength = Number(raw.maxLength);
  field.maxLength =
    Number.isFinite(maxLength) && maxLength > 0
      ? Math.min(Math.trunc(maxLength), 2000)
      : type === "secret"
        ? 2000
        : 200;

  if (raw.placeholder != null) field.placeholder = str(raw.placeholder, 120);
  if (raw.title != null) field.title = asLocalized(raw.title);

  // Conditional visibility: {"key":"mode","equals":"tcp"}
  if (isPlainObject(raw.when)) {
    const whenKey = str(raw.when.key, 40);
    if (/^[a-z][a-z0-9_]{0,39}$/.test(whenKey)) {
      field.when = { key: whenKey, equals: str(raw.when.equals, 100) };
    }
  }
  return field;
}

function validateManifest(id, raw, errors) {
  if (!isPlainObject(raw)) {
    errors.push("manifest.json: object expected");
    return null;
  }
  if (raw.id != null && str(raw.id, 40) !== id) {
    errors.push(`manifest.json: "id" (${str(raw.id, 40)}) does not match the folder (${id})`);
    return null;
  }
  // A slot the core does not know is a typo, not an idea: the plugin is
  // refused rather than loaded as a widget nobody can select.
  if (raw.defaultFor != null && raw.defaultFor !== "" && raw.defaultFor !== "link") {
    errors.push(
      `manifest.json: unknown "defaultFor" (${str(raw.defaultFor, 40)}), only "link" exists`
    );
    return null;
  }

  const label = asLocalized(raw.label) || { fr: id, en: id };
  const manifest = {
    id,
    version: str(raw.version, 20) || "0.0.0",
    label,
    description: asLocalized(raw.description),
    // Re-check period in ms. Missing or 0: the engine default (5 minutes).
    interval:
      Number.isFinite(Number(raw.interval)) && Number(raw.interval) > 0
        ? Number(raw.interval)
        : 5 * 60 * 1000,
    // "service": one cache entry per service (default).
    // "config":  one cache entry shared by identical configs (e.g. Docker).
    cacheKey: raw.cacheKey === "config" ? "config" : "service",
    // "link": this plugin handles the services without a widget, i.e. plain
    // web links. Only one plugin can claim it.
    defaultFor: raw.defaultFor === "link" ? "link" : "",
    // true: the widget is offered in no menu (it is an implementation detail,
    // not a user choice).
    hidden: raw.hidden === true,
    // true: this plugin IS the link probe. The core runs no second check, and
    // the tile's up/down state is the one returned by check() rather than the
    // widget id.
    probe: raw.probe === true,
    server: str(raw.server, 60),
    client: str(raw.client, 60),
    css: str(raw.css, 60),
    strings: {},
    config: []
  };

  if (raw.strings != null) {
    if (!isPlainObject(raw.strings)) {
      errors.push("strings: object expected");
    } else {
      for (const lang of ["fr", "en"]) {
        const pack = raw.strings[lang];
        if (pack == null) continue;
        if (!isPlainObject(pack)) {
          errors.push(`strings.${lang}: object expected`);
          continue;
        }
        const out = {};
        for (const [key, value] of Object.entries(pack).slice(0, MAX_STRINGS)) {
          if (/^[a-zA-Z0-9_.-]{1,60}$/.test(key)) out[key] = str(value, 200);
        }
        manifest.strings[lang] = out;
      }
    }
  }

  if (raw.config != null) {
    if (!Array.isArray(raw.config)) {
      errors.push("config: array of fields expected");
    } else {
      const seen = new Set();
      for (const [index, item] of raw.config.slice(0, MAX_FIELDS).entries()) {
        const field = validateField(item, index, errors);
        if (!field) continue;
        if (seen.has(field.key)) {
          errors.push(`config: duplicate key "${field.key}"`);
          continue;
        }
        seen.add(field.key);
        manifest.config.push(field);
      }
    }
  }
  return manifest;
}

class Registry {
  // kind: name of the extension point ("widget", ...), used in the logs.
  // roots: folders scanned (bundled plugins, then the user folder).
  constructor({ kind, roots, logger, requireModule }) {
    this.kind = kind;
    this.roots = roots.filter(Boolean);
    this.logger = logger || (() => {});
    this.requireModule = requireModule || require;
    this.items = new Map();
    this.slots = new Map();
    this.failures = [];
  }

  // Loads a CommonJS or ESM module.
  async loadModule(file) {
    try {
      return this.requireModule(file);
    } catch (error) {
      // Node refuses require() of an ESM module: retry with a dynamic import.
      if (error && error.code === "ERR_REQUIRE_ESM") return import(pathToFileURL(file).href);
      throw error;
    }
  }

  async load() {
    for (const root of this.roots) {
      let entries;
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch (error) {
        this.logger(`[${this.kind}] folder ${root} unreadable (${error.message}), skipped`);
        continue;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) continue;
        // An invalid name is skipped. A leading "_" is deliberate (template,
        // private folder): no warning. Otherwise, if the folder does hold a
        // manifest, it is almost surely a typo: report it rather than
        // disappear silently.
        if (!ID_PATTERN.test(entry.name)) {
          if (
            !entry.name.startsWith("_") &&
            fs.existsSync(path.join(root, entry.name, "manifest.json"))
          ) {
            this.fail(
              entry.name,
              `invalid folder name (lowercase, dashes, 32 characters max): "${entry.name}"`
            );
          }
          continue;
        }
        await this.loadOne(path.join(root, entry.name), entry.name);
      }
    }
    return this;
  }

  async loadOne(dir, id) {
    const errors = [];
    let manifest;
    try {
      manifest = validateManifest(
        id,
        JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")),
        errors
      );
    } catch (error) {
      this.fail(id, `manifest.json unreadable: ${error.message}`);
      return;
    }
    if (!manifest || errors.length) {
      this.fail(id, errors.join("; ") || "invalid manifest.json");
      return;
    }
    // No file name from the manifest may lead outside the plugin folder.
    for (const key of ["server", "client", "css"]) {
      const value = manifest[key];
      if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
        this.fail(id, `${key}: file name not allowed (${value})`);
        return;
      }
    }

    const item = { ...manifest, dir };

    if (manifest.server) {
      const file = path.join(dir, manifest.server);
      if (!fs.existsSync(file)) {
        this.fail(id, `server module not found: ${manifest.server}`);
        return;
      }
      try {
        const loaded = await this.loadModule(file);
        const definition = loaded && loaded.default ? loaded.default : loaded;
        const check =
          definition &&
          (definition.check || (typeof definition === "function" ? definition : null));
        if (typeof check !== "function") {
          this.fail(id, "the server module must export { check(ctx) }");
          return;
        }
        item.check = check;
        item.createState =
          typeof definition.createState === "function" ? definition.createState : () => ({});
        if (typeof definition.purge === "function") item.purge = definition.purge;
      } catch (error) {
        this.fail(id, `server module failed: ${error.message}`);
        return;
      }
    }

    if (manifest.client && !fs.existsSync(path.join(dir, manifest.client))) {
      this.fail(id, `client module not found: ${manifest.client}`);
      return;
    }
    if (manifest.css && !fs.existsSync(path.join(dir, manifest.css))) {
      this.fail(id, `stylesheet not found: ${manifest.css}`);
      return;
    }

    // Only one plugin can claim a slot: two default link plugins would
    // silently compete for the same services, so the second one is refused
    // rather than picking one at random.
    if (manifest.defaultFor) {
      const owner = this.slots.get(manifest.defaultFor);
      if (owner) {
        this.fail(id, `slot "${manifest.defaultFor}" already claimed by "${owner}"`);
        return;
      }
      this.slots.set(manifest.defaultFor, id);
    }

    this.items.set(id, item);
    this.logger(`[${this.kind}] ${id} v${item.version} loaded (${this.describeConfig(item)})`);
  }

  // Plugin owning a slot ("link": web links without a widget).
  bySlot(slot) {
    const id = this.slots.get(slot);
    return id ? this.get(id) : null;
  }

  describeConfig(item) {
    const parts = [];
    if (item.check) parts.push("check");
    if (item.client) parts.push("render");
    if (item.config && item.config.length) parts.push(`${item.config.length} field(s)`);
    return parts.join(", ") || "no backend";
  }

  fail(id, reason) {
    this.failures.push({ id, reason });
    this.logger(`[${this.kind}] ${id} SKIPPED: ${reason}`);
  }

  has(id) {
    return this.items.has(id);
  }

  get(id) {
    return this.items.get(id) || null;
  }

  ids() {
    return [...this.items.keys()];
  }

  // Public metadata (no secret) sent to the browser.
  publicList() {
    return [...this.items.values()]
      .map(item => ({
        id: item.id,
        version: item.version,
        label: item.label,
        description: item.description || null,
        hasConfig: !!(item.config && item.config.length),
        hasCss: !!item.css,
        // An internal plugin is not offered in the menus.
        hidden: item.hidden === true,
        config: item.config || [],
        strings: item.strings || {}
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

module.exports = {
  Registry,
  ID_PATTERN,
  FIELD_TYPES,
  isPlainObject,
  validateManifest,
  validateField
};
