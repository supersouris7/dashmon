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
function normalizeBase(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : "http://" + text;
}

function reasonOf(error) {
  return String((error && error.message) || "").trim().slice(0, 120);
}

async function check(ctx) {
  const base = ctx.sanitizeUrl(normalizeBase(ctx.config.url));
  const slug = String(ctx.config.slug || "").trim();
  if (!base || !slug) {
    return { ok: false, up: null, down: null, total: null, error: ctx.t("missingConfig") };
  }

  const auth = ctx.config.password ? { user: slug, password: ctx.config.password } : undefined;
  const call = suffix => ctx.api(base, "/api/status-page/" + suffix + encodeURIComponent(slug), {
    timeout: TIMEOUT,
    basic: auth
  });

  let page = null;
  let beats = null;
  let failure = "";
  try {
    page = await call("");
  } catch (error) {
    failure = reasonOf(error);
  }
  try {
    beats = await call("heartbeat/");
  } catch (error) {
    failure = failure || reasonOf(error);
  }

  let monitors = monitorsFrom(page);
  const list = (beats && beats.heartbeatList) || {};
  // Repli : si la page n'a pas ete lue, les cles de heartbeatList sont deja les
  // moniteurs. Les noms seront absents, mais les comptes restent justes.
  if (!monitors.length) {
    monitors = Object.keys(list).map(id => ({ id, name: "" }));
  }

  if (!monitors.length) {
    // Aucun moniteur. La raison est presque toujours un slug errone ou des
    // moniteurs hors groupe public : on la dit, plutot que d'afficher
    // "0 en ligne", qui ferait croire a une panne generale.
    return {
      ok: false,
      up: null,
      down: null,
      total: null,
      error: ctx.t("noMonitors") + (failure ? " (" + failure + ")" : "")
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

module.exports = { check, latest, monitorsFrom, normalizeBase };