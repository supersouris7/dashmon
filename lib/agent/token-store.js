"use strict";
// Main dashboard side: the token of each paired agent, by address.
//
// Kept in the data folder (agent-tokens.json, 0600), encrypted with the master
// key like widget secrets, and never part of config.json: tokens never reach
// the browser, and pairing an agent does not change the configuration
// revision an open editor relies on.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Tokens of agents removed from the list are kept (adding the agent back
// needs no new pairing), up to this many addresses.
const MAX_TOKENS = 50;

class AgentTokenStore {
  constructor({ dataDir, encryptSecret, decryptSecret }) {
    this.file = path.join(dataDir, "agent-tokens.json");
    this.encryptSecret = encryptSecret;
    this.decryptSecret = decryptSecret;
    this.tokens = this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
      return new Map(
        Object.entries(raw).filter(([url, value]) => url && typeof value === "string" && value)
      );
    } catch (_error) {
      return new Map();
    }
  }

  save() {
    const temporary = `${this.file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.tokens)) + "\n", {
        encoding: "utf8",
        mode: 0o600
      });
      fs.renameSync(temporary, this.file);
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (_error) {}
    }
  }

  // Token in clear, or "" (unknown address, or a key that cannot decrypt it).
  get(url) {
    const stored = this.tokens.get(url);
    return stored ? this.decryptSecret(stored) : "";
  }

  // keep: addresses whose token must survive the bound (the paired agents).
  set(url, token, keep = []) {
    this.tokens.delete(url);
    this.tokens.set(url, this.encryptSecret(token));
    for (const key of this.tokens.keys()) {
      if (this.tokens.size <= MAX_TOKENS) break;
      if (key !== url && !keep.includes(key)) this.tokens.delete(key);
    }
    this.save();
  }

  delete(url) {
    if (this.tokens.delete(url)) this.save();
  }
}

// A short-lived version kept each agent's token in config.json
// (replication.agentTokens, encrypted with the same key): moved here once.
function importConfigTokens(repository, store) {
  const config = repository.read();
  const tokens = config.replication?.agentTokens;
  if (!tokens || typeof tokens !== "object") return 0;
  let count = 0;
  for (const [url, stored] of Object.entries(tokens)) {
    const token = typeof stored === "string" ? store.decryptSecret(stored) : "";
    if (token && !store.get(url)) {
      store.set(url, token);
      count++;
    }
  }
  delete config.replication.agentTokens;
  repository.write(config);
  return count;
}

module.exports = { AgentTokenStore, MAX_TOKENS, importConfigTokens };
