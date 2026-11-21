# Dashmon — règles du projet

> Complète le socle commun de la fabrique (`~/.claude/CLAUDE.md`, `~/.claude/fabrique/standards/`),
> sans jamais l'affaiblir en sécurité. Point de reprise : `docs/projet/ETAT.md`.

## Produit
- Vision : `docs/projet/VISION.md`. Spécifications : `README.md`, `docs/ARCHITECTURE.md`, `docs/WIDGETS.md`, `CUSTOMIZATION.md`.
- Décisions d'architecture : `docs/adr/`.

## Pile et commandes de contrôle
- Node.js (npm)
  - `npm run lint`
  - `npm run test`
- Docker (image analysée par Trivy en CI si configuré)
- CI GitHub Actions : docker.yml 

## Stratégie de tests
- `npm test`

## Environnements
- Test (déploiement autorisé aux agents, sauvegarde avant mise à jour) : instance auto-hébergée du client ;
  détails et procédure dans `CLAUDE.local.md` (local, non versionné : dépôt public).
- Production : uniquement avec accord explicite du client.

## Suivi
- Dépôt : GitHub supersouris7/dashmon · Tableau : à créer (gh-projet.sh) · Branche principale : main
- Branches : `feat|fix|chore/<n° ticket>-<slug>` ; une PR par ticket, `Closes #n`.

## Règles spécifiques
@AGENTS.md
- Conventions de contribution : `CONTRIBUTING.md`.
- Dépôt **public** : la règle principale d'`AGENTS.md` s'applique à tout changement (aucun hôte, IP,
  identifiant, jeton ou URL privée ; valeurs de documentation RFC 5737 / `exemple.lan`).
- Documentation du dépôt en anglais (README, docs) ; échanges avec le client en français.
- Faux positifs de sécurité examinés : `docs/projet/faux-positifs-semgrep.txt`, `.gitleaksignore`.
- Graphify : `graphify query` avant toute recherche ; `graphify update .` après modification.
