"use strict";
// Server core of the tile widgets.
//
// The core knows NO widget by name: it loads the registry, dispatches on the
// type found in the config, and handles the cache, the check period, secrets
// and purging. Adding a widget never touches the rest of the server.

const path = require("path");
const fs = require("fs");

const { Registry } = require("./registry");
const schema = require("./schema");
const httpClient = require("../http/client");
const { Storage } = require("./storage");

const DEFAULT_INTERVAL = 5 * 60 * 1000;

// Optional folder of third-party plugins mounted as a volume. Third-party
// code runs without isolation, so it needs DASHMON_ALLOW_UNSAFE_PLUGINS=1.
function extraRoot() {
  const dir = process.env.DASHMON_WIDGET_DIR || process.env.DASHMON_PLUGINS_DIR;
  return dir && process.env.DASHMON_ALLOW_UNSAFE_PLUGINS === "1" ? path.resolve(dir) : "";
}

// Resolves a label declared in the manifest: French, then English.
function localize(strings, key, fallback) {
  const pack = strings || {};
  const value = (pack.fr && pack.fr[key]) || (pack.en && pack.en[key]);
  return value || fallback || key;
}

class WidgetCore {
  // options: { root, dataDir, log, decryptSecret, encryptSecret, sanitizeText, sanitizeUrl, statusCache }
  constructor(options) {
    this.root = options.root;
    this.dataDir = options.dataDir;
    this.log = options.log || (() => {});
    if (process.env.DASHMON_WIDGET_DIR || process.env.DASHMON_PLUGINS_DIR) {
      this.log(
        extraRoot()
          ? "[widget] WARNING: third-party plugins enabled without security isolation"
          : "[widget] third-party plugins disabled: set DASHMON_ALLOW_UNSAFE_PLUGINS=1 to enable them (no isolation)"
      );
    }
    this.decryptSecret = options.decryptSecret;
    this.encryptSecret = options.encryptSecret;
    this.sanitizeText = options.sanitizeText;
    this.sanitizeUrl = options.sanitizeUrl;
    this.statusCache = options.statusCache;
    this.registry = new Registry({
      kind: "widget",
      roots: [path.join(this.root, "widgets"), extraRoot()],
      logger: this.log
    });
    // Per-widget memory (cached tokens, history...), created once.
    this.states = new Map();
    // Per-widget persistence: what must survive a restart.
    this.storage = new Storage({ dir: this.dataDir, log: this.log });
  }

  async load() {
    await this.registry.load();
    for (const [id, item] of this.registry.items) {
      this.states.set(id, item.createState ? item.createState() : {});
    }
    return this;
  }

  get(id) {
    return this.registry.get(String(id || ""));
  }

  has(id) {
    return this.registry.has(String(id || ""));
  }

  // Installed widget WITH a backend: the only case that triggers a check.
  isCheckable(id) {
    const item = this.get(id);
    return !!(item && item.check);
  }

  hasConfigFields(id) {
    const item = this.get(id);
    return !!(item && item.config && item.config.length);
  }

  // Plugin responsible for a service: its widget's plugin if it has one,
  // otherwise the plugin claiming the "link" slot (web links have no widget
  // but are still checked). The core knows no plugin by name.
  pluginFor(service) {
    const type = service && service.widget && service.widget.type;
    if (type) return this.get(type);
    return this.registry.bySlot("link");
  }

  // true when a plugin can check this service: an installed widget, or a web
  // link while the link probe plugin is present.
  handles(service) {
    const item = this.pluginFor(service);
    return !!(item && item.check);
  }

  // Link probe plugin (slot "link"), if installed.
  linkPlugin() {
    return this.registry.bySlot("link");
  }

  interval(service) {
    const item = this.pluginFor(service);
    return item ? item.interval : DEFAULT_INTERVAL;
  }

  // Status cache key: per service (its URL) or shared by identical configs.
  cacheKey(service) {
    const widget = (service && service.widget) || {};
    const item = this.pluginFor(service);
    if (item && item.cacheKey === "config") {
      const parts = (item.config || []).map(field =>
        field.type === "secret"
          ? String(widget[field.key] == null ? "" : widget[field.key]).length +
            ":" +
            // A secret enters the key only as its length and first 8 characters:
            // the key stays stable without containing the whole secret.
            String(widget[field.key] == null ? "" : widget[field.key]).slice(0, 8)
          : String(widget[field.key] == null ? "" : widget[field.key])
      );
      return `${item.id}:${parts.join("|")}`;
    }
    return this.sanitizeUrl(service && service.url) || (service && service.url) || "";
  }

