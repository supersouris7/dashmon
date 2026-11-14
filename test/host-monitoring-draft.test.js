"use strict";
// Monitoring settings of a host as the editor saves them: core fields, and the
// settings of the supervision plugins, each by its manifest schema.
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { bundledMetas } = require("./supervisions/schemas");

const url = file => pathToFileURL(path.join(__dirname, "..", "public", "js", file)).href;

async function main() {
  const registry = await import(url("supervision-registry.js"));
  for (const meta of bundledMetas()) registry.registerSupervisionPlugin(meta);
  const { blankMonitoring, serializeHostMonitoring } = await import(
    url("editor/host-monitoring-draft.js")
  );
  const { normalizeHostMonitoring } = await import(url("config/normalize.js"));

  assert.equal(serializeHostMonitoring(blankMonitoring()), undefined, "cartes actives par defaut");
  // The editor works on the normalised shape: every plugin field present.
  const draft = normalizeHostMonitoring({ enabled: true, type: "local" });
  assert.deepEqual(draft.smart, { enabled: true, disks: [] });
  assert.deepEqual(draft.directorySizes, { enabled: true, entries: [] });
  draft.path = " /host ";
  draft.smart.disks = ["disk", "disk", ""];
  draft.aptUpdates.enabled = false;
  draft.opencode.enabled = false;
  draft.claude.enabled = false;
  draft.directorySizes.entries = [
    { name: "Films", path: "/srv/media" },
    { name: "Relatif", path: "srv" }
  ];
  draft.plugins = { "mon-plugin": { enabled: false } };
  const result = serializeHostMonitoring(draft);
  assert.equal(result.path, "/host");
  assert.deepEqual(result.smart, { enabled: true, disks: ["disk"] });
  assert.deepEqual(result.aptUpdates, { enabled: false });
  assert.deepEqual(result.opencode, { enabled: false });
  assert.deepEqual(result.claude, { enabled: false });
  assert.equal(result.wireguard, undefined, "valeurs par defaut non enregistrees");
  assert.deepEqual(result.directorySizes, {
    enabled: true,
    entries: [{ name: "Films", path: "/srv/media" }]
  });
  assert.deepEqual(result.plugins, { "mon-plugin": { enabled: false } });
  console.log("PASS supervision : serialisation du brouillon hote");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
