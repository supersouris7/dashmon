"use strict";
// Lanceur de tests : pas de dependance externe, comme le reste du projet.
// Chaque fichier de test est un script autonome qui sort en erreur s'il echoue.

const path = require("path");
const { spawnSync } = require("child_process");

const SUITES = ["docker.test.js", "widgets.test.js", "frontend.test.js", "agent.test.js", "apt.test.js", "security-headers.test.js", "request-origin.test.js", "rate-limit.test.js", "replication-config.test.js", "config-patch.test.js", "local-metrics.test.js", "sanitize.test.js", "secrets.test.js", "confirm-dialog.test.js", "apt-report.test.js", "smart-report.test.js", "wireguard-report.test.js", "replication-draft.test.js", "host-monitoring-draft.test.js", "config-routes.test.js", "config-fields.test.js", "config-normalize.test.js", "editor-drag.test.js", "editor-draft.test.js"];

let failed = 0;
for (const suite of SUITES) {
  const file = path.join(__dirname, suite);
  console.log("\n=== " + suite + " ===");
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  if (result.status !== 0) failed++;
}

if (failed) {
  console.error("\n" + failed + " suite(s) en echec");
  process.exit(1);
}
console.log("\nToutes les suites passent");
