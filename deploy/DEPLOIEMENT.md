# Déploiement Docker

Comment builder l'image, la lancer en conteneur et (optionnel) la publier sur Docker Hub.

Le projet embarque tout : le serveur, l'interface, la config d'exemple et le mécanisme de seed
(`config.json` → `data/config.json` au premier démarrage). L'image est autonome, nginx n'est pas requis.

## Prérequis

- Docker version 20+ (testé avec 29.x)
- Docker Compose v2+ (optionnel, pour le `docker compose`)

## 1. Builder l'image

```bash
cd /home/administrateur/Téléchargements/dashboard
docker build -t dashmon .
```

L'image se base sur `node:22-alpine`, installe uniquement express, copie `server.js`, `config.json`
et `public/`. Pas de `node_modules` hôte, pas de `data/` local (voir `.dockerignore`).

### 1b. Lancer le conteneur en direct (sans compose)

```bash
docker run -d \
  --name dashmon \
  -p 8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHBOARD_PASSWORD=change_me \
  dashmon
```

→ http://localhost:8080

## 2. Lancer avec Docker Compose

Copiez le modèle d'environnement puis ajustez vos secrets :

```bash
cp .env.example .env
$EDITOR .env   # mettez DASHBOARD_PASSWORD, TRUST_PROXY, tokens Proxmox…
docker compose up -d --build
```

Avant le premier démarrage, un volume nommé `dashmon-data` est créé et la config d'exemple
(6 services, 2 catégories, 1 hôte, 4 liens web) y est recopiée si absente.

Pour se connecter aux API : `http://localhost:8080` → l'éditeur demande le mot de passe
(`DASHBOARD_PASSWORD`) ; sans mot de passe, les API `/api/*` renvoient 401.

## 3. Variables d'environnement

Voir `.env.example` (fourni avec le projet). Les plus importantes :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8080` | Port HTTP interne |
| `DATA_DIR` / `CONFIG_FILE` / `ICONS_DIR` | `/app/data`… | Données runtime (volume) |
| `DASHBOARD_PASSWORD` | vide | Auth HTTP Basic des API `/api/*` (recommandé en ligne) |
| `TRUST_PROXY` | `0` | `1` uniquement si nginx termine le HTTPS devant le conteneur |
| `DASHBOARD_INSECURE_TLS` | vide | `1` si vos hôtes surveillés ont des certificats auto-signés |
| `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | vides | Tokens API Proxmox (lecture seule) |
| `LINUX_METRICS_TOKEN` | vide | Token de l'agent HTTP Linux `/metrics` |
| `DASHBOARD_TOKEN_ENVS` | vide | Noms de variables supplémentaires autorisées (séparés par des virgules) |

## 4. Volumes et données

- Le volume `dashmon-data` (`/app/data`) persiste : config modifiée, images PNG importées, thèmes custom.
- Pour sauvegarder : `docker cp dashmon:/app/data ./backup-data` (conteneur arrêté).

## 5. Mode nginx (optionnel)

Un exemple de reverse proxy est fourni dans `deploy/nginx.example.conf`.
Si vous l'utilisez :

- exposez le conteneur sur le réseau Docker uniquement (`expose: "8080"` au lieu de `ports:`) OU gardez les ports ;
- passez `TRUST_PROXY=1` dans le conteneur pour que le rate limiter et l'en-tête HSTS
  utilisent l'adresse réelle du client ;
- activez `client_max_body_size` côté nginx pour les importations d'images PNG.

## 6. Publier sur Docker Hub

```bash
docker tag dashmon votre_utilisateur/dashmon:latest
docker login                       # identifiants Docker Hub
docker push votre_utilisateur/dashmon:latest
```

Chez vous / vos serveurs :

```bash
docker pull votre_utilisateur/dashmon
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHBOARD_PASSWORD=change_me \
  votre_utilisateur/dashmon
```

## 7. Vérifier que tout va bien

- Santé : `docker inspect --format '{{.State.Health.Status}}' dashmon` → `healthy`
- Endpoint de santé public : `curl http://localhost:8080/healthz` → `{"ok":true}`
- Supériorité des services : `curl -u admin:$DASHBOARD_PASSWORD http://localhost:8080/api/status`

## Remarques

- Il n'y a **aucun secret embarqué** dans l'image : `config.json` ne contient que des exemples publics
  et les tokens se référencent par nom de variable d'environnement (allowlist `DASHBOARD_TOKEN_ENVS`).
- Les logs du conteneur : `docker logs dashmon`.