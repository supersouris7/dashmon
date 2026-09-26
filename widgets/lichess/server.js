"use strict";
// Widget Lichess : note ELO, evolution sur un mois, derniere valeur connue.
//
// lichess.org applique un rate limit strict sur /api/user : la periode de
// re-verification de 24 h est declaree dans le manifest, le core se charge de
// l'appliquer. Mais un 429 peut survenir malgre tout (relance du conteneur,
// several widgets, IP partagee...), donc chaque note est enregistree sur
// disque via ctx.storage :
//
//   - la tuile reste informative meme quand lichess.org ne repond plus ;
//   - l'evolution affichee se mesure sur un mois, pas sur la derniere reponse ;
//   - l'historique survit a un redemarrage, donc le "sur 30 jours" se construit
//     jour apres jour sans jamais dependre du rate limit.

const BASE_URL = "https://lichess.org";
const STORAGE_FILE = "lichess-history";
const MONTH_DAYS = 30;   // fenetre affichee sous l'ELO
const KEEP_DAYS = 75;    // historique conserve (laisse de la marge)
const DAY_MS = 24 * 60 * 60 * 1000;

function createState() {
  return { ratings: new Map() };
}

// Jour local au format YYYY-MM-DD : une seule entree par jour suffisent, deux
// verifications le meme jour ne creent pas de second point.
function dayKey(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function startOfDay(day) {
  const ts = Date.parse(`${day}T00:00:00`);
  return Number.isFinite(ts) ? ts : NaN;
}

// Un seul fichier pour tous les joueurs/variantes surveilles.
function readStore(ctx) {
  const store = ctx.storage.read(STORAGE_FILE, null);
  if (!store || typeof store !== "object" || !store.entries || typeof store.entries !== "object") {
    return { version: 1, entries: {} };
  }
  return store;
}

function recordFor(store, key) {
  const entry = store.entries[key];
  if (!entry || typeof entry !== "object") return null;
  const history = entry.history && typeof entry.history === "object" ? entry.history : {};
  return { elo: Number.isFinite(entry.elo) ? entry.elo : null, variant: String(entry.variant || ""), at: Number(entry.at) || 0, history };
}

function recordSnapshot(ctx, key, elo, variant) {
  const store = readStore(ctx);
  const entry = recordFor(store, key) || { elo: null, variant: "", at: 0, history: {} };
  const now = Date.now();
  entry.history[dayKey(now)] = elo;
  entry.elo = elo;
  entry.variant = variant;
  entry.at = now;
  // On garde la fenetre KEEP_DAYS la plus recente.
  const floor = dayKey(now - KEEP_DAYS * DAY_MS);
  for (const day of Object.keys(entry.history)) {
    if (day < floor) delete entry.history[day];
  }
  store.entries[key] = entry;
  ctx.storage.write(STORAGE_FILE, store);
  return entry;
}

// Evolution sur la fenetre d'un mois : la reference est le point le plus
// recent datant d'au moins MONTH_DAYS. Si l'historique est plus court, on
// compare a la plus ancienne valeur connue et on renvoie la vraie duree pour
// que l'affichage ne pretende pas a un mois complet.
function monthProgress(entry, current, now) {
  const history = (entry && entry.history) || {};
  const days = Object.keys(history).sort();
  if (!days.length) return { delta: null, days: 0 };

  const target = now - MONTH_DAYS * DAY_MS;
  let from = null;
  for (const day of days) {
    const ts = startOfDay(day);
    if (Number.isFinite(ts) && ts <= target) from = day;
  }
  let span;
  if (from) {
    span = MONTH_DAYS;
  } else {
    from = days[0];
    const elapsed = Math.floor((now - startOfDay(from)) / DAY_MS);
    span = Math.max(0, Math.min(MONTH_DAYS, elapsed));
  }
  const reference = Number(history[from]);
  if (!Number.isFinite(reference)) return { delta: null, days: 0 };
  // Premier jour de suivi : le seul point connu est celui d'aujourd'hui, il n'y
  // a rien auquel comparer. L'evolution apparaitra des le lendemain.
  if (from === dayKey(now)) return { delta: null, days: 0 };
  return { delta: current - reference, days: span };
}

async function check(ctx) {
  const username = String(ctx.config.username || "").trim();
  const variant = String(ctx.config.variant || "").trim();
  if (!ctx.sanitizeUrl(ctx.service.url) || !username) {
    return { ok: false, error: ctx.t("missingUsername"), elo: null, delta: null, variant: "", stale: false };
  }

  // L'historique appartient au joueur et a la variante, pas au service : deux
  // tuiles du meme joueur n'ont donc pas deux historiques.
  const key = `${username.toLowerCase()}|${variant || "*"}`;
  const stored = recordFor(readStore(ctx), key);
  const previous = ctx.state.ratings.has(key) ? ctx.state.ratings.get(key) : null;

  // Derniere valeur connue : elle reste affichee meme si l'appel echoue.
  const fallbackResult = error => {
    if (stored && stored.elo != null) {
      const progress = monthProgress(stored, stored.elo, Date.now());
      return {
        ok: false,
        error: String(error || "").slice(0, 200),
        elo: stored.elo,
        prevElo: previous,
        delta: previous != null ? stored.elo - previous : null,
        variant: stored.variant,
        monthDelta: progress.delta,
        monthDays: progress.days,
        updatedAt: stored.at,
        stale: true
      };
    }
    return {
      ok: false,
      error: String(error || "").slice(0, 200),
      elo: null,
      delta: null,
      variant: "",
      monthDelta: null,
      monthDays: 0,
      updatedAt: 0,
      stale: false
    };
  };

  try {
    const user = await ctx.api(BASE_URL, "/api/user/" + encodeURIComponent(username), {});
    const perfs = (user && user.perfs) || {};

    const pick = (() => {
      if (variant) {
        const rating = perfs[variant] && perfs[variant].rating;
        return Number.isFinite(rating) && rating > 0 ? { elo: rating, variant } : null;
      }
      const candidates = [
        ["bullet", perfs.bullet && perfs.bullet.rating],
        ["blitz", perfs.blitz && perfs.blitz.rating],
        ["rapid", perfs.rapid && perfs.rapid.rating],
        ["classical", perfs.classical && perfs.classical.rating]
      ].filter(entry => Number.isFinite(entry[1]) && entry[1] > 0);
      if (!candidates.length) return null;
      candidates.sort((a, b) => b[1] - a[1]);
      return { elo: candidates[0][1], variant: candidates[0][0] };
    })();

    if (!pick) return fallbackResult(ctx.t("noElo"));

    const entry = recordSnapshot(ctx, key, pick.elo, pick.variant);
    const progress = monthProgress(entry, pick.elo, Date.now());
    ctx.state.ratings.set(key, pick.elo);
    return {
      ok: true,
      elo: pick.elo,
      prevElo: previous,
      delta: previous != null ? pick.elo - previous : null,
      variant: pick.variant,
      monthDelta: progress.delta,
      monthDays: progress.days,
      updatedAt: Date.now(),
      stale: false
    };
  } catch (error) {
    // 429 compris : la tuile garde la derniere note connue.
    return fallbackResult(String((error && error.message) || "Erreur Lichess"));
  }
}

module.exports = { createState, check, dayKey, monthProgress, MONTH_DAYS };
