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

`server.js` ne contient que l'assemblage : il lit la configuration, crée les
services, puis monte le pipeline Express dans l'ordre (sécurité, limites de
débit, authentification, routes, erreurs). Son en-tête sert de plan du code.
Chaque fichier de `lib/` commence par un commentaire qui décrit son rôle.

```text
server.js            assemblage de l'application
agent-server.js      point d'entrée du mode agent
lib/
  config/            variables d'environnement (settings.js), config.json
                     (store.js, repository.js), validation (normalize.js,
                     fields.js), migrations de démarrage, secrets chiffrés
  http/              client HTTP sortant (client.js), authentification,
                     protections (en-têtes, origine, limites de débit, jeton
                     des agents), journal des requêtes, erreurs
  routes/            toutes les routes HTTP, un fichier par sujet ; chaque
                     en-tête liste ses routes
  widgets/           registre, schéma, stockage et cœur des widgets
  status/            boucle de statut des services surveillés
  host/              mesures de la machine (CPU, RAM, disque) et rapports
                     WireGuard, SMART et APT
  agent/             protocole, identité et pairage des agents
  themes.js          validation des thèmes
  version.js         libellé de version et détection des montages
  lifecycle.js       démarrage, boucle de statut et arrêt propre
  log.js             journaux horodatés
widgets/<id>/        un dossier par widget (voir EXTENDING.md)
```

Quelques règles qui guident ce découpage :

- Seul `lib/config/settings.js` lit `process.env` ; les autres modules
  reçoivent l'objet `settings`.
- Les routes reçoivent leurs dépendances en paramètre
  (`registerXxxRoutes(app, { ... })`) : elles ne connaissent ni le fichier de
  configuration ni le schéma, et se testent sans démarrer le serveur.
- L'écriture de la configuration est atomique et les révisions (ETag)
  détectent les modifications concurrentes.
- Les commentaires et les journaux sont en anglais ; les messages renvoyés par
  l'API restent en français, car l'interface les affiche.
- Ne pas ajouter de secret ou d'exemple d'identifiant réel au dépôt.

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

`npm test` exécute les tests sans navigateur et `npm run format:check` vérifie
la mise en forme (Prettier ; `npm run format` la corrige). `npm run test:browser` nécessite
Chromium et un Node disposant de `WebSocket` ; il démarre une instance et un
profil navigateur temporaires, puis vérifie notamment la connexion, le pairage,
la sauvegarde et la création d'un hôte. La variable `CHROMIUM_BIN` peut désigner
le binaire si son nom n'est pas `chromium`. Exécuter aussi `actionlint` depuis
la racine du dépôt pour contrôler les workflows.
