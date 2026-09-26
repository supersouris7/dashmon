"use strict";
// Widget AdGuard Home : part des requetes DNS bloquees.
//
// L'URL de l'API est saisie dans la config du widget ; a defaut on retombe sur
// l'URL du service (cas d'un AdGuard publie directement sur la tuile).

async function check(ctx) {
  const serviceUrl = ctx.sanitizeUrl(ctx.service.url);
  const rawTarget = String(ctx.config.url || "").trim().replace(/^https?:\/\//i, "");
  const target = rawTarget
    ? ctx.sanitizeUrl((ctx.config.protocol === "http" ? "http" : "https") + "://" + rawTarget)
    : serviceUrl;
  const baseUrl = String(target || "").replace(/\/+$/, "");
  if (!baseUrl) {
    return { ok: false, error: "URL AdGuard invalide", queries: 0, blocked: 0, ratio: null, avgMs: null };
  }

  const username = String(ctx.config.username || "").trim();
  const password = String(ctx.config.password || "");
  try {
    const stats = await ctx.api(baseUrl, "/control/stats",
      username || password ? { basic: { user: username, password } } : {});
    const queries = Number(stats && stats.num_dns_queries) || 0;
    const blocked = (Number(stats && stats.num_blocked_filtering) || 0)
      + (Number(stats && stats.num_replaced_safebrowsing) || 0)
      + (Number(stats && stats.num_replaced_parental) || 0)
      + (Number(stats && stats.num_replaced_safesearch) || 0);
    return {
      ok: true,
      queries,
      blocked,
      ratio: queries > 0 ? Math.round((blocked / queries) * 1000) / 10 : 0,
      avgMs: Number.isFinite(stats && stats.avg_processing_time)
        ? Math.round(stats.avg_processing_time * 1000)
        : null
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error && error.message) || "Erreur AdGuard").slice(0, 200),
      queries: 0,
      blocked: 0,
      ratio: null,
      avgMs: null
    };
  }
}

module.exports = { check };
