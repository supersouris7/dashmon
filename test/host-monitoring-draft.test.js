"use strict";
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
async function main() {
  const { blankMonitoring, serializeHostMonitoring } = await import(
    pathToFileURL(path.join(__dirname, "../public/js/editor/host-monitoring-draft.js")).href
  );
  const draft = blankMonitoring();
  assert.equal(serializeHostMonitoring(draft), undefined);
  draft.enabled = true;
  draft.path = " /host ";
  draft.smart.disks = ["disk", "disk", ""];
  draft.aptUpdates.enabled = false;
  draft.opencode.enabled = false;
  draft.claude.enabled = false;
  draft.directorySizes.entries = [{ name: "Films", path: "/srv/media" }];
  const result = serializeHostMonitoring(draft);
  assert.equal(result.path, "/host");
  assert.deepEqual(result.smart.disks, ["disk"]);
  assert.equal(result.aptUpdates.enabled, false);
  assert.deepEqual(result.opencode, { enabled: false });
  assert.deepEqual(result.claude, { enabled: false });
  assert.deepEqual(result.directorySizes, {
    enabled: true,
    entries: [{ name: "Films", path: "/srv/media" }]
  });
  assert.equal(serializeHostMonitoring(blankMonitoring()), undefined, "OpenCode actif par defaut");
  console.log("PASS supervision : serialisation du brouillon hote");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
