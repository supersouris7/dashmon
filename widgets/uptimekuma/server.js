"use strict";
// Widget "uptimekuma" : une ligne par page de statut, verte quand tout va bien,
// rouge des qu'un moniteur tombe.
//
// Uptime Kuma n'a pas d'API REST pour ses moniteurs : tout passe par socket.io
// apres authentification. Les pages de statut, en revanche, exposent deux
// endpoints JSON, sans installation ni dependance :
//
//   GET /api/status-page/:slug           -> titre de la page, groupes, moniteurs
//   GET /api/status-page/heartbeat/:slug  -> l'etat actuel, par moniteur
//
// Les deux filtrent sur les groupes "public" : un moniteur absent de la page de
// statut, ou dans un groupe non public, n'apparait pas.
//
// Le widget suit deux pages (deux slugs) et ne renvoie qu'un verdict par page :
// tout en ligne, ou pas. Il n'y a pas de seuil intermediaire — une couleur
// par page suffit, et un compteur "hors ligne" de plus alourdissait la tuile
// pour rien. Le detail (combien, et lesquels) reste dans l'info-bulle.

const TIMEOUT = 6000;

// Etat d'un moniteur dans heartbeatList. Meme convention que le badge officiel
// d'Uptime Kuma : 2 (pending) et 3 (maintenance) ne sont pas des pannes.
const DOWN = new Set([0]);
const UP = 1;

// Moniteurs de la page : la liste vient de publicGroupList[].monitorList[]. Les
// identifiants sont normalises en chaine, car les cles de heartbeatList sont des
// chaines alors que la page renvoie des nombres.
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

// Titre affiche : celui de la page de statut. A defaut du slug, qui reste
// lisible, plutot que d'un nom vide sur la tuile.
function titleOf(page, slug) {
  const title = String((page && page.config && page.config.title) || "").trim();
  return title || slug;
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
// protocole et se tromper eliminait la moitie des instances : Uptime Kuma est
// souvent en clair sur son port, mais derriere un reverse proxy en TLS. Le
// second essai n'a lieu que si le premier ne rend rien.
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

// Lecture d'une page sur une adresse : les deux endpoints en parallele, aucun ne
// fait echouer l'autre. Sur une version 1.x, /api/status-page/<slug> ne repond
// pas du tout quand le slug est inconnu (le gestionnaire renvoie sans ecrire de
// reponse) : sans parallelisme, ce premier appel bloquerait le second pendant
// tout son delai.
async function readPage(ctx, base, slug) {
  const call = suffix => ctx.api(base, "/api/status-page/" + suffix + encodeURIComponent(slug), {
    timeout: TIMEOUT
  });

  const [pageResult, beatsResult] = await Promise.allSettled([call(""), call("heartbeat/")]);

  const page = pageResult.status === "fulfilled" ? pageResult.value : null;
  const beats = beatsResult.status === "fulfilled" ? beatsResult.value : null;
  const list = (beats && beats.heartbeatList) || {};

  let monitors = monitorsFrom(page);
  // Repli : si la page n'a pas ete lue, les cles de heartbeatList sont deja les
  // moniteurs. Les noms seront absents, mais le verdict, lui, reste juste.
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
  return { monitors, list, title: titleOf(page, slug), pageFailed, pageStatus, failure };
}

// Verdict d'une page : vert seulement si tout est en ligne et qu'on a reellement
// pu lire la page. Une page illisible est rouge — on ne declare pas la bonne
// sante d'une information qu'on n'a pas su obtenir.
function verdictOf(slug, attempt, ctx) {
  if (!attempt.monitors.length) {
    // Trois cas tres differents, et Uptime Kuma ne les distingue pas : pour un
    // slug inconnu, /api/status-page/heartbeat/<slug> repond 200 avec un
    // heartbeatList vide au lieu d'une erreur. Sans cette distinction, un
    // identifiant errone s'affichait comme une page sans moniteur.
    const message = attempt.pageStatus >= 400
      ? ctx.t("badSlug")
      : (attempt.pageFailed ? ctx.t("unreachable") : ctx.t("noMonitors"));
    return {
      slug,
      name: slug,
      healthy: false,
      up: null,
      total: null,
      down: null,
      downNames: [],
      error: message + (attempt.failure ? " (" + attempt.failure + ")" : "")
    };
  }

  let up = 0;
  let down = 0;
  const downNames = [];
  for (const monitor of attempt.monitors) {
    const beat = latest(attempt.list[monitor.id]);
    const status = Number(beat && beat.status);
    if (status === UP) up++;
    else if (DOWN.has(status)) {
      down++;
      if (monitor.name) downNames.push(monitor.name);
    }
  }

  return {
    slug,
    name: attempt.title,
    healthy: down === 0,
    up,
    total: attempt.monitors.length,
    down,
    downNames: downNames.slice(0, 4),
    error: ""
  };
}

async function readOnFirstWorkingBase(ctx, slug) {
  // Une adresse sans schema est essaiee en https puis en http : le second essai
  // n'a lieu que si le premier n'a rendu aucun moniteur.
  let attempt = null;
  for (const base of candidateBases(ctx.config.url)) {
    const safe = ctx.sanitizeUrl(base);
    if (!safe) continue;
    attempt = await readPage(ctx, safe, slug);
    if (attempt.monitors.length) break;
  }
  return attempt || { monitors: [], list: {}, title: slug, pageFailed: true, pageStatus: 0, failure: "" };
}

async function check(ctx) {
  const slugs = [ctx.config.slug1, ctx.config.slug2]
    .map(value => String(value == null ? "" : value).trim())
    .filter(Boolean);
  const hasBase = candidateBases(ctx.config.url).some(raw => !!ctx.sanitizeUrl(raw));

  if (!hasBase || !slugs.length) {
    return { ok: false, pages: [], error: ctx.t("missingConfig") };
  }

  // Les deux pages se lisent en parallele : elles sont independantes, et un
  // identifiant errone sur l'une ne doit pas retarder l'autre.
  const attempts = await Promise.all(slugs.map(slug => readOnFirstWorkingBase(ctx, slug)));
  const pages = attempts.map((attempt, index) => verdictOf(slugs[index], attempt, ctx));

  // La tuile entiere suit le pire etat : une seule page rouge suffit a
  // signaler un probleme, sans qu'il faille survoler pour le voir.
  return {
    ok: pages.every(page => page.healthy),
    pages,
    error: ""
  };
}

module.exports = { check, latest, monitorsFrom, titleOf, candidateBases, normalizeBase };