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

// Longest a collect() may take before its card is dropped for this round.
const COLLECT_TIMEOUT = 5000;
// Largest report accepted, once serialised: a card summary, not a dump.
const MAX_REPORT_BYTES = 64 * 1024;
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

// A host setting turns a card off with monitoring.plugins.<id>.enabled=false;
// absent means shown, like the built-in reports.
function pluginEnabled(host, id) {
  return host?.monitoring?.plugins?.[id]?.enabled !== false;
}

class SupervisionCore {
  // options: { root, dataDir, log, sanitizeText, env, roots, timeout }
  // roots replaces the scanned folders (tests).
  constructor(options) {
    const env = options.env || process.env;
    this.dataDir = options.dataDir;
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
      logger: this.log
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
    this.states.set(item.id, item.createState ? item.createState() : {});
    this.storages.set(
      item.id,
      new Storage({ dir: this.dataDir, folder: path.join("supervisions", item.id), log: this.log })
    );
  }

  ids() {
    return this.registry.ids();
  }

  publicList() {
    return this.registry.publicList();
  }

  clientAsset(id, kind) {
    return this.registry.clientAsset(id, kind);
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
      item => item.collect && pluginEnabled(host, item.id)
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
  COLLECT_TIMEOUT,
  MAX_REPORT_BYTES,
  MAX_DATA_FILE_BYTES
};
