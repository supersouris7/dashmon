# Vision produit — Dashmon

## Pour qui
Personnes qui font tourner un homelab (serveur domestique, conteneurs) et veulent tout voir d'un coup d'œil.

## Problème résolu
Savoir si chaque service fonctionne sans ouvrir dix interfaces.

## Proposition de valeur
Un tableau de bord sur une seule page : services, état, métriques en direct sur les tuiles (widgets),
plusieurs tableaux, recherche, thèmes. Un petit conteneur Node.js, sans compte, sans cloud, sans base.

## Périmètre
Détail : `README.md`, `docs/WIDGETS.md`. Hors périmètre : gestion des services (Dashmon observe, n'administre pas).

## Contraintes
Dépôt public (aucune donnée personnelle), image multi-architecture (amd64, arm64), légèreté.
