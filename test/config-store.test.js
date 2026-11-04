"use strict";
// config.json on disk: durable writes, a backup of the last valid version,
// and recovery when the file is found empty or damaged.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ConfigStore } = require("../lib/config/store");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-store-"));
const file = path.join(dir, "config.json");
const warnings = [];
const store = new ConfigStore(file, { log: { warn: message => warnings.push(message) } });

try {
  store.write({ theme: "dark" });
  assert.deepEqual(store.read(), { theme: "dark" });
  // First write: nothing to keep yet.
  assert.equal(fs.existsSync(file + ".bak"), false);
  // No temporary file is left behind.
  assert.deepEqual(fs.readdirSync(dir), ["config.json"]);

  store.write({ theme: "light" });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + ".bak", "utf8")), { theme: "dark" });
  // Rewriting the same content keeps the older backup.
  store.write({ theme: "light" });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + ".bak", "utf8")), { theme: "dark" });
  // Encrypted widget secrets live here: the file is private.
  assert.equal(fs.statSync(file).mode & 0o077, 0);

  // Power cut: an empty config.json is replaced by the backup.
  fs.writeFileSync(file, "");
  assert.deepEqual(store.read(), { theme: "dark" });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { theme: "dark" });
  assert.match(warnings[0], /restored from config\.json\.bak/);

  // A damaged file never becomes the backup.
  fs.writeFileSync(file, "{ broken");
  store.write({ theme: "polar" });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + ".bak", "utf8")), { theme: "dark" });

  // Without a usable backup the error is reported, nothing is invented.
  fs.rmSync(file + ".bak");
  fs.writeFileSync(file, "[]");
  assert.throws(() => store.read(), /not a JSON object/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS config : ecriture durable, copie de secours et reprise");
