"use strict";
// Widget qBittorrent : la Web API utilise un cookie de session apres connexion.

function createState() {
  return { sessions: new Map() };
}

function cookieOf(response) {
  const value = response && response.headers && response.headers["set-cookie"];
  const first = Array.isArray(value) ? value[0] : value;
  return String(first || "").split(";", 1)[0];
}

async function login(ctx, baseUrl) {
  const username = String(ctx.config.username || "").trim();
  const password = String(ctx.config.password || "");
  if (!username || !password) throw new Error("Identifiants qBittorrent manquants");

  const body = "username=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password);
  const response = await ctx.api(baseUrl, "/api/v2/auth/login", {
    method: "POST",
    raw: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const cookie = cookieOf(response);
  if (!cookie) throw new Error("Connexion qBittorrent refusée");
  return cookie;
}

async function transferInfo(ctx, baseUrl, cookie) {
  return ctx.api(baseUrl, "/api/v2/transfer/info", { headers: { Cookie: cookie } });
}

function numberOf(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

async function check(ctx) {
  const baseUrl = String(ctx.sanitizeUrl(ctx.service.url) || "").replace(/\/+$/, "");
  if (!baseUrl) return { ok: false, error: "URL qBittorrent invalide" };

  const sessions = ctx.state.sessions;
  try {
    let cookie = sessions.get(baseUrl);
    if (!cookie) {
      cookie = await login(ctx, baseUrl);
      sessions.set(baseUrl, cookie);
    }

    let info;
    try {
      info = await transferInfo(ctx, baseUrl, cookie);
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) throw error;
      sessions.delete(baseUrl);
      cookie = await login(ctx, baseUrl);
      sessions.set(baseUrl, cookie);
      info = await transferInfo(ctx, baseUrl, cookie);
    }

    return {
      ok: true,
      connected: String(info && info.connection_status || "").toLowerCase() === "connected",
      downloadSpeed: numberOf(info && info.dl_info_speed),
      uploadSpeed: numberOf(info && info.up_info_speed),
      downloaded: numberOf(info && info.dl_info_data),
      uploaded: numberOf(info && info.up_info_data)
    };
  } catch (error) {
    sessions.delete(baseUrl);
    return { ok: false, error: String((error && error.message) || "Erreur qBittorrent").slice(0, 200) };
  }
}

function purge(activeUrls, state) {
  if (!state || !state.sessions) return;
  const keep = new Set([...activeUrls].map(url => String(url).replace(/\/+$/, "")));
  for (const baseUrl of state.sessions.keys()) {
    if (!keep.has(baseUrl)) state.sessions.delete(baseUrl);
  }
}

module.exports = { createState, check, purge, cookieOf, numberOf };
