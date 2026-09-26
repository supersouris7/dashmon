"use strict";
// Widget Lichess : note ELO et variation.
//
// lichess.org applique un rate limit strict sur /api/user (429 sinon) : la
// periode de re-verification de 24 h est declaree dans le manifest, le core se
// charge de l'appliquer. L'historique des notes vit dans l'etat du widget.

const BASE_URL = "https://lichess.org";

function createState() {
  return { ratings: new Map() };
}

async function check(ctx) {
  const username = String(ctx.config.username || "").trim();
  if (!ctx.sanitizeUrl(ctx.service.url) || !username) {
    return { ok: false, error: ctx.t("missingUsername"), elo: null, delta: null, variant: "" };
  }
  const variant = String(ctx.config.variant || "").trim();
  const key = ctx.service.url || username;
  const previous = ctx.state.ratings.has(key) ? ctx.state.ratings.get(key) : null;

  try {
    const user = await ctx.api(BASE_URL, "/api/user/" + encodeURIComponent(username), {});
    const perfs = (user && user.perfs) || {};

    if (variant) {
      const rating = perfs[variant] && perfs[variant].rating;
      if (Number.isFinite(rating) && rating > 0) {
        ctx.state.ratings.set(key, rating);
        return {
          ok: true,
          elo: rating,
          prevElo: previous,
          delta: previous != null ? rating - previous : null,
          variant
        };
      }
      return { ok: false, error: "Aucun ELO pour cette variante", elo: null, delta: null, variant: "" };
    }

    const candidates = [
      ["bullet", perfs.bullet && perfs.bullet.rating],
      ["blitz", perfs.blitz && perfs.blitz.rating],
      ["rapid", perfs.rapid && perfs.rapid.rating],
      ["classical", perfs.classical && perfs.classical.rating]
    ].filter(entry => Number.isFinite(entry[1]) && entry[1] > 0);
    if (!candidates.length) {
      return { ok: false, error: "Aucun ELO enregistré", elo: null, delta: null, variant: "" };
    }
    candidates.sort((a, b) => b[1] - a[1]);
    const elo = candidates[0][1];
    ctx.state.ratings.set(key, elo);
    return {
      ok: true,
      elo,
      prevElo: previous,
      delta: previous != null ? elo - previous : null,
      variant: candidates[0][0]
    };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || "Erreur Lichess").slice(0, 200) };
  }
}

module.exports = { createState, check };
