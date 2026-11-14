"use strict";
// Server core of the supervision cards contributed as plugins.
//
// A supervision plugin is a folder in supervisions/ (see docs/EXTENDING.md):
// its server module exports collect(ctx), run for the monitored local host on
// every host metrics collection. What it returns is a small JSON report placed
// under host.plugins.<id> in the metrics, sent as is to the supervision page
// (and, in agent mode, to the main dashboard). Its client module turns that
// report into a card.
//
// The core knows no plugin by name, and a plugin never breaks the collection:
// an exception, a timeout or an oversized report only drops that one card.

const fs = require("fs");
const path = require("path");

const { Registry } = require("../widgets/registry");
const { Storage } = require("../widgets/storage");
const { validateSupervisionManifest } = require("./manifest");

// Longest a collect() may take before its card is dropped for this round.
const COLLECT_TIMEOUT = 5000;
// Largest report accepted, once serialised: a card summary, not a dump.
const MAX_REPORT_BYTES = 256 * 1024;
// Largest data file a plugin may read with ctx.readDataFile().
const MAX_DATA_FILE_BYTES = 2 * 1024 * 1024;
const DATA_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

// Optional folder of third-party supervision plugins mounted as a volume. Its
// code runs in the server process without isolation, hence the same explicit
// opt-in as third-party widgets.
function extraRoot(env) {
  const dir = env.DASHMON_SUPERVISION_DIR;
  return dir && env.DASHMON_ALLOW_UNSAFE_PLUGINS === "1" ? path.resolve(dir) : "";
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer after ${ms} ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

// Settings of a plugin on a host: monitoring.plugins.<id>, or the historical
// key of a card that was part of the core (manifest settings.key).
function pluginPrefs(host, item) {
  const monitoring = host?.monitoring || {};
  const key = item?.settings?.key;
  const prefs = key ? monitoring[key] : monitoring.plugins?.[item?.id];
  return prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : {};
}

// A card is shown unless its host turned it off.
function pluginEnabled(host, item) {
  return pluginPrefs(host, item).enabled !== false;
}

class SupervisionCore {
  // options: { root, dataDir, log, sanitizeText, env, roots, timeout, reportFile }
  // roots replaces the scanned folders (tests). reportFile(env, default):
  // path of a report file (settings.reportFile).
  constructor(options) {
    const env = options.env || process.env;
    this.dataDir = options.dataDir;
    this.reportFile = options.reportFile || ((_env, fallback) => path.join(this.dataDir, fallback));
    this.log = options.log || (() => {});
    this.sanitizeText = options.sanitizeText;
    this.timeout = options.timeout || COLLECT_TIMEOUT;
    if (env.DASHMON_SUPERVISION_DIR) {
      this.log(
        extraRoot(env)
          ? "[supervision] WARNING: third-party plugins enabled without security isolation"
          : "[supervision] third-party plugins disabled: set DASHMON_ALLOW_UNSAFE_PLUGINS=1 to enable them (no isolation)"
      );
    }
    this.registry = new Registry({
      kind: "supervision",
      entry: "collect",
      roots: options.roots || [path.join(options.root, "supervisions"), extraRoot(env)],
      logger: this.log,
      extend: validateSupervisionManifest
    });
    this.states = new Map();
    this.storages = new Map();
    // Last failure logged per plugin: a broken plugin is reported once, not
    // on every refresh.
    this.lastFailure = new Map();
  }

  async load() {
    await this.registry.load();
    for (const item of this.registry.items.values()) this.prepare(item);
    return this;
  }

  // Memory and storage of a loaded plugin. Also used by scripts/check-plugin.js
  // to run one plugin on its own.
  prepare(item) {
    this.registry.items.set(item.id, item);
    // Report files resolved once: the administrator's variable or the data
    // folder.
    item.filePaths = {};
    for (const [name, spec] of Object.entries(item.files || {}))
      item.filePaths[name] = this.reportFile(spec.env, spec.default);
    this.states.set(item.id, item.createState ? item.createState() : {});
    this.storages.set(
      item.id,
      new Storage({ dir: this.dataDir, folder: path.join("supervisions", item.id), log: this.log })
    );
  }

  ids() {
    return this.registry.ids();
  }

  // Public metadata sent to the browser, with what the supervision page and
  // the host settings need. No path, no server code.
  publicList() {
    return this.registry.publicList().map(meta => {
      const item = this.registry.get(meta.id);
      return {
        ...meta,
        client: item.client || "",
        css: item.css || "",
        order: item.order,
        showEmpty: item.showEmpty,
        script: item.script,
        guide: item.guide,
        settings: item.settings
      };
    });
  }

  // A browser file the manifest declares (client, css, modules).
  asset(id, name) {
    return this.registry.declaredAsset(String(id || ""), String(name || ""));
  }

  // Host settings schemas, for the config normaliser: [{ id, key, fields }].
  settingsSchemas() {
    return [...this.registry.items.values()].map(item => ({
      id: item.id,
      key: item.settings?.key || null,
      fields: item.settings?.fields || []
    }));
  }

  // Path of a report file of a plugin (manifest files), or null.
  filePath(id, name) {
    return this.registry.get(id)?.filePaths?.[name] || null;
  }

  // Plugins whose report comes from a host script: { <id>: "<script>" }.
  scripts() {
    const out = {};
    for (const item of this.registry.items.values()) if (item.script) out[item.id] = item.script;
    return out;
  }

  // JSON file of the data folder, typically written by a host script:
  // { data, modifiedAt } (seconds), or null when absent, too large or invalid.
  // Only a bare file name is accepted: nothing outside the data folder.
  readDataFile(name, { maxBytes = MAX_DATA_FILE_BYTES } = {}) {
    const clean = String(name == null ? "" : name);
    if (!DATA_FILE_PATTERN.test(clean)) return null;
    const file = path.join(this.dataDir, clean);
    const limit = Math.min(Math.max(Number(maxBytes) || 0, 1), MAX_DATA_FILE_BYTES);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > limit) return null;
      return {
        data: JSON.parse(fs.readFileSync(file, "utf8")),
        modifiedAt: Math.floor(stat.mtimeMs / 1000)
      };
    } catch (_error) {
      return null;
    }
  }

  failed(id, message) {
    if (this.lastFailure.get(id) === message) return;
    this.lastFailure.set(id, message);
    this.log(`[supervision] ${id} failed: ${message}`);
  }

  async collectOne(item, host) {
    const ctx = {
      host: {
        id: this.sanitizeText(host.id, 64),
        name: this.sanitizeText(host.name, 100),
        monitoring: host.monitoring || {}
      },
      // This plugin's settings on the host (manifest settings).
      prefs: pluginPrefs(host, item),
      // Report files declared in the manifest: { report: "/app/data/..." }.
      files: item.filePaths || {},
      state: this.states.get(item.id),
      storage: this.storages.get(item.id),
      readDataFile: (name, options) => this.readDataFile(name, options),
      sanitizeText: this.sanitizeText,
      log: message => this.log(`[supervision] ${item.id}: ${message}`)
    };
    let report;
    try {
      report = await withTimeout(
        Promise.resolve().then(() => item.collect(ctx)),
        this.timeout
      );
    } catch (error) {
      this.failed(item.id, (error && error.message) || String(error));
      return undefined;
    }
    // null / undefined: nothing to show on this host (no report yet...).
    if (report == null) return undefined;
    if (typeof report !== "object" || Array.isArray(report)) {
      this.failed(item.id, "collect() must return an object or null");
      return undefined;
    }
    let size;
    try {
      size = Buffer.byteLength(JSON.stringify(report));
    } catch (error) {
      this.failed(item.id, `report not serialisable (${error.message})`);
      return undefined;
    }
    if (size > MAX_REPORT_BYTES) {
      this.failed(item.id, `report too large (${size} bytes, ${MAX_REPORT_BYTES} max)`);
      return undefined;
    }
    this.lastFailure.delete(item.id);
    return report;
  }

  // { <id>: report } for the plugins with something to show on this host.
  // Plugins run side by side; a slow one only delays the answer up to the
  // timeout.
  async collect(host) {
    const items = [...this.registry.items.values()].filter(
      item => item.collect && pluginEnabled(host, item)
    );
    const reports = await Promise.all(items.map(item => this.collectOne(item, host)));
    const out = {};
    items.forEach((item, index) => {
      if (reports[index] !== undefined) out[item.id] = reports[index];
    });
    return out;
  }
}

module.exports = {
  SupervisionCore,
  pluginEnabled,
  pluginPrefs,
  COLLECT_TIMEOUT,
  MAX_REPORT_BYTES,
  MAX_DATA_FILE_BYTES
};
