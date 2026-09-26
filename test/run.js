"use strict";
// Lanceur de tests : pas de dependance externe, comme le reste du projet.
// Chaque fichier de test est un script autonome qui sort en erreur s'il echoue.

const path = require("path");
const { spawnSync } = require("child_process");

const SUITES = ["docker.test.js", "widgets.test.js", "frontend.test.js"];

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
