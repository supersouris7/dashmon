"use strict";
// Widget secrets (passwords, tokens) encrypted at rest with AES-256-GCM,
// stored as "aes1.<iv>.<tag>.<data>". The key is derived from
// DASHMON_MASTER_KEY, which the main dashboard requires.
//
// Secrets never reach the browser, not even encrypted: GET /api/config
// replaces each one with a mask, "aes1.masked.<fingerprint>". The browser
// already treats any "aes1." value as "configured, keep as is", so it sends
// the mask back on save, and the server puts the stored value back in its
// place (see WidgetCore.restoreSecrets).

const crypto = require("crypto");

const SECRET_PREFIX = "aes1.";
const MASK_PREFIX = "aes1.masked.";
const TAG_LENGTH = 16;

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX) && !isMaskedSecret(value);
}

function isMaskedSecret(value) {
  return typeof value === "string" && value.startsWith(MASK_PREFIX);
}

// Stable identifier of a stored secret. Stored secrets are ciphertexts with a
// random IV: the fingerprint reveals nothing about the password.
function secretFingerprint(stored) {
  return crypto
    .createHash("sha256")
    .update("dashmon-secret:" + String(stored || ""))
    .digest("hex")
    .slice(0, 24);
}

function maskSecret(stored) {
  return stored ? MASK_PREFIX + secretFingerprint(stored) : "";
}

function createSecretCodec(masterKey) {
  const key = masterKey ? crypto.createHash("sha256").update(masterKey, "utf8").digest() : null;

  function encryptSecret(value) {
    if (key === null) return String(value || "");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
    return `${SECRET_PREFIX}${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  }

  // "" when the value cannot be decrypted (other key, tampered value, mask).
  function decryptSecret(value) {
    if (isMaskedSecret(value)) return "";
    if (!isEncryptedSecret(value)) return String(value || "");
    if (key === null) return "";
    try {
      const parts = value.slice(SECRET_PREFIX.length).split(".");
      if (parts.length !== 3) return "";
      const iv = Buffer.from(parts[0], "base64");
      const tag = Buffer.from(parts[1], "base64");
      const data = Buffer.from(parts[2], "base64");
      // A truncated tag would weaken the authentication: only full tags pass.
      if (tag.length !== TAG_LENGTH) return "";
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
        authTagLength: TAG_LENGTH
      });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch (_error) {
      return "";
    }
  }

  return { isEncryptedSecret, encryptSecret, decryptSecret };
}

module.exports = {
  createSecretCodec,
  isEncryptedSecret,
  isMaskedSecret,
  maskSecret,
  secretFingerprint
};
