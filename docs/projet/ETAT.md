# État du projet — Dashmon

> Point de reprise de toute session. Court, daté, mis à jour en fin d'intervention.
> Le détail opérationnel est dans les tickets GitHub ; ici, seulement la synthèse.

- Mis à jour : 2026-11-23
- Maturité : mature — Node.js, tests, lint, CI Docker multi-architecture, 11 versions étiquetées.
- Environnement de test : instance auto-hébergée du client (décision du 22/11), détails dans
  `CLAUDE.local.md` (hors dépôt).

## Dernières livraisons
- 2026-11-23 · Supervision de l'atelier (serveur distant de la fabrique) : agent Dashmon local (port publié
  sur 127.0.0.1 seulement), relevés Équipe Claude (5 min) et Claude Code (15 min) ; accès depuis le LAN par
  tunnel SSH ouvert par le Lenovo (script fabrique `tunnel-dashmon.sh`). APT non installé (installerait
  les mises à jour sans contrôle). Aucune modification de code.
- 2026-11-22 · #10 Équipe Claude : noms parlants (rôles) et « Chef de projet » (PR #11), script v2.
- 2026-11-22 · #8 Avertissement « version différente » entre agent et tableau principal (PR #9).
- 2026-11-22 · #6 Carte « Équipe Claude » (PR #7) ; relevé chaque minute installé sur ce serveur.
- Agent local à jour (9d37793), script v2 installé. Tableau principal : à mettre à jour (re-pull `unstable`).

## Fonctionnement convenu (22/11)
- Serveur = lab : pas de recette intermédiaire ; fusion autorisée en permanence (autorisations.conf).

## Prochaine action
- Accès API Portainer (jeton dans ~/.claude/fabrique/secrets/portainer.env, fourni par le client)
  pour mettre à jour le tableau principal sans manipulation manuelle.
