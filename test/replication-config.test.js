"use strict";
const assert = require("assert");
const { createReplicationConfig } = require("../lib/agent/replication-config");
const sanitizeText = (value, max) =>
  String(value == null ? "" : value)
    .trim()
    .slice(0, max);
const sanitizeUrl = value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (_error) {
    return "";
  }
};
const { sanitizeReplication, sanitizeSyncUrl } = createReplicationConfig({
  sanitizeUrl,
  sanitizeText,
  defaultName: "Dashmon"
});
assert.equal(sanitizeSyncUrl("https://exemple.lan"), "https://exemple.lan/");
assert.equal(sanitizeSyncUrl("https://exemple.lan/?option=1"), "");
assert.equal(sanitizeSyncUrl("https://exemple.lan/#fragment"), "");
assert.equal(sanitizeSyncUrl("file:///etc/config"), "");
const result = sanitizeReplication({
  instanceName: " Dashboard ",
  secondaries: ["https://exemple.lan", "https://exemple.lan/", "file:///etc/config"],
  agentNames: { "https://exemple.lan": "Agent", "https://autre.exemple.lan": "ignore" },
  agentIcons: { "https://exemple.lan": "FA-Solid FA-Server", "https://autre.exemple.lan": "x" },
  agentHosts: { "https://exemple.lan": "host", "https://autre.exemple.lan": "ignore" },
  agentTokens: { "https://exemple.lan": " jeton-a ", "https://autre.exemple.lan": "ignore" }
});
assert.deepEqual(result, {
  role: "primary",
  instanceName: "Dashboard",
  secondaries: ["https://exemple.lan/"],
  agentNames: { "https://exemple.lan/": "Agent" },
  agentIcons: { "https://exemple.lan/": "fa-solid fa-server" },
  agentHosts: { "https://exemple.lan/": "host" },
  agentTokens: { "https://exemple.lan/": "jeton-a" }
});
// A tab icon that is not a class list falls back to a safe icon.
assert.equal(
  sanitizeReplication({
    secondaries: ["https://exemple.lan"],
    agentIcons: { "https://exemple.lan": '"><img src=x>' }
  }).agentIcons["https://exemple.lan/"],
  "fa-solid fa-folder"
);
assert.deepEqual(sanitizeReplication(null), {
  role: "primary",
  instanceName: "Dashmon",
  secondaries: [],
  agentNames: {},
  agentIcons: {},
  agentHosts: {},
  agentTokens: {}
});

// One token per agent, encrypted at rest, masked for the browser.
const { createSecretCodec, isEncryptedSecret, isMaskedSecret } = require("../lib/config/secrets");
const codec = createSecretCodec("0123456789abcdef0123456789abcdef");
const A = "https://a.exemple.lan/";
const B = "https://b.exemple.lan/";
const pairing = createReplicationConfig({
  sanitizeUrl,
  sanitizeText,
  defaultName: "Dashmon",
  encryptSecret: codec.encryptSecret,
  decryptSecret: codec.decryptSecret,
  fallbackToken: "commun"
});
const stored = {
  replication: pairing.sanitizeReplication({
    secondaries: [A, B],
    agentTokens: { [A]: "jeton-a" }
  })
};
const storedA = stored.replication.agentTokens[A];
assert.ok(isEncryptedSecret(storedA), "token encrypted on write");
assert.equal(codec.decryptSecret(storedA), "jeton-a");
// Already encrypted: kept as is (no new ciphertext on every save).
assert.equal(
  pairing.sanitizeReplication({ secondaries: [A], agentTokens: { [A]: storedA } }).agentTokens[A],
  storedA
);

// Each agent gets its own token; one without falls back to the shared one.
assert.equal(pairing.tokenFor(stored, A), "jeton-a");
assert.equal(pairing.tokenFor(stored, B), "commun");
const noFallback = createReplicationConfig({ sanitizeUrl, sanitizeText });
assert.equal(noFallback.tokenFor({ replication: {} }, B), "");

// The browser only sees a mask, and sending it back restores the token, even
// when the address of the agent was corrected in the same edit.
const browser = pairing.maskTokens(stored);
const mask = browser.replication.agentTokens[A];
assert.ok(isMaskedSecret(mask));
assert.ok(!JSON.stringify(browser).includes(storedA), "no ciphertext sent to the browser");
assert.equal(stored.replication.agentTokens[A], storedA, "maskTokens does not mutate");
const moved = "https://a2.exemple.lan/";
const back = pairing.sanitizeReplication(
  pairing.restoreTokens(
    { replication: { secondaries: [moved, B], agentTokens: { [moved]: mask, [B]: "jeton-b" } } },
    stored
  ).replication
);
assert.equal(back.agentTokens[moved], storedA);
assert.equal(codec.decryptSecret(back.agentTokens[B]), "jeton-b");
// A mask matching nothing stands for no token: dropped, never stored.
assert.deepEqual(
  pairing.sanitizeReplication(
    pairing.restoreTokens(
      { replication: { secondaries: [A], agentTokens: { [A]: "aes1.masked.inconnu" } } },
      stored
    ).replication
  ).agentTokens,
  {}
);

// Test of an agent: typed token, mask of a saved one, or nothing.
assert.equal(pairing.tokenForTest(stored, B, " saisi "), "saisi");
assert.equal(pairing.tokenForTest(stored, B, mask), "jeton-a");
assert.equal(pairing.tokenForTest(stored, A, ""), "jeton-a");
assert.equal(pairing.tokenForTest(stored, B, undefined), "commun");
assert.equal(pairing.tokenForTest(stored, B, "aes1.masked.inconnu"), "");

console.log("PASS pairage : validation et normalisation de la configuration, jeton par agent");
