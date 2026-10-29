# Architecture de Dashmon

Cette page aide les contributeurs à situer les responsabilités du code. Les
instructions d'installation et de configuration restent dans le README et
les autres guides.

## Vue d'ensemble

```text
Navigateur : état et brouillons -> API HTTP -> serveur principal
                                             |-- configuration et stockage
                                             |-- supervision locale
                                             |-- widgets
                                             `-- agents distants (mesures uniquement)
```

Le mode agent expose sa supervision locale. Le principal interroge ses agents ;
il ne leur envoie pas sa configuration de tableau de bord. Les préférences de
disposition propres au navigateur sont distinctes de la configuration serveur.

## Serveur

- `server.js` assemble l'application, ses dépendances et les routes qui n'ont
  pas encore de module dédié.
- `lib/config-routes.js`, `lib/config-normalize.js`, `lib/config-fields.js` et
  `lib/config-store.js` assurent respectivement les routes, la validation, les
  champs spécialisés et l'écriture de configuration. Les révisions détectent
  les modifications concurrentes ; l'écriture est atomique.
- `lib/auth.js`, `lib/secrets.js`, `lib/security-headers.js`,
  `lib/request-origin.js` et `lib/rate-limit.js` regroupent les mécanismes de
  sécurité. Ne pas ajouter de secret ou d'exemple d'identifiant réel au dépôt.
- `lib/agent-routes.js`, `lib/agent-protocol.js` et
  `lib/replication-config.js` traitent la communication et la configuration
  des agents.
- `lib/local-metrics.js`, `lib/wireguard-report.js`, `lib/smart-report.js` et
  `lib/apt-report.js` isolent les lectures et les formats de supervision.
- `lib/registry.js`, `lib/widget-schema.js` et `lib/widget-core.js` chargent,
  valident et exécutent les widgets. Chaque widget vit dans `widgets/` ; le
  guide `EXTENDING.md` décrit le contrat d'extension.

## Navigateur

- `public/js/state.js` contient l'état commun et la normalisation de la
  configuration ; `api.js` gère les écritures et les révisions HTTP.
- `editor.js` orchestre les panneaux et l'enregistrement. Les brouillons et
  leur préparation sont dans `editor-draft.js`, `host-monitoring-draft.js` et
  `replication-draft.js`.
- `pairing-editor.js` et `pairing-list.js` gèrent le formulaire des agents ;
  `monitoring-editors.js` et `apt-editor.js` gèrent les options de supervision.
  `confirm-dialog.js`, `color-picker.js` et `editor-drag.js` portent des
  composants partagés de l'éditeur.
- `render.js`, `pages.js` et `supervision.js` construisent les vues ;
  `view-prefs.js` conserve les préférences locales de présentation.

## Vérifications

`npm test` exécute les tests sans navigateur. `npm run test:browser` nécessite
Chromium et un Node disposant de `WebSocket` ; il démarre une instance et un
profil navigateur temporaires, puis vérifie notamment la connexion, le pairage,
la sauvegarde et la création d'un hôte. La variable `CHROMIUM_BIN` peut désigner
le binaire si son nom n'est pas `chromium`. Exécuter aussi `actionlint` depuis
la racine du dépôt pour contrôler les workflows.
