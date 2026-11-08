"use strict";
// Widget tests: Browser renderers of the widgets (ESM, no DOM).
// Shared helpers and fixtures: test/widgets/helpers.js.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { ROOT, WIDGETS, check, ok, pick, run } = require("./widgets/helpers");

async function main() {
  // --- Renderers client (ESM, aucune dependance au DOM) ------------------
  const dockerModule = await import(pathToFileURL(path.join(WIDGETS, "docker", "client.mjs")).href);
  const duplicatiModule = await import(
    pathToFileURL(path.join(WIDGETS, "duplicati", "client.mjs")).href
  );
  const adguardModule = await import(
    pathToFileURL(path.join(WIDGETS, "adguard", "client.mjs")).href
  );
  const qBittorrentModule = await import(
    pathToFileURL(path.join(WIDGETS, "qbittorrent", "client.mjs")).href
  );
  const metubeModule = await import(pathToFileURL(path.join(WIDGETS, "metube", "client.mjs")).href);
  const gotifyModule = await import(pathToFileURL(path.join(WIDGETS, "gotify", "client.mjs")).href);
  const lichessModule = await import(
    pathToFileURL(path.join(WIDGETS, "lichess", "client.mjs")).href
  );
  const youtubeModule = await import(
    pathToFileURL(path.join(WIDGETS, "youtube", "client.mjs")).href
  );
  const dockerHubModule = await import(
    pathToFileURL(path.join(WIDGETS, "dockerhub", "client.mjs")).href
  );
  const githubModule = await import(pathToFileURL(path.join(WIDGETS, "github", "client.mjs")).href);

  const fmt = {
    formatDateTime: () => "01/01/2026",
    formatNumber: n => String(n),
    formatCompactNumber: n => String(n),
    formatCompactCount: n => String(n)
  };
  const ctx = (info, extra) =>
    Object.assign({ info, config: {}, lang: "fr", t: k => k }, fmt, extra || {});

  check(
    "renderer Docker : conteneurs et MAJ",
    pick(
      dockerModule.render(
        ctx({
          ok: true,
          containers: { active: 8, total: 9 },
          updated: { count: 8, total: 9, unknown: 1 }
        })
      )
    ),
    { badge: "up 8", badgeClass: "nok", time: "updated 8", timeClass: "warn" }
  );
  check(
    "renderer Docker : tout vert",
    pick(
      dockerModule.render(
        ctx({
          ok: true,
          containers: { active: 9, total: 9 },
          updated: { count: 9, total: 9, unknown: 0 }
        })
      )
    ),
    { badge: "up 9", badgeClass: "ok", time: "updated 9", timeClass: "delta-up" }
  );
  // Les totaux quittent la tuile mais restent dans l'info-bulle : sans eux,
  // "8" ne dit pas si la cible compte 8 services ou 80.
  ok(
    "renderer Docker : le total reste dans l'info-bulle",
    /8 \/ 9/.test(
      dockerModule.render(
        ctx({
          ok: true,
          containers: { active: 8, total: 9 },
          updated: { count: 8, total: 9, unknown: 1 }
        })
      ).title
    ),
    dockerModule.render(
      ctx({
        ok: true,
        containers: { active: 8, total: 9 },
        updated: { count: 8, total: 9, unknown: 1 }
      })
    ).title
  );
  check(
    "renderer Docker : erreur = tuile neutre",
    dockerModule.render(ctx({ error: "ECONNREFUSED" })).badgeClass,
    "pending"
  );
  check("renderer Docker : jamais verifie = tirets", dockerModule.render(ctx(null)).badge, "—");
  // Les deux libelles de la tuile Docker doivent suivre la langue de
  // l'interface : le renderer ne doit contenir aucun mot en dur.
  const dockerStrings = JSON.parse(
    fs.readFileSync(path.join(WIDGETS, "docker", "manifest.json"), "utf8")
  ).strings;
  const localized = lang => info => ctx(info, { t: k => (dockerStrings[lang] || {})[k] || k });
  const allGreen = {
    ok: true,
    containers: { active: 9, total: 9 },
    updated: { count: 9, total: 9, unknown: 0 }
  };
  check(
    "renderer Docker : libelles anglais",
    pick(dockerModule.render(localized("en")(allGreen))),
    { badge: "up 9", badgeClass: "ok", time: "updated 9", timeClass: "delta-up" }
  );
  check(
    "renderer Docker : libelles francais",
    pick(dockerModule.render(localized("fr")(allGreen))),
    { badge: "en ligne 9", badgeClass: "ok", time: "à jour 9", timeClass: "delta-up" }
  );
  check(
    "renderer Docker : EACCES affiche le remede",
    pick(
      dockerModule.render(
        localized("fr")({ error: "Socket Docker inaccessible (EACCES) : ajoutez group_add" })
      )
    ),
    {
      badge: "Docker —",
      badgeClass: "pending",
      time: "EACCES : ajoutez group_add",
      timeClass: "warn"
    }
  );
  check(
    "renderer Docker : le tooltip reprend les deux libelles",
    dockerModule.render(localized("fr")(allGreen)).title,
    "Docker · en ligne 9 / 9 · à jour 9 / 9"
  );
  ok(
    "renderer Docker : images non verifiees au singulier",
    dockerModule
      .render(
        localized("fr")({
          ok: true,
          containers: { active: 9, total: 9 },
          updated: { count: 9, total: 9, unknown: 1 }
        })
      )
      .title.endsWith(" · 1 non vérifié")
  );
  ok(
    "renderer Docker : images non verifiees au pluriel",
    dockerModule
      .render(
        localized("fr")({
          ok: true,
          containers: { active: 9, total: 9 },
          updated: { count: 9, total: 9, unknown: 3 }
        })
      )
      .title.endsWith(" · 3 non vérifiés")
  );

  check(
    "renderer Duplicati : sauvegarde OK",
    pick(duplicatiModule.render(ctx({ ok: true, lastAttemptAt: 1 }))),
    { badge: "badgeOk", badgeClass: "ok", time: "01/01/2026", timeClass: "" }
  );
  check(
    "renderer Duplicati : echec = NOK",
    pick(duplicatiModule.render(ctx({ ok: false, lastAttemptAt: 1 }))).badgeClass,
    "nok"
  );
  check(
    "renderer Duplicati : aucune sauvegarde",
    duplicatiModule.render(ctx({ ok: null, lastAttemptAt: null })).badge,
    "—"
  );

  check(
    "renderer AdGuard : pourcentage",
    pick(adguardModule.render(ctx({ ok: true, queries: 12345, ratio: 12.3, avgMs: 2 }))),
    { badge: "blocked 12 %", badgeClass: "ok", time: "queries 12345", timeClass: "" }
  );

  check(
    "renderer qBittorrent : debits affiches",
    pick(
      qBittorrentModule.render(
        ctx({
          ok: true,
          connected: true,
          downloadSpeed: 1048576,
          uploadSpeed: 1024,
          downloaded: 0,
          uploaded: 0
        })
      )
    ),
    { badge: "↓ 1 MiB/s", badgeClass: "ok", time: "↑ 1 KiB/s", timeClass: "" }
  );
  check(
    "renderer qBittorrent : deconnecte avertit",
    qBittorrentModule.render(ctx({ ok: true, connected: false, downloadSpeed: 0, uploadSpeed: 0 }))
      .badgeClass,
    "warn"
  );
  check(
    "renderer MeTube : activite et file affichees",
    pick(metubeModule.render(ctx({ ok: true, active: 2, queued: 1, completed: 3 }))),
    { badge: "3 completedMany", badgeClass: "ok", time: "2 activeMany", timeClass: "" }
  );
  check(
    "renderer Gotify : derniere notification affichee",
    pick(
      gotifyModule.render(
        ctx({
          ok: true,
          latest: { title: "Sauvegarde", message: "Terminée", priority: 5, receivedAt: 1 }
        })
      )
    ),
    { badge: "Sauvegarde", badgeClass: "warn", time: "priority 5", timeClass: "" }
  );

  check(
    "renderer Lichess : ELO en vert, evolution mensuelle en dessous",
    pick(
      lichessModule.render(
        ctx({
          ok: true,
          elo: 1500,
          delta: 12,
          monthDelta: 42,
          monthDays: 30,
          variant: "blitz",
          updatedAt: 1
        })
      )
    ),
    { badge: "ELO 1500", badgeClass: "ok", time: "+42 over 30 days", timeClass: "delta-up" }
  );
  const loss = pick(
    lichessModule.render(
      ctx({ ok: true, elo: 1500, monthDelta: -8, monthDays: 30, variant: "blitz" })
    )
  );
  check("renderer Lichess : perte mensuelle en gris, pas en rouge", loss.timeClass, "");
  check("renderer Lichess : perte mensuelle toujours chiffree", loss.time, "-8 over 30 days");
  check(
    "renderer Lichess : historique plus court que le mois = duree reelle",
    pick(
      lichessModule.render(
        ctx({ ok: true, elo: 1500, monthDelta: 5, monthDays: 4, variant: "blitz" })
      )
    ).time,
    "+5 over 4 days"
  );
  check(
    "renderer Lichess : premiere visite (pas d'historique)",
    lichessModule.render(
      ctx({ ok: true, elo: 1500, delta: null, monthDelta: null, variant: "blitz" })
    ).time,
    "—"
  );
  check(
    "renderer Lichess : note constante",
    pick(
      lichessModule.render(
        ctx({ ok: true, elo: 1500, monthDelta: 0, monthDays: 30, variant: "blitz" })
      )
    ).timeClass,
    ""
  );
  const staleView = lichessModule.render(
    ctx({
      ok: false,
      elo: 1500,
      monthDelta: 42,
      monthDays: 30,
      variant: "blitz",
      updatedAt: 1,
      stale: true,
      error: "HTTP 429"
    })
  );
  check(
    "renderer Lichess : 429 = derniere valeur connue, toujours verte",
    [staleView.badge, staleView.badgeClass],
    ["ELO 1500", "ok"]
  );
  ok(
    "renderer Lichess : l'info-bulle signale la valeur conservee et l'erreur",
    staleView.title.includes("stale") &&
      staleView.title.includes("HTTP 429") &&
      staleView.title.includes("01/01/2026"),
    staleView.title
  );
  check(
    "renderer Lichess : aucun ELO connu = tirets",
    lichessModule.render(ctx({ error: "HTTP 429" })).badge,
    "ELO —"
  );

  // Les renderers de liens : meme contrat, meme langue, compteurs compacts.
  // Ils utilisent les vrais utilitaires d'affichage (le dashboard ne redefinit
  // pas de format dans un widget) : on normalise seulement les espaces
  // insecables, que Intl rend differemment selon la version d'ICU.
  const formatModule = await import(
    pathToFileURL(path.join(ROOT, "public", "js", "format.js")).href
  );
  const norm = value => String(value).replace(/[\u202f\u00a0]/g, " ");
  const linkStrings = id => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(WIDGETS, id, "manifest.json"), "utf8")
    ).strings;
    return lang => k => (raw[lang] || {})[k] || k;
  };
  const renderCtx = (id, lang, info) =>
    Object.assign(
      { info, config: {}, lang, t: linkStrings(id)(lang) },
      formatModule.formatters(lang)
    );

  // AdGuard affiche le volume de requetes en k/M (meme format que les
  // compteurs du bandeau), pour eviter une longue suite de chiffres.
  check(
    "renderer AdGuard : requetes compactes en k",
    adguardModule.render(
      renderCtx("adguard", "fr", { ok: true, queries: 12345, ratio: 12.3, avgMs: 2 })
    ).time,
    "requêtes 12.3k"
  );
  check(
    "renderer AdGuard : requetes compactes en M",
    adguardModule.render(renderCtx("adguard", "fr", { ok: true, queries: 3450000, ratio: 12.3 }))
      .time,
    "requêtes 3.5M"
  );
  check(
    "renderer AdGuard : petit volume inchange",
    adguardModule.render(renderCtx("adguard", "fr", { ok: true, queries: 842, ratio: 12.3 })).time,
    "requêtes 842"
  );

  const ytView = youtubeModule.render(
    renderCtx("youtube", "fr", { ok: true, subscribers: 3450, ms: 180 })
  );
  check(
    "renderer YouTube : abonnements",
    { ...pick(ytView), badge: norm(ytView.badge) },
    { badge: "YouTube (3 450)", badgeClass: "ok", time: "180 ms", timeClass: "" }
  );
  ok(
    "renderer YouTube : le tooltip reprend le compte",
    norm(ytView.title).startsWith("YouTube · 3 450"),
    ytView.title
  );
  check(
    "renderer YouTube : grand compte compacte",
    norm(
      youtubeModule.render(renderCtx("youtube", "fr", { ok: true, subscribers: 3450000 })).badge
    ),
    "YouTube (3,5 M)"
  );
  check(
    "renderer YouTube : anglais",
    youtubeModule.render(renderCtx("youtube", "en", { ok: true, subscribers: 3450 })).badge,
    "YouTube (3,450)"
  );
  // La page repond mais le compteur est absent : ni vert ni rouge.
  check(
    "renderer YouTube : compteur illisible = tuile neutre",
    youtubeModule.render(renderCtx("youtube", "fr", { ok: false, state: "up", error: "noCount" }))
      .badgeClass,
    "warn"
  );
  check(
    "renderer YouTube : lien en panne = tuile rouge",
    youtubeModule.render(
      renderCtx("youtube", "fr", { ok: false, state: "down", error: "HTTP 503" })
    ).badgeClass,
    "nok"
  );
  check(
    "renderer YouTube : jamais verifie = tirets",
    youtubeModule.render(renderCtx("youtube", "fr", null)).badge,
    "—"
  );

  const hubInfo = { ok: true, pulls: 12400000000, stars: 20000, lastPush: 1, ms: 90 };
  const hubView = dockerHubModule.render(renderCtx("dockerhub", "fr", hubInfo));
  check(
    "renderer Docker Hub : pulls compacts",
    { ...pick(hubView), badge: norm(hubView.badge) },
    { badge: "Docker Hub (12,4 Md)", badgeClass: "ok", time: "90 ms", timeClass: "" }
  );
  ok(
    "renderer Docker Hub : le tooltip liste pulls, etoiles et date",
    norm(hubView.title).includes("12 400 000 000") &&
      norm(hubView.title).includes("20 000") &&
      norm(hubView.title).includes(formatModule.formatDateTime(1, "fr")),
    hubView.title
  );
  check(
    "renderer Docker Hub : API throttle = tuile neutre",
    dockerHubModule.render(
      renderCtx("dockerhub", "fr", { ok: false, state: "up", throttled: true })
    ).badgeClass,
    "warn"
  );
  check(
    "renderer Docker Hub : jamais verifie = tirets",
    dockerHubModule.render(renderCtx("dockerhub", "fr", null)).badge,
    "—"
  );

  const ghInfo = {
    ok: true,
    metric: "forks",
    value: 21,
    stars: 302,
    forks: 21,
    openIssues: 4,
    ms: 42
  };
  const ghView = githubModule.render(renderCtx("github", "fr", ghInfo));
  check(
    "renderer GitHub : statistique demandee",
    { ...pick(ghView), badge: norm(ghView.badge) },
    { badge: "GitHub (21)", badgeClass: "ok", time: "42 ms", timeClass: "" }
  );
  ok(
    "renderer GitHub : le tooltip reprend la statistique et les autres compteurs",
    norm(ghView.title).includes("21 forks") &&
      norm(ghView.title).includes("302 étoiles") &&
      norm(ghView.title).includes("4 issues"),
    ghView.title
  );
  ok(
    "renderer GitHub : la statistique choisie n'est pas repetee deux fois",
    (norm(ghView.title).match(/21 forks/g) || []).length === 1,
    ghView.title
  );
  check(
    "renderer GitHub : etoiles par defaut",
    norm(
      githubModule.render(
        renderCtx("github", "fr", { ok: true, metric: "stars", value: 302, stars: 302 })
      ).badge
    ),
    "GitHub (302)"
  );
  check(
    "renderer GitHub : API throttle = tuile neutre",
    githubModule.render(renderCtx("github", "fr", { ok: false, state: "up", throttled: true }))
      .badgeClass,
    "warn"
  );
  check(
    "renderer GitHub : jamais verifie = tirets",
    githubModule.render(renderCtx("github", "fr", null)).badge,
    "—"
  );

  // Un renderer qui leve ne doit pas faire tomber le appelant : c'est le core
  // navigateur (widget-registry.js) qui rattrape, on verifie donc que le
  // descripteur de secours reste affichable.
  ok(
    "renderer : contrat { badge, badgeClass, time, timeClass, title }",
    ["badge", "badgeClass", "time", "timeClass", "title"].every(
      k =>
        k in
        dockerModule.render(
          ctx({
            ok: true,
            containers: { active: 1, total: 1 },
            updated: { count: 1, total: 1, unknown: 0 }
          })
        )
    )
  );
}

run(main);
