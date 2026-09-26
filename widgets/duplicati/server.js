"use strict";
// Widget Duplicati : etat de la derniere sauvegarde.
//
// Le widget nimplemente QUE la logique metier. Le core fournit la config
// (secret deja dechiffre), le client HTTP, le cache et la frequence.

function createState() {
  // Tokens par URL de serveur : on ne s'identifie qu'une fois par cycle, les
  // re-logins sont reserves aux reponses 401.
  return { tokens: new Map() };
}

async function login(ctx, baseUrl, password) {
  const response = await ctx.api(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { Password: password, RememberMe: false }
  });
  const token = response && (response.AccessToken || response.accessToken);
  if (!token || typeof token !== "string" || !token.length) {
    throw new Error("Connexion Duplicati : token manquant");
  }
  return token;
}

async function listBackups(ctx, baseUrl, token) {
  const data = await ctx.api(baseUrl, "/api/v1/backups", { token });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data && data.Backups)) return data.Backups;
  if (Array.isArray(data && data.backups)) return data.backups;
  throw new Error("Réponse Duplicati inattendue");
}

// Formule Duplicati ("yyyyMMdd'T'HHmmssK", UTC) : 20260925T153045Z
function parseDate(value) {
  if (!value) return null;
  const match = String(value).trim()
    .match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;
  const zone = match[7] || "Z";
  const ms = Date.parse(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${zone}`
  );
  return Number.isFinite(ms) ? ms : null;
}

function computeStatus(backups) {
  let total = 0;
  let okCount = 0;
  let errCount = 0;
  let lastAttemptAt = null;
  let lastErrorAt = null;

  for (const entry of Array.isArray(backups) ? backups : []) {
    // /api/v1/backups retourne des entrees enveloppees {"Backup":{...},"Schedule":{...}}.
    const backup = (entry && (entry.Backup || entry.backup)) || entry;
    const metadata = (backup && (backup.Metadata || backup.metadata)) || {};
    const lastBackup = parseDate(metadata.LastBackupFinished) ?? parseDate(metadata.LastBackupDate);
    const lastError = parseDate(metadata.LastErrorDate);
    if (!lastBackup && !lastError) continue;

    total++;
    const failed = lastError && (!lastBackup || lastError >= lastBackup);
    if (failed) errCount++;
    else okCount++;

    const attempt = Math.max(lastBackup ?? -Infinity, lastError ?? -Infinity);
    if (lastAttemptAt === null || attempt > lastAttemptAt) lastAttemptAt = attempt;
    if (failed && (lastErrorAt === null || lastError > lastErrorAt)) lastErrorAt = lastError;
  }

  if (total === 0) {
    return { ok: null, lastAttemptAt: null, lastErrorAt: null, total: 0, okCount: 0, errCount: 0 };
  }
  const latestError = lastAttemptAt !== null && lastErrorAt !== null && lastErrorAt >= lastAttemptAt;
  return { ok: !latestError, lastAttemptAt, lastErrorAt, total, okCount, errCount };
}

async function check(ctx) {
  const url = ctx.sanitizeUrl(ctx.service.url);
  if (!url) {
    return { ok: false, error: "URL Duplicati invalide", lastAttemptAt: null, total: 0, okCount: 0, errCount: 0, lastErrorAt: null };
  }
  const baseUrl = url.replace(/\/+$/, "");
  const tokens = ctx.state.tokens;

  try {
    let token = tokens.get(baseUrl);
    if (!token) {
      token = await login(ctx, baseUrl, ctx.config.password);
      tokens.set(baseUrl, token);
    }

    let backups;
    try {
      backups = await listBackups(ctx, baseUrl, token);
    } catch (error) {
      // Token expire/revoque : un seul re-login puis on reessaie.
      if (error.status === 401 || /401|Unauthorized/i.test(String(error.message || ""))) {
        tokens.delete(baseUrl);
        const fresh = await login(ctx, baseUrl, ctx.config.password);
        tokens.set(baseUrl, fresh);
        backups = await listBackups(ctx, baseUrl, fresh);
      } else {
        throw error;
      }
    }

    const status = computeStatus(backups);
    return {
      ok: status.ok === true,
      lastAttemptAt: status.lastAttemptAt,
      lastErrorAt: status.lastErrorAt,
      total: status.total,
      okCount: status.okCount,
      errCount: status.errCount
    };
  } catch (error) {
    tokens.delete(baseUrl);
    return { ok: false, error: String((error && error.message) || "Erreur Duplicati").slice(0, 200) };
  }
}

// Oubli des tokens des serveurs qui ne sont plus configures.
function purge(activeUrls, state) {
  if (!state || !state.tokens) return;
  const keep = new Set();
  for (const url of activeUrls) keep.add(String(url).replace(/\/+$/, ""));
  for (const key of [...state.tokens.keys()]) {
    if (!keep.has(String(key).replace(/\/+$/, ""))) state.tokens.delete(key);
  }
}

module.exports = { createState, check, purge };
