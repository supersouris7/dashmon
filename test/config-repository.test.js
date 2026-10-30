"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ConfigStore } = require("../lib/config/store");
const { createConfigRepository, ensureLocalHost } = require("../lib/config/repository");
const { runStartupMigrations, DEFAULT_WEB_LINKS } = require("../lib/config/migrations");

// Exactly one enabled local host: added when missing, the first enabled kept.
const added = ensureLocalHost({ hosts: [{ id: "dashmon-local" }] }, { agentMode: false });
assert.equal(added.hosts[0].id, "dashmon-local-local");
assert.equal(added.hosts[0].monitoring.enabled, true);
const two = ensureLocalHost(
  {
    hosts: [
      { id: "a", monitoring: { type: "local" } },
      { id: "b", monitoring: { type: "local", enabled: true } }
    ]
  },
  { agentMode: false }
);
assert.deepEqual(
  two.hosts.map(host => host.monitoring.enabled),
  [false, true]
);
assert.equal(ensureLocalHost({}, { agentMode: true }).hosts[0].name, "Agent");

// Start-up on an empty data folder: folders, bundled config, default links.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-config-"));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-root-"));
fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ hosts: [{ name: "x" }] }));
const settings = {
  rootDir: root,
  dataDir: dir,
  configFile: path.join(dir, "config.json"),
  iconsDir: path.join(dir, "icons"),
  themesCustomDir: path.join(dir, "themes"),
  themesNativeDir: path.join(dir, "native"),
  agentMode: false
};
const repository = createConfigRepository({
  store: new ConfigStore(settings.configFile),
  agentMode: false
});
try {
  runStartupMigrations(settings, repository);
  assert.ok(fs.existsSync(settings.iconsDir));
  const config = repository.read();
  assert.deepEqual(config.webLinks, DEFAULT_WEB_LINKS);
  assert.ok(config.hosts.every(host => /^(host-[0-9a-f]{12}|dashmon-local)$/.test(host.id)));

  // Retired settings are hidden; an emptied link list is respected.
  repository.write({ ...config, favicon: "x", webLinks: [] });
  runStartupMigrations(settings, repository);
  assert.equal(repository.read().favicon, undefined);
  assert.deepEqual(repository.read().webLinks, []);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("PASS configuration : hote local unique et migrations de demarrage");
