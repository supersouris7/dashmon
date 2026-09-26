"use strict";
// Widget Docker Hub : nombre de telechargements (pulls) d'un depot.
//
// L'API publique v2 de Docker Hub ne demande aucune authentification et
// renvoie pulls, stars et date de mise a jour. Le chiffre compte les
// telechargements du depot sur tout Docker Hub, pas ceux de l'hote surveille
// (le widget "docker" montre, lui, l'etat des conteneurs de l'hote).

const API_URL = "https://hub.docker.com/v2/repositories";
const OFFICIAL = "library/";

function isValidRepo(value) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(String(value || "").trim());
}

// "nginx" est un depot officiel : Docker Hub le range sous library/.
function repoPath(repo) {
  const value = String(repo || "").trim();
  if (!value) return "";
  return value.includes("/") ? value : OFFICIAL + value;
}

async function check(ctx) {
  const repo = String(ctx.config.repo || "").trim();
  const bare = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(repo);
  if (!ctx.sanitizeUrl(ctx.service.url) || (!isValidRepo(repo) && !bare)) {
    return { state: "down", ok: false, error: ctx.t("missingRepo") };
  }

  try {
    const data = await ctx.api(API_URL, "/" + repoPath(repo) + "/", {
      headers: { Accept: "application/json" }
    });
    if (!data || !Number.isFinite(Number(data.pull_count))) {
      return { state: "up", ok: false, error: ctx.t("noCount") };
    }
    return {
      state: "up",
      ok: true,
      pulls: Number(data.pull_count),
      stars: Number.isFinite(Number(data.star_count)) ? Number(data.star_count) : null,
      lastPush: data.last_updated ? Date.parse(data.last_updated) || null : null
    };
  } catch (error) {
    // 429 de Docker Hub : rare, mais le lien repond toujours.
    const throttled = error && (error.status === 429 || error.status === 403);
    return {
      state: throttled ? "up" : "down",
      ok: false,
      error: String((error && error.message) || "Erreur Docker Hub").slice(0, 200),
      throttled: !!throttled
    };
  }
}

module.exports = { check, isValidRepo, repoPath, API_URL };
