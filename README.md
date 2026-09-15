# Dashmon

Dashmon — dashboard self-hosted léger pour centraliser vos services self-hosted : accès rapide aux services, surveillance du statut des URL, métriques CPU/RAM des hôtes, thèmes et interface fr/en.

Serveur Node.js / Express, modules ES natifs, aucune dépendance hors express.

## Démarrage

```bash
npm install
npm start
```

→ http://localhost:8080

Ou avec Docker :

```bash
docker compose up -d --build
```

Au premier lancement, `config.json` (exemples de services self-hosted) est copié dans `data/config.json` s'il n'existe pas.

## Structure

```
server.js      Serveur + API
config.json    Config d'exemple (seed initial)
public/
├── index.html
├── css/       base, components, editor
├── js/        app, state, render, editor, themes, i18n, metrics, images, icons, api, dom
└── themes/    Thèmes natifs (lecture seule)
data/          Données runtime (créées automatiquement)
├── config.json
├── icons/     Images PNG importées
└── themes/    Thèmes custom
```

## Variables d'environnement

| Variable | Défaut |
| --- | --- |
| `PORT` | `8080` |
| `DATA_DIR` | `<racine>/data` |
| `CONFIG_FILE` | `<DATA_DIR>/config.json` |
| `ICONS_DIR` | `<DATA_DIR>/icons` |
| `THEMES_CUSTOM_DIR` | `<DATA_DIR>/themes` |
| `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | vides |
| `LINUX_METRICS_TOKEN` | vide |

Modèle fourni dans `.env.example`.

## Config

Éditable depuis l'interface. Champs clés :

- `services[]` : `name`, `url`, `icon`, `category`, `host`, `monitor`
- `categories[]`, `hosts[]`, `webLinks[]`
- `viewMode` : `rows` | `columns` | `plain`
- `openMode` : `same` | `new`
- `groupMode` : `category` | `host`
- `sortMode` : `alphabetical` | `usage`
- `theme`, `language` (`fr` | `en`)

Supervision des hôtes : `local`, `linux` (agent Prometheus `/metrics`, champ `url`) ou `proxmox` (token API lecture seule, champs `url`/`node`/`tokenIdEnv`/`tokenSecretEnv`).

## Thèmes

- Natifs : `public/themes/*.json` — non supprimables.
- Custom : `data/themes/*.json` — import/export/suppression depuis l'interface.

Format : `id`, `name`, `author`, `description`, `version`, `variables` (10 clés : `bg`, `surface`, `surface-2`, `surface-3`, `border`, `text`, `muted`, `accent`, `danger`, `shadow`), `css` (facultatif).

## API

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET`/`PUT` | `/api/config` | Lire / enregistrer la config |
| `GET`/`POST`/`DELETE` | `/api/icons` | Lister / importer / supprimer les images |
| `GET`/`POST`/`DELETE` | `/api/themes` | Thèmes (lister / importer / supprimer) |
| `GET` | `/api/themes/:id/export` | Exporter un thème |
| `GET` | `/api/status` | Statut des services surveillés |
| `GET` | `/api/host-metrics` | Métriques CPU/RAM des hôtes |

## Licence

[MIT](LICENSE).