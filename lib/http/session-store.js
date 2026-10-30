"use strict";
// Open browser sessions, kept in the data folder (sessions.json) so that they
// survive a restart. A session cookie is only accepted while its identifier is
// listed here: logging out removes it, which revokes the cookie for good even
// if it was copied.

const crypto = require("crypto");
const fs = require("fs");

// Oldest sessions are dropped beyond this many (one per browser and device).
const MAX_SESSIONS = 200;

class SessionStore {
  constructor(file, { now = Date.now } = {}) {
    this.file = file;
    this.now = now;
    this.sessions = this.load();
  }

  // id -> expiry (ms). A missing or unreadable file means no open session.
  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return new Map(
        Object.entries(raw).filter(
          ([id, expires]) => /^[\w-]{1,64}$/.test(id) && Number(expires) > 0
        )
      );
    } catch (_error) {
      return new Map();
    }
  }

  save() {
    const temporary = `${this.file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.sessions)) + "\n", {
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

  has(id) {
    const expires = this.sessions.get(id);
    return expires !== undefined && expires > this.now();
  }

  add(id, expiresAt) {
    const time = this.now();
    for (const [key, expires] of this.sessions) {
      if (expires <= time) this.sessions.delete(key);
    }
    this.sessions.set(id, expiresAt);
    // Map keeps insertion order: the first entries are the oldest sessions.
    while (this.sessions.size > MAX_SESSIONS) {
      this.sessions.delete(this.sessions.keys().next().value);
    }
    this.save();
  }

  remove(id) {
    if (this.sessions.delete(id)) this.save();
  }
}

module.exports = { SessionStore, MAX_SESSIONS };
