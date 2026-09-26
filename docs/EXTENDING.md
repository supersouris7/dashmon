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
| `defaultFor` | `"link"` : ce widget devient celui qui surveille les liens web (voir plus bas) |
| `hidden` | `true` : plugin interne, absent du menu des widgets de l'éditeur |
| `probe` | `true` : le statut `up`/`down` renvoyé pilote la couleur de la tuile |

Types de champ acceptés : `text`, `secret`, `select` (+ `options`), `number`
(+ `min`/`max`), `checkbox`. Un champ peut être conditionnel avec
`"when": { "key": "mode", "equals": "tcp" }` : il n'apparaît que si un autre
champ vaut cette valeur.

### Servir un lien : `defaultFor: "link"`

Un service sans widget est un **lien** (une simple URL à surveiller). C'est le
premier widget de Dashmon (`widgets/web`) qui le surveille, grâce à son
`"defaultFor": "link"`. Un service qui a un widget est toujours pris en charge
par ce widget, même si un plugin réclame le slot `link`.

Ce mécanisme permet d'**ajouter un type de lien sans toucher au cœur** : un
plugin `defaultFor: "link"` n'est jamais choisi par l'utilisateur (il est
`hidden`), le plugin de la métrique (YouTube, GitHub…) l'est. Un seul plugin
peut revendiquer un slot : si deux manifests le demandent, le second est refusé
et l'erreur apparaît dans les logs.

Pour un plugin de lien qui affiche une métrique :

- `probe: true` fait piloter la tuile par le `state` que vous renvoyez. C'est
  vous qui décidez : une API qui refuse de livrer son compteur alors que la page
  répond est `{ state: "up", ok: false }`, donc une tuile neutre, pas rouge ;
- `interval` est votre période (une API publique comme GitHub plafonne à 60
  requêtes par heure : 6 h n'est pas excessif) ;
- `cacheKey: "service"` garde une entrée par service.

## server.js

```js
function createState(){ return { tokens: new Map() }; }   // facultatif

async function check(ctx){
  // ctx.config : la config, secrets DÉCHIFFRÉS
  // ctx.api(base, path, options) : client HTTP partagé (timeouts, TLS, IPv4)
  // ctx.probe(href) : { ok, code, ms, error }, la sonde des liens
  // ctx.state : votre mémoire, créée une fois par le widget
  // ctx.storage : ce qui doit survivre à un redémarrage (voir plus bas)
  // ctx.log(message) : une ligne dans les logs de Dashmon
  return { ok: true, value: 42 };                          // -> cache du statut
}

function purge(activeUrls, state){ /* oubliez ce qui n'est plus surveillé */ }

module.exports = { createState, check, purge };
```

Le statut renvoyé est un objet libre : son contenu est votre affichage, Dashmon
n'y touche pas. `check` ne doit jamais lever : renvoyez `{ ok:false, error }`.

### Conserver une valeur dans le temps

`ctx.state` est en mémoire : un redémarrage l'oublie. Quand un widget doit se
souvenir d'un historique (évolution d'une note, compteur, version déjà vue),
`ctx.storage` écrit un JSON par votre nom dans le dossier de données :

```js
// ctx.storage.read(nom, defaut) / ctx.storage.write(nom, valeur)
const store = ctx.storage.read("mon-historique", { points: [] });
store.points.push({ at: Date.now(), value: 42 });
ctx.storage.write("mon-historique", store.slice(-90));
```

Seuls un nom de fichier (`lettres`, chiffres, `.`, `-`, `_`, 64 caractères max)
et 1 Mo sont acceptés : impossible d'écrire ailleurs. L'écriture est atomique
et silencieuse en cas d'échec — un widget en lecture seule dégrade son
affichage, il n'empêche jamais le démarrage. C'est exactement ce dont le widget
`lichess` se sert pour afficher le dernier ELO connu quand lichess.org renvoie
un 429.

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
  le reste de Dashmon : ne construisez pas votre propre client HTTP. Pour lire une
  page HTML plus grosse, demandez `maxBody` (plafonné à 8 Mo) et
  `{ raw: true }` pour recevoir `{ status, body, headers }` au lieu d'un JSON.
- Un `client.mjs` est facultatif quand la tuile est déjà rendue par le client
  générique : c'est le cas d'un plugin `hidden` comme la sonde des liens, qui ne
  fabrique aucune métrique.

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
