"use strict";
// Start-up tasks that bring the data folder and config.json up to date.
// Each one is idempotent: running it on an up-to-date install changes nothing.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Links of the banner on a new install: the only list of default links. They
// point to the project and to a catalogue of self-hosted applications, never
// to a personal service.
const DEFAULT_WEB_LINKS = [
  {
    name: "Dashmon",
    url: "https://github.com/supersouris7/dashmon",
    icon: "fa-brands fa-github"
  },
  {
    name: "Awesome Self-Hosted",
    url: "https://awesome-selfhosted.net",
    icon: "fa-solid fa-house-laptop"
  }
];
const WEB_LINKS_SEED_VERSION = 2;

// Creates the data folders and a first config.json. No example host is
// injected: a new install starts from the bundled (empty) config, and the
// readers fill in every missing field (see lib/config/normalize.js).
function prepareDataDir(settings, repository) {
  for (const dir of [
    settings.dataDir,
    settings.iconsDir,
    settings.themesCustomDir,
    settings.themesNativeDir
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(settings.configFile)) return;

  const bundled = path.join(settings.rootDir, "config.json");
  if (fs.existsSync(bundled)) fs.copyFileSync(bundled, settings.configFile);
  else repository.write({});
}

// Adds the default web links to an install that has never had the field. An
// existing list, even an empty one (links removed on purpose), is kept.
function seedWebLinks(repository) {
  let config;
  try {
    config = repository.read();
  } catch (_error) {
    return;
  }
  if (Number(config.webLinksSeedVersion || 0) >= WEB_LINKS_SEED_VERSION) return;

  if (!Array.isArray(config.webLinks)) config.webLinks = DEFAULT_WEB_LINKS;
  config.webLinksSeedVersion = WEB_LINKS_SEED_VERSION;
  try {
    repository.write(config);
  } catch (_error) {
    // A failed migration write must not block the start-up.
  }
}

// Stable host identifiers: widgets reference host.id so that renaming a server
// does not break them. Gives an id to hosts without one (older configs) and
// makes ids unique. Also run before every GET /api/config.
function ensureHostIds(repository) {
  let config;
  try {
    config = repository.read();
  } catch (_error) {
    return;
  }
  if (!Array.isArray(config.hosts)) return;

  let changed = false;
  const used = new Set();
  config.hosts.forEach(host => {
    const current = String((host && host.id) || "").trim();
    if (!current || current.length > 64 || used.has(current)) {
      host.id = "host-" + crypto.randomBytes(6).toString("hex");
      changed = true;
    }
    used.add(host.id);
  });
  if (changed) {
    try {
      repository.write(config);
    } catch (_error) {}
  }
}

// An agent always monitors its own machine: its local host is enabled. The
// repository guarantees that a local host exists.
function ensureAgentLocalHost(repository) {
  const config = repository.read();
  const local = config.hosts.find(host => host.monitoring?.type === "local");
  if (local.monitoring.enabled !== true) {
    local.monitoring.enabled = true;
    repository.write(config);
  }
}

function runStartupMigrations(settings, repository) {
  prepareDataDir(settings, repository);
  seedWebLinks(repository);
  ensureHostIds(repository);
  if (settings.agentMode) ensureAgentLocalHost(repository);
}

module.exports = { runStartupMigrations, ensureHostIds, DEFAULT_WEB_LINKS };
