"use strict";
// Shared by the widget test files (test/widgets-*.test.js): the PASS/FAIL
// reporting, the registry of the bundled widgets and a few fixtures. No
// network: the Docker widget is never run (it would talk to the socket) and
// the link widgets (YouTube, Docker Hub, GitHub) get a fake HTTP client.

const assert = require("assert");
const path = require("path");
const { Registry } = require("../../lib/widgets/registry");

const ROOT = path.join(__dirname, "..", "..");
const WIDGETS = path.join(ROOT, "widgets");

let failures = 0;

// Affiche une valeur courte et lisible (les Buffers et les valeurs cycliques
// ne doivent jamais masquer la vraie cause d'un echec).
function show(value) {
  if (value === undefined) return "undefined";
  if (value instanceof Uint8Array)
    return "<Buffer " + value.length + " octets> " + value.toString("utf8").slice(0, 60);
  if (typeof value === "string") return JSON.stringify(value);
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text.length > 300 ? text.slice(0, 300) + "…" : text;
  } catch (_) {
    return String(value);
  }
}

function check(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (_error) {
    failures++;
    console.error("FAIL " + name);
    console.error("     attendu : " + show(expected));
    console.error("     obtenu  : " + show(actual));
  }
}
function ok(name, condition, detail) {
  if (condition) {
    console.log("PASS " + name);
  } else {
    failures++;
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}

const silentLogger = () => {};

async function loadRegistry() {
  const registry = new Registry({ kind: "widget", roots: [WIDGETS], logger: silentLogger });
  await registry.load();
  return registry;
}

// Extrait les 4 champs compares par les tests de rendu.
function pick(view) {
  return {
    badge: view.badge,
    badgeClass: view.badgeClass,
    time: view.time,
    timeClass: view.timeClass
  };
}

// Ends a test file: its exit code says whether every check passed.
function finish() {
  if (failures) {
    console.error(failures + " échec(s)");
    process.exit(1);
  }
  console.log("Tous les tests passent");
}

function run(main) {
  main()
    .then(finish)
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { ROOT, WIDGETS, check, ok, show, pick, silentLogger, loadRegistry, run };
