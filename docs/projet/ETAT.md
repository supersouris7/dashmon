# État du projet — Dashmon

> Point de reprise de toute session. Court, daté, mis à jour en fin d'intervention.
> Le détail opérationnel est dans les tickets GitHub ; ici, seulement la synthèse.

- Mis à jour : 2026-11-21
- Maturité : mature — Node.js, tests, lint, CI Docker multi-architecture, 11 versions étiquetées.
- Environnement de test : à définir avec le client (l'instance en service est traitée comme production :
  aucune action sans accord).
- Tableau de suivi : à créer (droit GitHub « project » en attente).

## En cours
- Intégration à la fabrique logicielle (PR `chore/fabrique-integration`).
- 2 PR Dependabot ouvertes (actions et outils de développement).

## Anomalies connues
- Aucune bloquante. Contrôle sécurité du 21/11 : 0 critique/haute ; 4 faux positifs documentés.

## Prochaine action
- Fusionner les PR Dependabot si la CI est verte (accord client), définir l'environnement de test.
