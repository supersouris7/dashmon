"use strict";
// Widget secrets never reach the browser: masked on read, restored on save,
// encrypted on disk.
const assert = require("assert");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { WidgetCore } = require("../lib/widgets/core");
const { createSecretCodec, isMaskedSecret } = require("../lib/config/secrets");

async function main() {
  const codec = createSecretCodec(crypto.randomBytes(32).toString("hex"));
  const core = new WidgetCore({
    root: path.join(__dirname, ".."),
    dataDir: os.tmpdir(),
    log: () => {},
    decryptSecret: codec.decryptSecret,
    encryptSecret: codec.encryptSecret,
    sanitizeText: value => String(value == null ? "" : value),
    sanitizeUrl: value => String(value == null ? "" : value),
    statusCache: {}
  });
  await core.load();

  const stored = {
    services: [
      {
        name: "a",
        widget: { type: "adguard", url: "http://x", password: codec.encryptSecret("pw-a") }
      },
      {
        name: "b",
        widget: { type: "adguard", url: "http://y", password: codec.encryptSecret("pw-b") }
      },
      // Widget whose plugin is missing: its encrypted values are masked too.
      { name: "c", widget: { type: "gone", token: codec.encryptSecret("pw-c") } }
    ]
  };

  // Read: no secret, not even encrypted, leaves the server.
  const sent = core.forBrowser(stored);
  const values = sent.services.map(s => s.widget.password || s.widget.token);
  assert.ok(values.every(isMaskedSecret), JSON.stringify(values));
  assert.ok(!JSON.stringify(sent).includes(stored.services[0].widget.password));
  assert.equal(sent.services[0].widget.url, "http://x");

  // Save: masks come back reordered; each finds its own secret again. A new
  // password replaces the stored one, an unknown mask is dropped.
  const received = structuredClone(sent);
  received.services.reverse();
  received.services.push({
    name: "d",
    widget: { type: "adguard", password: "aes1.masked.000000000000000000000000" }
  });
  const restored = core.restoreSecrets(received, stored);
  const byName = Object.fromEntries(restored.services.map(s => [s.name, s.widget]));
  assert.equal(codec.decryptSecret(byName.a.password), "pw-a");
  assert.equal(codec.decryptSecret(byName.b.password), "pw-b");
  assert.equal(codec.decryptSecret(byName.c.token), "pw-c");
  assert.equal(byName.d.password, "");

  // Serialisation: plain values are encrypted, empty ones stay empty, and a
  // leftover mask is never stored.
  const plain = core.sanitizeWidget({ type: "adguard", password: "new" });
  assert.equal(codec.decryptSecret(plain.password), "new");
  assert.equal(core.sanitizeWidget({ type: "adguard", password: "" }).password, "");
  assert.equal(core.sanitizeWidget({ type: "adguard", password: "aes1.masked.ab" }).password, "");

  // Start-up migration: secrets stored in clear text get encrypted in place.
  const legacy = { services: [{ widget: { type: "adguard", password: "clear" } }] };
  assert.equal(core.encryptPlaintextSecrets(legacy), 1);
  assert.equal(codec.decryptSecret(legacy.services[0].widget.password), "clear");
  assert.equal(core.encryptPlaintextSecrets(legacy), 0);

  // AES-GCM: a truncated authentication tag is refused.
  const value = codec.encryptSecret("pw");
  const [prefix, iv, tag, data] = value.split(".");
  const truncated = [
    prefix,
    iv,
    Buffer.from(tag, "base64").subarray(0, 4).toString("base64"),
    data
  ].join(".");
  assert.equal(codec.decryptSecret(truncated), "");

  console.log("PASS secrets : masques a la lecture, restaures a l'enregistrement, chiffres");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