  // Working config for the check: as stored, but with secrets decrypted.
  // (Encrypted values stay as they are when the master key is missing.)
  runtimeConfig(item, widget) {
    const out = { type: item.id };
    for (const field of item.config || []) {
      const raw = widget ? widget[field.key] : "";
      out[field.key] = field.type === "secret" ? this.decryptSecret(raw) : raw;
    }
    return out;
  }

  // --- Config serialisation (API and disk) --------------------------------

  // Shape of a widget config as sent to the browser and stored on disk.
  sanitizeWidget(widget) {
    if (!widget || !widget.type) return null;
    const item = this.get(widget.type);
    if (!item) return null;
    const out = { type: item.id };
    for (const field of item.config || []) {
      const raw = schema.fieldValue(widget, field.key);
      let value;
      if (field.type === "secret") {
        // Encrypted on write; an already encrypted value is kept as is.
        value = schema.isEncryptedSecret(raw)
          ? String(raw).slice(0, 2000)
          : this.encryptSecret(raw);
      } else if (field.type === "number") {
        let n = Number(raw);
        if (!Number.isFinite(n)) n = Number(field.default) || 0;
        value = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
      } else if (field.type === "select") {
        const wanted = String(raw == null ? "" : raw).trim();
        const known = (field.options || []).some(option => option.value === wanted);
        value = known ? wanted : String(field.default == null ? "" : field.default);
      } else {
        value = String(raw == null ? "" : raw)
          .trim()
          .slice(0, field.maxLength);
      }
      out[field.key] = value;
    }
    return out;
  }

