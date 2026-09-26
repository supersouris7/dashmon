"use strict";
// Widget Docker : conteneurs actifs + images a jour.
//
// La fiabilite des mises a jour est assuree par docker.js (comparaison des
// digest avec le registre distant, authentification Bearer, selection de
// l'artefact os/arch). Ce fichier ne fait que piloter le transport et mettre
// en forme le resume pour la tuile.

const dockerApi = require("../../docker");

async function check(ctx) {
  const mode = ctx.config.mode === "tcp" ? "tcp" : "local";
  const url = String(ctx.config.url || "").trim();
  if (mode === "tcp" && !url) {
    return { ok: false, error: ctx.t("missingUrl"), containers: null, updated: null };
  }
  // Hote virtuel : le widget ne depend d'aucun hote de monitoring.
  const host = { id: "", name: "", monitoring: { docker: mode === "tcp" ? { mode: "tcp", url } : undefined } };

  try {
    const [containers, images] = await Promise.all([
      dockerApi.dockerRequest(host, "/containers/json?all=1"),
      dockerApi.dockerRequest(host, "/images/json")
    ]);
    const summary = await dockerApi.computeLiveDockerSummary(host, containers, images);
    return {
      ok: true,
      containers: { active: summary.active, total: summary.total },
      updated: { count: summary.updated, total: summary.total, unknown: summary.unknown }
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error && error.message) || "Erreur Docker").slice(0, 200),
      containers: null,
      updated: null
    };
  }
}

module.exports = { check };
