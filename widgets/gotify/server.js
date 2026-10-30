"use strict";
// Widget Gotify : la derniere notification est lue avec un jeton client.

function latestMessage(payload, sanitizeText) {
  const message = Array.isArray(payload && payload.messages) ? payload.messages[0] : null;
  if (!message || typeof message !== "object") return null;
  const parsed = Date.parse(String(message.date || ""));
  return {
    title: sanitizeText(message.title || "", 120),
    message: sanitizeText(message.message || "", 200),
    priority: Number.isFinite(Number(message.priority)) ? Math.trunc(Number(message.priority)) : 0,
    receivedAt: Number.isFinite(parsed) ? parsed : null
  };
}

async function check(ctx) {
  const baseUrl = String(ctx.sanitizeUrl(ctx.service.url) || "").replace(/\/+$/, "");
  const token = String(ctx.config.token || "");
  if (!baseUrl) return { ok: false, error: "URL Gotify invalide" };
  if (!token) return { ok: false, error: "Jeton client Gotify manquant" };
  try {
    const payload = await ctx.api(baseUrl, "/message?limit=1", {
      headers: { "X-Gotify-Key": token }
    });
    return { ok: true, latest: latestMessage(payload, ctx.sanitizeText) };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || "Erreur Gotify").slice(0, 200) };
  }
}

module.exports = { check, latestMessage };