  // Widget whose type is not installed: the core does not know its schema and
  // does not invent one. Its fields are kept as they are rather than dropped, so
  // a temporarily broken plugin (missing folder, invalid manifest) does not lose
  // its config on the next save.
  preserveWidget(widget) {
    if (!widget || !widget.type) return null;
    const type = String(widget.type).trim().slice(0, 64);
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(type)) return null;
    const out = {};
    for (const key of Object.keys(widget)) {
      if (key === "type") continue;
      if (!/^[A-Za-z_$][\w$-]{0,63}$/.test(key)) continue;
      const value = widget[key];
      if (typeof value === "string") out[key] = value.slice(0, 2000);
      else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
      else if (typeof value === "boolean") out[key] = value;
    }
    out.type = type;
    return out;
  }

  // Widget of a saved service: an installed widget follows its manifest
  // (secrets encrypted), an unknown one is preserved as is.
  serializeWidget(widget) {
    if (!widget?.type) return null;
    return this.has(widget.type) ? this.sanitizeWidget(widget) : this.preserveWidget(widget);
  }

  // Config sent to the browser: each widget carries the status cache key
  // computed here, so the browser never rebuilds it and both sides cannot
  // diverge. The key is never saved: sanitizeWidget() only copies the fields
  // declared by the manifest.
  withCacheKeys(config) {
    const services = Array.isArray(config.services) ? config.services : [];
    return {
      ...config,
      services: services.map(svc => {
        if (!svc?.widget?.type) return svc;
        return { ...svc, widget: { ...svc.widget, key: this.cacheKey(svc) } };
      })
    };
  }

  // --- Execution ----------------------------------------------------------

  // Runs a widget check. Never throws: errors are reported in the cache
  // entry, like the rest of the status.
  async check(service) {
    const widget = (service && service.widget) || {};
    const item = this.pluginFor(service);
    const key = this.cacheKey(service);
    const started = Date.now();

    if (!item || !item.check) {
      this.statusCache[key] = {
        state: String(widget.type || "unknown"),
        ok: false,
        error: "Widget inconnu ou sans backend",
        ms: 0,
        lastCheck: Date.now()
      };
      return;
    }

    // The previous entry avoids reporting the same failure twice.
    const previous = this.statusCache[key];
    const entry = { state: item.id, ok: false, lastCheck: Date.now() };
    this.statusCache[key] = entry;

    try {
      const result = await item.check({
        config: this.runtimeConfig(item, widget),
        service,
        state: this.states.get(item.id),
        registry: this,
        sanitizeUrl: this.sanitizeUrl,
        sanitizeText: this.sanitizeText,
        strings: item.strings || {},
        // Error messages localised from the manifest strings.
        t: key => localize(item.strings, key),
        api: httpClient.apiRequest,
        // "Does it answer?" HTTP probe: { ok, code, ms, error }.
        probe: (href, timeout) => httpClient.httpProbe(href, timeout),
        // Persistence: ctx.storage.read(name, fallback) / ctx.storage.write(name, value).
        storage: this.storage,
        log: this.log
      });
      // A plugin that measures its own response time (HTTP probe, API call)
      // keeps that figure: it is the one worth showing. Otherwise the whole check
      // duration is measured.
      const measured = !!(
        result &&
        typeof result === "object" &&
        Number.isFinite(Number(result.ms))
      );
      if (result && typeof result === "object") Object.assign(entry, result);
      // A "probe" plugin IS the link check: its up/down state counts for the
      // tile and it decides (a link may answer while the API refuses to deliver
      // the metric). Other widgets keep their id as state; the tile colour comes
      // from their renderer.
      entry.state = item.probe
        ? entry.state === "up" || entry.state === "down"
          ? entry.state
          : entry.ok
            ? "up"
            : "down"
        : item.id;
      entry.ok = entry.ok === true;
      if (!measured) entry.ms = Date.now() - started;
      entry.lastCheck = Date.now();
      // A link failure must not flood the log on every cycle: it is reported
      // once, when the state turns down.
      if (item.probe && entry.state === "down" && (!previous || previous.state !== "down")) {
        this.log(
          `[widget] ${item.id} DOWN: ${(service && service.url) || ""} — ${entry.error || "no response"}`
        );
      }
    } catch (error) {
      entry.error = String((error && error.message) || "Erreur widget").slice(0, 200);
      entry.ok = false;
      entry.ms = Date.now() - started;
      entry.lastCheck = Date.now();
      this.log(`[widget] ${item.id}: ${entry.error}`);
    }
  }

  // Called after each cycle: purges orphan status entries and the widgets'
  // orphan internal memory.
  purge(services) {
    const active = new Set();
    const perWidget = new Map();
    for (const service of services || []) {
      const key = this.cacheKey(service);
      if (key) active.add(key);
      const type = service && service.widget && service.widget.type;
      if (!type) continue;
      if (!perWidget.has(type)) perWidget.set(type, new Set());
      // For widgets keyed per service: remember the service URL.
      if (this.sanitizeUrl(service.url)) perWidget.get(type).add(this.sanitizeUrl(service.url));
    }

    for (const key of Object.keys(this.statusCache)) {
      if (!active.has(key) && !active.has(key.replace(/\/$/, ""))) {
        delete this.statusCache[key];
      }
    }

    for (const [id, item] of this.registry.items) {
      if (typeof item.purge === "function") {
        try {
          item.purge(perWidget.get(id) || new Set(), this.states.get(id));
        } catch (error) {
          this.log(`[widget] ${id} purge: ${error.message}`);
        }
      }
    }
  }

  // --- HTTP exposure ------------------------------------------------------

  // Public metadata: neither secrets nor server code.
  publicList() {
    return this.registry.publicList();
  }

  // Safe read of a client file declared in the manifest. The registry itself
  // is the allow-list: no path traversal is possible and server files are never
  // exposed.
  clientAsset(id, kind) {
    const item = this.get(id);
    if (!item) return null;
    const name = kind === "css" ? item.css : item.client;
    if (!name) return null;
    const file = path.join(item.dir, name);
    // Belt and braces: the manifest is already validated, check the absolute
    // path again.
    if (!file.startsWith(item.dir + path.sep)) return null;
    try {
      return { body: fs.readFileSync(file), type: kind === "css" ? "text/css" : "text/javascript" };
    } catch (_error) {
      return null;
    }
  }
}

module.exports = { WidgetCore, DEFAULT_INTERVAL };
