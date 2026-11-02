"use strict";
// Routes des images d'applications : import d'un PNG, nom de fichier envoye
// dans X-File-Name, suppression sans traversee de dossier.
const assert = require("assert");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { registerIconRoutes } = require("../lib/routes/icons");

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 16, 0, 0, 0, 16])
]);

async function main() {
  const iconsDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-icons-"));
  const app = express();
  const quiet = { info() {}, warn() {}, error() {} };
  registerIconRoutes(app, { iconsDir, log: quiet });
  const server = app.listen(0, [127, 0, 0, 1].join("."));
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://${[127, 0, 0, 1].join(".")}:${server.address().port}`;
  const upload = name =>
    fetch(base + "/api/icons", {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-File-Name": name },
      body: PNG
    });
  try {
    const good = await upload(encodeURIComponent("mon logo.png"));
    assert.equal(good.status, 201);
    assert.equal((await good.json()).file, "mon-logo.png");

    const again = await upload("mon-logo.png");
    assert.equal((await again.json()).file, "mon-logo-2.png", "aucun ecrasement");

    const malformed = await upload("%E0%A4%A.png");
    assert.equal(malformed.status, 400, "nom mal encode : erreur du client");

    const escaped = await upload(encodeURIComponent("../../evade.png"));
    assert.equal((await escaped.json()).file, "evade.png");
    assert.ok(fs.existsSync(path.join(iconsDir, "evade.png")), "reste dans le dossier");

    const traversal = await fetch(base + "/api/icons/" + encodeURIComponent("../evade.png"), {
      method: "DELETE"
    });
    assert.equal(traversal.status, 400, "chemin refuse, pas reduit");

    const removed = await fetch(base + "/api/icons/mon-logo.png", { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.ok(!fs.existsSync(path.join(iconsDir, "mon-logo.png")));

    const missing = await fetch(base + "/api/icons/mon-logo.png", { method: "DELETE" });
    assert.equal(missing.status, 404);
    console.log("PASS images : import, nom mal encode, suppression");
  } finally {
    server.close();
    fs.rmSync(iconsDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
