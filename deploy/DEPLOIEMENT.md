# Déploiement Docker

Builder, lancer et (optionnel) publier Dashmon sur Docker Hub. L'image est autonome : nginx n'est pas requis.

## Prérequis

- Docker 20+
- Docker Compose v2+ (optionnel, pour le `docker compose`)

## 1. Builder

```bash
cd /home/administrateur/Téléchargements/dashboard
docker build -t dashmon .
```

## 2. Lancer

Avec Compose :

```bash
cp .env.example .env
$EDITOR .env   # DASHBOARD_PASSWORD, tokens… 
docker compose up -d --build
```

Ou en direct :

```bash
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHBOARD_PASSWORD=change_me \
  dashmon
```

→ http://localhost:8080

Au premier démarrage, `config.json` (services d'exemples) est recopié dans `/app/data` si absent.

## 3. Variables d'environnement

Voir `.env.example`. Les plus importantes :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8080` | Port HTTP interne |
| `DASHBOARD_PASSWORD` | vide | HTTP Basic Auth des API `/api/*` (recommandé en ligne) |
| `TRUST_PROXY` | `0` | `1` uniquement si nginx termine le HTTPS devant le conteneur |
| `DASHBOARD_INSECURE_TLS` | vide | `1` si vos hôtes ont des certificats auto-signés |
| `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | vides | Tokens API Proxmox (lecture seule) |
| `LINUX_METRICS_TOKEN` | vide | Token de l'agent HTTP Linux `/metrics` |
| `DASHBOARD_TOKEN_ENVS` | vide | Noms de variables token supplémentaires autorisées |

## 4. Données

Le volume `dashmon-data` (`/app/data`) persiste config, images PNG et thèmes custom.
Sauvegarde : `docker cp dashmon:/app/data ./backup-data` (conteneur arrêté).

## 5. nginx (optionnel)

Un exemple complet : `deploy/nginx.example.conf`. Si vous l'utilisez, pensez à `TRUST_PROXY=1`
et à `client_max_body_size` côté nginx pour les importations d'images.

## 6. Publier sur Docker Hub

```bash
docker tag dashmon votre_utilisateur/dashmon:latest
docker login
docker push votre_utilisateur/dashmon:latest
```

Chez vous : `docker pull votre_utilisateur/dashmon && docker run …` (mêmes options qu'au §2).

## Vérification

- `docker inspect --format '{{.State.Health.Status}}' dashmon` → `healthy`
- `curl http://localhost:8080/healthz` → `{"ok":true}`

## Remarques

- Aucun secret embarqué : `config.json` ne contient que des exemples, les tokens se référencent
  par variable d'environnement (allowlist `DASHBOARD_TOKEN_ENVS`).
- Logs : `docker logs dashmon`.