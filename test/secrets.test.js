"use strict";
const assert = require("assert");
const crypto = require("crypto");
const { createSecretCodec } = require("../lib/secrets");
const codec = createSecretCodec(crypto.randomBytes(32).toString("hex"));
const value = crypto.randomBytes(16).toString("hex");
const encrypted = codec.encryptSecret(value);
assert.ok(codec.isEncryptedSecret(encrypted));
assert.equal(codec.decryptSecret(encrypted), value);
assert.notEqual(codec.encryptSecret(value), encrypted);
assert.equal(
  createSecretCodec(crypto.randomBytes(32).toString("hex")).decryptSecret(encrypted),
  ""
);
assert.equal(codec.decryptSecret("aes1.invalid"), "");
const unconfigured = createSecretCodec("");
assert.equal(unconfigured.encryptSecret(value), value);
assert.equal(unconfigured.decryptSecret(encrypted), "");
console.log("PASS securite : secrets chiffres, authentifies et compatibles");
