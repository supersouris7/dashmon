"use strict";
// Widget "uptimekuma" : combien de moniteurs sont en ligne sur une page de
// statut Uptime Kuma.
//
// Uptime Kuma n'a pas d'API REST pour ses moniteurs : tout passe par socket.io
// apres authentification. En revanche les pages de statut expose deux
// endpoints JSON publics, sans installation ni dependance :
//
//   GET /api/status-page/:slug            -> la liste des moniteurs
//   GET /api/status-page/heartbeat/:slug   -> l'etat actuel, par moniteur
//
// Une page de statut privee demande un Basic auth dont le login est le slug et
// le mot de passe celui de la page : d'ou le champ secret optionnel.
//
// On ne compte donc que les etats, sans mesurer de temps de reponse : le
// widget affiche "huit en ligne, deux hors ligne", ce que Kuma sait deja.
// Se tromper d'instance ou de page se voit immediatement (0 moniteur) plutot
// que de renvoyer un chiffre faux en silence.

const TIMEOUT = 6000;

// Etat d'un moniteur dans heartbeatList, d'apres la documentation de l'API de
// la page de statut.
const STATUS = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance"
};

// La liste des moniteurs est parfois imbriquee (groupes) et parfois plate :
// on accepte les deux formes plutot que de dependre d'un seul cas.
function monitorIds(list) {
  const out = [];
  const walk = nodes => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) continue;
      if (node.id != null && !node.monitorList) out.push(String(node.id));
      if (Array.isArray(node.monitorList)) walk(node.monitorList);
    }
  };
  walk(list);
  return [...new Set(out)];
}

// Dernier point connu d'un moniteur : heartbeatList contient l'historique, on
// ne garde que le plus recent de chaque serie.
function latest(list) {
  let best = null;
  for (const beat of Array.isArray(list) ? list : []) {
    if (!beat) continue;
    if (!best || String(beat.time || "") > String(best.time || "")) best = beat;
  }
  return best;
}

async function check(ctx) {
  const base = ctx.sanitizeUrl(ctx.config.url);
  const slug = String(ctx.config.slug || "").trim();
  if (!base || !slug) {
    return { ok: false, up: null, down: null, total: null, error: ctx.t("missingConfig") };
  }

  const options = { timeout: TIMEOUT };
  if (ctx.config.password) {
    options.basic = { user: slug, password: ctx.config.password };
  }

  let page;
  let beats;
  try {
    page = await ctx.api(base, "/api/status-page/" + encodeURIComponent(slug), options);
    beats = await ctx.api(base, "/api/status-page/heartbeat/" + encodeURIComponent(slug), options);
  } catch (error) {
    return {
      ok: false,
      up: null,
      down: null,
      total: null,
      error: String((error && error.message) || ctx.t("error")).slice(0, 200)
    };
  }

  const ids = monitorIds(page && (page.publicGroupList || page.monitorList));
  const list = (beats && beats.heartbeatList) || {};
  if (!ids.length) {
    return { ok: false, up: null, down: null, total: null, error: ctx.t("badAnswer") };
  }

  let up = 0;
  let down = 0;
  for (const id of ids) {
    const beat = latest(list[id]);
    const state = beat ? STATUS[Number(beat.status)] : null;
    if (state === "up") up++;
    else if (state === "down") down++;
  }

  return { ok: true, up, down, total: ids.length, error: "" };
}

module.exports = { check, monitorIds, latest };