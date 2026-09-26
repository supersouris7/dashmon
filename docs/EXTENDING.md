# Ajouter un widget à Dashmon

Dashmon n'a pas de liste de widgets dans son code. Chaque widget est un dossier
autonome dans `widgets/`, découvert au démarrage. Ajouter une intégration ne
modifie **aucun** fichier du cœur : ni `server.js`, ni `render.js`, ni
`editor.js`, ni `state.js`, ni `i18n.js`.

```
widgets/<id>/
  manifest.json   déclaratif : libellés, schéma de configuration, période
  server.js       collecte la donnée côté serveur (CommonJS)
  client.mjs      rendu de la tuile côté navigateur (ESM)
  client.css      facultatif : style propre au widget
```

Le point de départ le plus rapide : copiez `widgets/_template/` (non chargé par
Dashmon, c'est un modèle), renommez le dossier, editez les trois fichiers.

## manifest.json

```json
{
  "id": "mon-widget",
  "version": "1.0.0",
  "label": { "fr": "Mon widget", "en": "My widget" },
  "description": { "fr": "Une ligne dans l'éditeur", "en": "One line in the editor" },
  "interval": 7200000,
  "cacheKey": "service",
  "server": "server.js",
  "client": "client.mjs",
  "strings": {
    "fr": { "token": "Jeton API", "pending": "Vérification…" },
    "en": { "token": "API token", "pending": "Checking…" }
  },
  "config": [
    { "key": "apiUrl", "type": "text", "label": "apiUrl", "maxLength": 200 },
    { "key": "apiToken", "type": "secret", "label": "token", "maxLength": 2000,
      "placeholder": "token", "title": { "fr": "Jeton", "en": "Token" } }
  ]
}
```

| Clé | Rôle |
| --- | --- |
| `id` | minuscules, tirets, 32 caractères max ; doit correspondre au nom du dossier |
| `interval` | période de re-vérification en ms |
| `cacheKey` | `service` (une entrée de cache par service) ou `config` (une entrée partagée par configuration) |
| `server` / `client` / `css` | noms de fichiers dans le dossier, jamais un chemin |
| `strings` | tous vos textes ; `label` et `placeholder` d'un champ y renvoient par clé |
| `config` | formulaire généré automatiquement dans l'éditeur |

Types de champ acceptés : `text`, `secret`, `select` (+ `options`), `number`
(+ `min`/`max`), `checkbox`. Un champ peut être conditionnel avec
`"when": { "key": "mode", "equals": "tcp" }` : il n'apparaît que si un autre
champ vaut cette valeur.

## server.js

```js
function createState(){ return { tokens: new Map() }; }   // facultatif

async function check(ctx){
  // ctx.config : la config, secrets DÉCHIFFRÉS
  // ctx.api(base, path, options) : client HTTP partagé (timeouts, TLS, IPv4)
  // ctx.state : votre mémoire, créée une fois par le widget
  return { ok: true, value: 42 };                          // -> cache du statut
}

function purge(activeUrls, state){ /* oubliez ce qui n'est plus surveillé */ }

module.exports = { createState, check, purge };
```

Le statut renvoyé est un objet libre : son contenu est votre affichage, Dashmon
n'y touche pas. `check` ne doit jamais lever : renvoyez `{ ok:false, error }`.

## client.mjs

```js
export function render(ctx){
  return {
    badge: "42",            // 1re ligne
    badgeClass: "ok",       // ok | nok | warn | pending | ""
    time: "il y a 2 min",   // 2e ligne (masquée en mode icônes)
    timeClass: "",          // warn | delta-up | delta-down | ""
    title: "Mon widget"     // infobulle
  };
}
```

`render` ne doit toucher **ni au DOM ni à `document`**, et ne pas lever : le
core rattrape vos exceptions et dégrade seulement votre tuile. Si vous avez
besoin d'un rendu totalement sur mesure, exportez `element(ctx)` qui renvoie un
nœud DOM : le core l'utilisera à la place du descripteur.

`ctx` fournit `info` (votre statut), `config`, `lang`, `t(cle)` et les
helpers `formatDateTime`, `formatNumber`, `formatCompactNumber`.

## Tester

```
npm test
```

- `test/widgets.test.js` charge le registre, vérifie les manifests, la
  normalisation, les clés de cache, la purge et les renderers ;
- `test/frontend.test.js` vérifie la syntaxe des modules du navigateur et le
  registre client ;
- un plugin cassé ne fait jamais échouer le chargement : il est ignoré et
  listé dans les logs, les autres widgets continuent de fonctionner.

## Règles de sécurité

- **Aucun secret côté client.** Seul `server.js` voit les secrets en clair
  (déchiffrés par le serveur) ; `client.mjs` ne reçoit que le statut calculé.
- Le type `secret` est chiffré à l'écriture (`aes1.`) et jamais renvoyé en
  clair par l'API ; l'éditeur affiche « mot de passe enregistré » et ne
  réécrit la valeur que si vous en saisissez une nouvelle.
- Les noms de fichiers déclarés ne peuvent pas contenir de `/` ni de `..` : le
  registre rejette le plugin, il ne sert jamais un fichier hors de son dossier.
- Pas de dépendance npm : un widget est du JavaScript standard, chargé tel quel.
  Le `.mjs` du client permet de l'importer dans les tests Node.
- `ctx.api` limite le corps des réponses (2 Mo) et utilise le même délai que
  le reste de Dashmon : ne construisez pas votre propre client HTTP.

## Installer un widget tiers

Copiez le dossier dans `widgets/`, ou montez un dossier de plugins en lecture
seule et indiquez-le via la variable d'environnement `DASHMON_WIDGET_DIR` (les
deux racines sont analysées au démarrage, les plugins natifs en premier).
Redémarrez Dashmon (le registre est lu au démarrage) puis rechargez la page.

## Si le plugin est absent ou cassé

Le cœur ne dépend d'aucun widget : rien ne casse, et surtout rien ne se perd.

- au démarrage, un dossier invalide (manifeste illisible, `id` différent du
  dossier, champ inconnu, fichier serveur absent) est ignoré avec une ligne de
  log ; les autres widgets sont chargés normalement ;
- un service configuré avec un widget inconnu est affiché comme un service
  standard et **sa configuration est conservée** telle quelle lors des
  enregistrements : réinstallez le plugin, il la retrouvera ;
- le registre est chargé avant l'ouverture du port, donc `/api/widgets` ne peut
  pas renvoyer une liste vide au premier chargement du navigateur.
