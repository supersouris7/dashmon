"use strict";
// Widget "uptimekuma" : combien de moniteurs sont en ligne sur une page de
// statut Uptime Kuma.
//
// Uptime Kuma n'a pas d'API REST pour ses moniteurs : tout passe par socket.io
// apres authentification. Les pages de statut, en revanche, exposent deux
// endpoints JSON, sans installation ni dependance :
//
//   GET /api/status-page/:slug           -> groupes, moniteurs et leurs noms
//   GET /api/status-page/heartbeat/:slug  -> l'etat actuel, par moniteur
//
// Les deux filtrent sur les groupes "public" de la page : un moniteur absent de
// la page de statut, ou dans un groupe non public, n'apparait pas. C'est la
// raison la plus frequente d'une liste vide, avec un slug errone.
//
// Les deux appels sont faits independamment et l'un ne fait pas echouer l'autre
// : une version d'Uptime Kuma qui n'expose pas l'un des deux reste utilisable.
// Le widget ne mesure aucun temps de reponse — il ne fait que recopier ce que
// Kuma sait deja.

const TIMEOUT = 6000;

// Etat d'un moniteur dans heartbeatList. Meme convention que le badge officiel
// d'Uptime Kuma : 2 (pending) et 3 (maintenance) ne sont comptes ni en ligne
// ni hors ligne.
const STATUS = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance"
};

// Moniteurs de la page : la liste vient de publicGroupList[].monitorList[], un
// groupe par ligne. Les identifiants sont normalises en chaine, car les cles de
// heartbeatList sont des chaines alors que la page renvoie des nombres.
function monitorsFrom(page) {
  const out = [];
  const seen = new Set();
  const groups = (page && page.publicGroupList) || [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const monitor of (group && group.monitorList) || []) {
      if (!monitor || monitor.id == null) continue;
      const id = String(monitor.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: String(monitor.name || "") });
    }
  }
  return out;
}

// Dernier point connu d'un moniteur : heartbeatList contient les derniers
// battements, mais on ne se fie pas a leur ordre et on compare les horodatages.
function latest(list) {
  let best = null;
  for (const beat of Array.isArray(list) ? list : []) {
    if (!beat) continue;
    if (!best || String(beat.time || "") > String(best.time || "")) best = beat;
  }
  return best;
}

// sanitizeUrl exige un schema : "kuma.exemple.lan" seul y renvoie une chaine
// vide, et le widget affichait alors "adresse manquante" alors meme que le
// champ etait rempli. On complete donc avant de passer au validateur du core.
//
// Une adresse sans schema est essayee en https puis en http. Deviner un seul
// protocole et se tromper eliminait la moitié des instances : Uptime Kuma est
// souvent en clair sur son port, mais derriere un reverse proxy en TLS. Les
// deux adresses ne sont essaiees que si la premiere ne rend rien.
function candidateBases(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return [];
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
    ? [text]
    : ["https://" + text, "http://" + text];
}

function normalizeBase(raw) {
  return candidateBases(raw)[0] || "";
}

function reasonOf(error) {
  return String((error && error.message) || "").trim().slice(0, 120);
}

// Une tentative sur une adresse : les deux endpoints en parallele, aucun ne fait
// echouer l'autre. Sur une version 1.x, /api/status-page/<slug> ne repond pas
// du tout quand le slug est inconnu (le gestionnaire renvoie sans ecrire de
// reponse) : sans parallelisme, ce premier appel bloquerait le second pendant
// tout son delai.
async function tryBase(ctx, base, slug) {
  const auth = ctx.config.password ? { user: slug, password: ctx.config.password } : undefined;
  const call = suffix => ctx.api(base, "/api/status-page/" + suffix + encodeURIComponent(slug), {
    timeout: TIMEOUT,
    basic: auth
  });

  const [pageResult, beatsResult] = await Promise.allSettled([call(""), call("heartbeat/")]);

  const page = pageResult.status === "fulfilled" ? pageResult.value : null;
  const beats = beatsResult.status === "fulfilled" ? beatsResult.value : null;
  const list = (beats && beats.heartbeatList) || {};

  let monitors = monitorsFrom(page);
  // Repli : si la page n'a pas ete lue, les cles de heartbeatList sont deja les
  // moniteurs. Les noms seront absents, mais les comptes restent justes.
  if (!monitors.length) {
    monitors = Object.keys(list).map(id => ({ id, name: "" }));
  }

  const pageFailed = pageResult.status === "rejected";
  // Une erreur HTTP porte son code (error.status), une panne reseau n'en porte
  // pas : c'est ce qui permet de ne pas confondre un slug errone avec une
  // instance injoignable.
  const pageStatus = pageFailed ? Number(pageResult.reason && pageResult.reason.status) || 0 : 0;
  const failure = reasonOf(
    pageFailed ? pageResult.reason
      : (beatsResult.status === "rejected" ? beatsResult.reason : null)
  );
  return { monitors, list, pageFailed, pageStatus, failure };
}

async function check(ctx) {
  const slug = String(ctx.config.slug || "").trim();
  const bases = candidateBases(ctx.config.url)
    .map(raw => ctx.sanitizeUrl(raw))
    .filter(Boolean);
  if (!bases.length || !slug) {
    return { ok: false, up: null, down: null, total: null, error: ctx.t("missingConfig") };
  }

  // Une adresse sans schema est essaiee en https puis en http : le second essai
  // n'a lieu que si le premier n'a rendu aucun moniteur.
  let attempt = null;
  let failure = "";
  for (const base of bases) {
    attempt = await tryBase(ctx, base, slug);
    failure = attempt.failure || failure;
    if (attempt.monitors.length) break;
  }

  const monitors = attempt.monitors;
  const list = attempt.list;

  if (!monitors.length) {
    // Trois cas tres differents, et Uptime Kuma ne les distingue pas : pour un
    // slug inconnu, /api/status-page/heartbeat/<slug> repond 200 avec un
    // heartbeatList vide au lieu d'une erreur. Sans cette distinction, un
    // identifiant errone s'affichait comme "aucun moniteur", donc comme une
    // page vide — un message qui envoyait chercher au mauvais endroit.
    const message = attempt.pageStatus >= 400
      ? ctx.t("badSlug")
      : (attempt.pageFailed ? ctx.t("unreachable") : ctx.t("noMonitors"));
    return {
      ok: false,
      up: null,
      down: null,
      total: null,
      error: message + (failure ? " (" + failure + ")" : "")
    };
  }

  let up = 0;
  let down = 0;
  const downNames = [];
  let unknown = 0;

  for (const monitor of monitors) {
    const state = STATUS[Number((latest(list[monitor.id]) || {}).status)];
    if (state === "up") up++;
    else if (state === "down") {
      down++;
      if (monitor.name) downNames.push(monitor.name);
    } else unknown++;
  }

  return {
    ok: true,
    up,
    down,
    unknown,
    total: monitors.length,
    downNames: downNames.slice(0, 4),
    error: ""
  };
}

module.exports = { check, latest, monitorsFrom, candidateBases, normalizeBase };