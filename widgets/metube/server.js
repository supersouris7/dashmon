"use strict";
// Widget MeTube : /history distingue les telechargements actifs, en attente et termines.

const { resultError } = require("../../lib/http/api-errors");

function entries(value) {
  return Array.isArray(value) ? value : [];
}

function summarize(history) {
  return {
    active: entries(history && history.queue).length,
    queued: entries(history && history.pending).length,
    completed: entries(history && history.done).length
  };
}

async function check(ctx) {
  const baseUrl = String(ctx.sanitizeUrl(ctx.service.url) || "").replace(/\/+$/, "");
  if (!baseUrl) return { ok: false, ...resultError("invalid_url") };
  try {
    const history = await ctx.api(baseUrl, "/history");
    return { ok: true, ...summarize(history) };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || "Erreur MeTube").slice(0, 200) };
  }
}

module.exports = { check, summarize };
