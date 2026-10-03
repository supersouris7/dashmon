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

// sanitizeUrl exige un schema : "kuma.exemple.lan" seul y renvoie une chaine
// vide, et le widget affichait alors "adresse manquante" alors meme que le
// champ etait rempli. On complete donc avant de passer au validateur du core.
function normalizeBase(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : "http://" + text;
}

// Etat d'un moniteur dans heartbeatList. Meme convention que le badge officiel
// d'Uptime Kuma : 2 (pending) et 3 (maintenance) ne sont comptes ni en ligne ni
// hors ligne.
const STATUS = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance"
};

// Dernier point connu d'un moniteur : heartbeatList contient les 100 derniers
// battements dans l'ordre chronologique (le serveur les inverse avant de
// repondre), mais on ne se fie pas a cet ordre : on compare les horodatages.
function latest(list) {
  let best = null;
  for (const beat of Array.isArray(list) ? list : []) {
    if (!beat) continue;
    if (!best || String(beat.time || "") > String(best.time || "")) best = beat;
  }
  return best;
}

async function check(ctx) {
  const base = ctx.sanitizeUrl(normalizeBase(ctx.config.url));
  const slug = String(ctx.config.slug || "").trim();
  if (!base || !slug) {
    return { ok: false, up: null, down: null, total: null, error: ctx.t("missingConfig") };
  }

  // Un seul appel suffit : les cles de heartbeatList sont deja les moniteurs
  // publics de la page de statut. Lire en plus /api/status-page/<slug>
  // n'apportait rien et ajoutait une source d'echec.
  let beats;
  try {
    beats = await ctx.api(base, "/api/status-page/heartbeat/" + encodeURIComponent(slug), {
      timeout: TIMEOUT,
      basic: ctx.config.password ? { user: slug, password: ctx.config.password } : undefined
    });
  } catch (error) {
    return {
      ok: false,
      up: null,
      down: null,
      total: null,
      error: String((error && error.message) || ctx.t("error")).slice(0, 200)
    };
  }

  const list = (beats && beats.heartbeatList) || {};
  const ids = Object.keys(list);
  if (!ids.length) {
    // Aucun moniteur : soit la page est vide, soit le slug est faux. Le dire
    // plutot que d'afficher "0 en ligne" qui ferait croire a une panne generale.
    return { ok: false, up: null, down: null, total: null, error: ctx.t("noMonitors") };
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

module.exports = { check, latest, normalizeBase };