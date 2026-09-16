# Dashmon

![Licence](https://img.shields.io/badge/licence-MIT-blue.svg)
![Versions](https://img.shields.io/badge/docker-amd64%20%7C%20arm64-4f8f89.svg)

Dashboard self-hosted léger pour centraliser vos services : accès rapide, surveillance du statut des URL, métriques CPU/RAM des hôtes, thèmes et interface fr/en.

Serveur Node.js / Express, modules ES natifs, aucune dépendance hors express.

## Installation

```bash
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  supersouris7/dashmon
```

→ http://localhost:8080

Docker Compose : voir [deploy/DEPLOIEMENT.md](deploy/DEPLOIEMENT.md).

## Fonctionnalités

- **Services** : cartes par catégorie ou hôte, recherche, modes (lignes/colonnes/plein)
- **Surveillance** : statut des URL + métriques CPU/RAM (`local`, agent Linux `/metrics`, Proxmox)
- **Thèmes** : natifs et custom, import/export, CSS personnalisé
- **Interface** : fr/en, tri alphabétique ou par usage
- **Docker** : image autonome multi-arch (amd64/arm64), versions `latest`, `unstable` et `vX.Y.Z`

## Développement

```bash
npm install
npm start
```

## Configuration

Éditable depuis l'interface (`Modifier Dashmon`). Champs clés :

- `services[]` : `name`, `url`, `icon`, `category`, `host`, `monitor`
- `categories[]`, `hosts[]`, `webLinks[]`
- `viewMode` (`rows`/`columns`/`plain`), `openMode`, `groupMode`, `sortMode`
- `theme`, `language` (`fr`/`en`)

Surveillance : `local`, `linux` (agent Prometheus `/metrics`) ou `proxmox` (token API lecture seule).

Variables d'environnement : voir `.env.example`. Données runtime dans `data/` (volume `dashmon-data`).

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

MIT — voir [LICENSE](LICENSE).

---

Dashmon est développé gratuitement pour mon homelab et mis à disposition en open source. Si vous l'utilisez et souhaitez soutenir son développement :

<p align="center">
  <a href="https://github.com/sponsors/supersouris7">♥ Soutenir le projet sur GitHub Sponsors</a>
</p>