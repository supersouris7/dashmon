"use strict";
// Widget GitHub : une statistique d'un depot (etoiles, forks,'issue, watch).
//
// L'API publique de GitHub renvoie tous ces compteurs dans une seule requete et
// n'exige rien pour un depot public — mais elle est plafonnee a 60 requetes par
// heure et par IP, d'ou la periode de 6 h. Un 403/429 signifie "lien vivant,
// API saturée" : le widget le dit et garde son etat "up".

const API_URL = "https://api.github.com";

// Champ de l'API -> libelle du manifest. Le widget n'invente pas de valeurs :
// chaque cle listee ici existe dans la reponse de /repos.
const METRICS = {
  stars: "stargazers_count",
  forks: "forks_count",
  issues: "open_issues_count",
  watchers: "subscribers_count"
};

function isValidRepo(value) {
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(String(value || "").trim());
}

async function check(ctx) {
  const repo = String(ctx.config.repo || "").trim();
  const metric = METRICS[ctx.config.metric] ? ctx.config.metric : "stars";
  if (!ctx.sanitizeUrl(ctx.service.url) || !isValidRepo(repo)) {
    return { state: "down", ok: false, error: ctx.t("missingRepo") };
  }

  try {
    const data = await ctx.api(API_URL, "/repos/" + repo, {
      headers: { Accept: "application/vnd.github+json" }
    });
    const value = data && data[METRICS[metric]];
    if (!Number.isFinite(Number(value))) {
      return { state: "up", ok: false, error: ctx.t("noCount") };
    }
    return {
      state: "up",
      ok: true,
      metric,
      value: Number(value),
      stars: Number.isFinite(Number(data.stargazers_count)) ? Number(data.stargazers_count) : null,
      forks: Number.isFinite(Number(data.forks_count)) ? Number(data.forks_count) : null,
      openIssues: Number.isFinite(Number(data.open_issues_count)) ? Number(data.open_issues_count) : null,
      license: data.license && data.license.spdx_id ? String(data.license.spdx_id) : "",
      pushedAt: data.pushed_at ? Date.parse(data.pushed_at) || null : null
    };
  } catch (error) {
    const throttled = error && (error.status === 429 || error.status === 403);
    return {
      state: throttled ? "up" : "down",
      ok: false,
      error: String((error && error.message) || "Erreur GitHub").slice(0, 200),
      throttled: !!throttled
    };
  }
}

module.exports = { check, isValidRepo, METRICS, API_URL };
