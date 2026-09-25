# Dashmon — Docker deployment

Run Dashmon from the prebuilt image on Docker Hub. No build required.

## Prerequisites

- Docker 20+

## 1. Run

With Compose:

```bash
cp .env.example .env
# edit .env: DASHBOARD_PASSWORD, tokens…
docker compose up -d
```

Or directly:

```bash
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHBOARD_PASSWORD=change_me \
  supersouris7/dashmon:latest
```

→ http://localhost:8080

On first start, `config.json` (sample services) is copied to `/app/data` if missing.

## 2. Environment variables

See `.env.example`. The most important:

| Variable | Default | Role |
| --- | --- | --- |
| `PORT` | `8080` | Internal HTTP port |
| `DASHBOARD_PASSWORD` | empty | HTTP Basic Auth for `/api/*` endpoints (recommended online) |
| `TRUST_PROXY` | `0` | `1` only if nginx terminates HTTPS in front of the container |
| `DASHBOARD_INSECURE_TLS` | empty | `1` if your monitored hosts use self-signed certificates |
| `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | empty | Proxmox API tokens (read-only) |
| `LINUX_METRICS_TOKEN` | empty | Token for the Linux `/metrics` HTTP agent |
| `DASHBOARD_TOKEN_ENVS` | empty | Additional allowed token variable names |
| `DASHMON_MASTER_KEY` | empty | AES-256-GCM master key to encrypt widget secrets (e.g. Duplicati password) in `config.json` |

### Widget secrets (Duplicati…)

Service widgets (e.g. Duplicati) send a server-side password from the editor.

With `DASHMON_MASTER_KEY` set, this password is **encrypted (AES-256-GCM)**
in `config.json` instead of being stored as plain text.

Generate a key once, keep it secret, never commit it:

```bash
# Linux / macOS
openssl rand -base64 32
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Then add it to `.env` (Compose) or the container environment:

```bash
DASHMON_MASTER_KEY=paste-the-generated-key
```

Behaviour:

- Without a key, widget passwords fall back to plain text (warning in the logs at startup).
- Existing plain-text passwords are encrypted automatically on the next config save.
- If the key changes later, previously encrypted passwords become unreadable — re-enter them in the editor (empty field keeps the stored secret).

## 3. Data

The `dashmon-data` volume (`/app/data`) persists config, images and custom themes.
Backup: `docker cp dashmon:/app/data ./backup-data` (container stopped).

> **Mise à jour d'une ancienne installation** : l'image officielle tourne
> maintenant sous l'utilisateur non-root `node` (uid 1000). Si votre volume a
> été créé par une version antérieure, corrigez son propriétaire une fois :
> `docker run --rm -v dashmon-data:/d alpine chown -R 1000:1000 /d`

## 4. nginx (optional)

A full example: `deploy/nginx.example.conf`. If you use it, set `TRUST_PROXY=1`
and enable `client_max_body_size` in nginx for image imports.

## 5. Verification

- `docker inspect --format '{{.State.Health.Status}}' dashmon` → `healthy`
- `curl http://localhost:8080/healthz` → `{"ok":true}`

## 6. Monitoring LAN domains (.lan, .local…)

Status checks run *inside* the container. Docker's embedded DNS only forwards to
the resolvers configured on the host, so names that exist only on your LAN DNS
(e.g. `service.lan`) often fail with `getaddrinfo ENOTFOUND`.

If your monitored URLs use local names:

1. Find your LAN DNS server (e.g. `nslookup mymachine.lan` on another machine).
2. Point the container DNS to it in `docker-compose.yml`:

```yaml
    dns:
      - 192.0.2.53
```

3. Restart (`docker compose up -d`) and check the status pills turn green.

Without a LAN DNS that knows the names, add explicit `extra_hosts` entries instead:

```yaml
    extra_hosts:
      - "app.lan:192.0.2.10"
```

Checks connect to your LAN directly (over the bridge network), so make sure the
monitored machines answer on their LAN IP — reverse proxies included.

## Notes

- No embedded secrets: `config.json` only contains public examples, tokens are referenced
  by environment variable (allowlist `DASHBOARD_TOKEN_ENVS`), and widget passwords are
  AES-256-GCM encrypted when `DASHMON_MASTER_KEY` is set (plain text otherwise).
- Logs: `docker logs dashmon`.