"use strict";
const { sanitizeIconClass } = require("../sanitize");
const { isEncryptedSecret, isMaskedSecret, maskSecret } = require("../config/secrets");

// Longest token accepted from the editor, in clear text.
const MAX_TOKEN_LENGTH = 500;

// Pairing settings (config.replication): the agents this dashboard reads
// metrics from. Names, tab icons, host links and tokens are only kept for URLs
// that are in the list of agents authorised by the user.
//
// Each agent has its own token (its DASHMON_SYNC_TOKEN), entered when pairing
// it and stored in agentTokens, encrypted like widget secrets: a token seen on
// the network opens one agent, not all of them. An agent without a saved token
// falls back to this dashboard's DASHMON_SYNC_TOKEN (fallbackToken), the
// shared token of earlier versions.
function createReplicationConfig({
  sanitizeUrl,
  sanitizeText,
  defaultName,
  encryptSecret = null,
  decryptSecret = value => String(value || ""),
  fallbackToken = ""
}) {
  function sanitizeSyncUrl(value) {
    const url = sanitizeUrl(value);
    if (!url) return "";
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.href;
    } catch (_error) {
      return "";
    }
  }

  // Stored form of a token: encrypted when a key is configured. A mask left
  // at this point stands for nothing (restoreTokens found no match): dropped.
  function cleanToken(value) {
    if (typeof value !== "string" || isMaskedSecret(value)) return "";
    const text = value.trim();
    if (!text || isEncryptedSecret(text)) return text.slice(0, 2000);
    const clear = text.slice(0, MAX_TOKEN_LENGTH);
    return encryptSecret ? encryptSecret(clear) : clear;
  }

  function sanitizeReplication(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const role = "primary";
    const instanceName = sanitizeText(source.instanceName, 100) || defaultName || "Dashmon";
    const secondaries = Array.isArray(source.secondaries)
      ? [...new Set(source.secondaries.map(sanitizeSyncUrl).filter(Boolean))].slice(0, 20)
      : [];
    function associated(rawValues, maxLength, clean = value => sanitizeText(value, maxLength)) {
      const values =
        rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? rawValues : {};
      const result = {};
      for (const [url, value] of Object.entries(values)) {
        const normalized = sanitizeSyncUrl(url);
        const text = value ? clean(value) : "";
        if (normalized && text && secondaries.includes(normalized)) result[normalized] = text;
      }
      return result;
    }
    return {
      role,
      instanceName,
      secondaries,
      agentNames: associated(source.agentNames, 100),
      // Font Awesome icon of each agent tab in the dashboard navigation.
      agentIcons: associated(source.agentIcons, 80, sanitizeIconClass),
      agentHosts: associated(source.agentHosts, 64),
      agentTokens: associated(source.agentTokens, 2000, cleanToken)
    };
  }

  function tokensOf(config) {
    const tokens = config?.replication?.agentTokens;
    return tokens && typeof tokens === "object" && !Array.isArray(tokens) ? tokens : {};
  }

  // Copy of the config sent to the browser: each token becomes its mask.
  function maskTokens(config) {
    const tokens = tokensOf(config);
    if (!Object.keys(tokens).length) return config;
    const masked = {};
    for (const [url, stored] of Object.entries(tokens)) masked[url] = maskSecret(stored);
    return { ...config, replication: { ...config.replication, agentTokens: masked } };
  }

  // Stored token a mask stands for, looked up by fingerprint: the address of
  // the agent may have been corrected in the same edit. "" when none matches.
  function storedFromMask(mask, current) {
    for (const stored of Object.values(tokensOf(current))) {
      if (maskSecret(stored) === mask) return stored;
    }
    return "";
  }

  // Copy of a config received from the browser where every mask is replaced
  // by the stored token it stands for.
  function restoreTokens(incoming, current) {
    const tokens = tokensOf(incoming);
    if (!Object.keys(tokens).length) return incoming;
    const restored = {};
    for (const [url, value] of Object.entries(tokens)) {
      restored[url] = isMaskedSecret(value) ? storedFromMask(value, current) : value;
    }
    return { ...incoming, replication: { ...incoming.replication, agentTokens: restored } };
  }

  // Token to send to a paired agent: its own, else the shared fallback.
  function tokenFor(config, url) {
    const stored = tokensOf(config)[url];
    return (stored && decryptSecret(stored)) || fallbackToken;
  }

  // Token to test an agent with, from what the editor sends: a token typed in
  // clear, the mask of a saved one, or nothing (the saved token of that
  // address, else the fallback).
  function tokenForTest(config, url, supplied) {
    const value = typeof supplied === "string" ? supplied.trim() : "";
    if (isMaskedSecret(value)) {
      const stored = storedFromMask(value, config);
      return stored ? decryptSecret(stored) : "";
    }
    if (value) return value.slice(0, MAX_TOKEN_LENGTH);
    return tokenFor(config, url);
  }

  return {
    sanitizeSyncUrl,
    sanitizeReplication,
    maskTokens,
    restoreTokens,
    tokenFor,
    tokenForTest
  };
}

module.exports = { createReplicationConfig };
