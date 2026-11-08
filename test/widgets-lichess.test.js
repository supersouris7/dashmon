"use strict";
// Widget tests: Lichess widget: rating kept and monthly evolution.
// Shared helpers and fixtures: test/widgets/helpers.js.

const path = require("path");
const { WIDGETS, check, ok, run } = require("./widgets/helpers");

async function main() {
  // --- Widget Lichess : ELO conserve et evolution mensuelle --------------
  // Le cas qui motive tout le widget : lichess.org repond 429. La note
  // enregistree doit donc survivre au rate limit ET au redemarrage.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lichessServer = require(path.join(WIDGETS, "lichess", "server.js"));
  const files = new Map();
  const memoryStorage = {
    read: (name, fallback) => (files.has(name) ? files.get(name) : fallback),
    write: (name, value) => {
      files.set(name, value);
      return true;
    }
  };
  const lichessCtx = over =>
    Object.assign(
      {
        config: { username: "exemple", variant: "" },
        service: { url: "https://lichess.org/" },
        state: lichessServer.createState(),
        storage: memoryStorage,
        sanitizeUrl: v => String(v == null ? "" : v).trim(),
        t: k => k,
        api: async () => ({ perfs: { blitz: { rating: 1500 } } })
      },
      over || {}
    );
  const throttled = () => {
    const error = new Error("HTTP 429 Too many requests");
    error.status = 429;
    return async () => {
      throw error;
    };
  };

  const first = await lichessServer.check(lichessCtx());
  check(
    "lichess : premiere mesure enregistree",
    [first.ok, first.elo, first.variant],
    [true, 1500, "blitz"]
  );
  check("lichess : premier jour, pas encore d'evolution", first.monthDelta, null);
  ok(
    "lichess : l'historique est ecrit sur disque",
    files.has("lichess-history") && !!files.get("lichess-history").entries["exemple|*"].history
  );

  // 30 jours plus tot : la note de reference existe deja.
  const day30 = lichessServer.dayKey(Date.now() - 30 * DAY_MS);
  files.set("lichess-history", {
    version: 1,
    entries: {
      "exemple|*": {
        elo: 1450,
        variant: "blitz",
        at: Date.now() - 30 * DAY_MS,
        history: { [day30]: 1450 }
      }
    }
  });
  const monthly = await lichessServer.check(lichessCtx());
  check(
    "lichess : evolution sur un mois = 30 jours",
    [monthly.monthDelta, monthly.monthDays],
    [50, 30]
  );

  // Le rate limit frappe : la tuile garde la derniere note et son evolution.
  const limited = await lichessServer.check(lichessCtx({ api: throttled() }));
  check(
    "lichess : 429 conserve le dernier ELO",
    [limited.ok, limited.elo, limited.variant, limited.stale],
    [false, 1500, "blitz", true]
  );
  check("lichess : 429 conserve l'evolution mensuelle", limited.monthDelta, 50);
  ok("lichess : l'erreur reste signalee", String(limited.error).includes("429"), limited.error);

  // Un historique de plus de 75 jours est elague, pas conserve indefiniment.
  const ancien = new Map();
  for (let i = 0; i < 200; i++) {
    ancien[lichessServer.dayKey(Date.now() - i * DAY_MS)] = 1400 + i;
  }
  files.set("lichess-history", {
    version: 1,
    entries: { "exemple|*": { elo: 1400, variant: "blitz", at: 0, history: ancien } }
  });
  await lichessServer.check(lichessCtx());
  const kept = Object.keys(files.get("lichess-history").entries["exemple|*"].history);
  check("lichess : historique elague a la fenetre utile", kept.length, 76);

  // Sans aucune note enregistree, une erreur reste une erreur : on n'invente
  // pas de valeur.
  files.clear();
  const noData = await lichessServer.check(lichessCtx({ api: throttled() }));
  check(
    "lichess : aucune note connue -> pas de valeur fantome",
    [noData.elo, noData.stale, noData.monthDelta],
    [null, false, null]
  );

  // Le pseudo et la variante ont des historiques distincts.
  files.clear();
  await lichessServer.check(lichessCtx());
  const rapid = await lichessServer.check(
    lichessCtx({
      config: { username: "exemple", variant: "rapid" },
      api: async () => ({ perfs: { blitz: { rating: 1500 }, rapid: { rating: 1800 } } })
    })
  );
  check(
    "lichess : historique par joueur et par variante",
    [Object.keys(files.get("lichess-history").entries).sort(), rapid.elo, rapid.variant],
    [["exemple|*", "exemple|rapid"], 1800, "rapid"]
  );

  // Un compte sans note pour la variante demandee retombe sur la valeur
  // enregistree plutot que d'afficher un tiret.
  const sansVariante = await lichessServer.check(
    lichessCtx({
      config: { username: "exemple", variant: "bullet" },
      api: async () => ({ perfs: { blitz: { rating: 1500 } } })
    })
  );
  check(
    "lichess : variante absente de l'API = valeur conservee",
    [sansVariante.ok, sansVariante.elo, sansVariante.stale],
    [false, null, false]
  );
}

run(main);
