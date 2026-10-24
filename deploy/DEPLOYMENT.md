# Dashmon — Docker deployment

Run Dashmon from the prebuilt image on Docker Hub. No build required.

## Prerequisites

- Docker 20+

## 1. Run

With Compose:

```bash
cp .env.example .env
# edit .env: DASHMON_PASSWORD is mandatory; also set DASHMON_MASTER_KEY…
docker compose up -d
```

Or directly:

```bash
docker run -d --name dashmon --cap-drop=ALL --security-opt=no-new-privileges:true \
  -p 127.0.0.1:8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHMON_PASSWORD \
  supersouris7/dashmon:latest
```

Set `DASHMON_PASSWORD` in your shell environment before running the command.

→ http://localhost:8080

On first start, `config.json` (sample services) is copied to `/app/data` if missing.

### Docker widget (optional socket)

The Docker widget reads the Engine API read-only through `/var/run/docker.sock`.
The image runs as the non-root user `node` (uid 1000), while the socket usually
belongs to `root:docker` in mode `660`. Mounting it is not enough: without that
group every request is refused with `EACCES` and the widget stays empty.

```bash
stat -c '%g' /var/run/docker.sock   # gid of the docker group
```

```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    group_add:
      - "999"   # the gid printed above
```

Adding the group is preferable to `user: "0:0"`: the container stays non-root and
only the socket becomes reachable. Without the socket the rest of Dashmon is
unaffected, so drop both lines to disable the widget.

#### Portainer stack

Portainer does not infer the host's `docker` group. Run the command on the
**Docker host** (not in the Dashmon console), then paste its numeric result in
the stack editor under `group_add` and redeploy the stack:

```bash
stat -c '%g' /var/run/docker.sock
```

Do not assume that the GID is `999` and do not enter the group name `docker`:
the numeric GID differs between hosts. Keep the socket mount read-only and do
not use `user: "0:0"` as a workaround.

## 2. Environment variables

See `.env.example`. The most important:

| Variable | Default | Role |
| --- | --- | --- |
| `PORT` | `8080` | Internal HTTP port |
| `DASHMON_PASSWORD` | empty outside Docker | HTTP Basic Auth for `/api/*`; required by Compose and for a network bind |
| `TRUST_PROXY` | `0` | `1` only if nginx terminates HTTPS in front of the container |
| `DASHBOARD_INSECURE_TLS` | empty | `1` if your monitored hosts use self-signed certificates |
| `DASHMON_MASTER_KEY` | empty | AES-256-GCM master key to encrypt widget secrets (e.g. Duplicati password) in `config.json` |
| `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | empty | Proxmox API token used by host supervision (type Proxmox) |
| `LINUX_METRICS_TOKEN` | empty | Bearer token expected by a custom Linux metric agent |
| `DASHBOARD_TOKEN_ENVS` | empty | Comma-separated allowlist extending the token variables above |

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

Then assign the generated value to `DASHMON_MASTER_KEY` in `.env` (Compose)
or in the container environment.

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
(e.g. `portainer.exemple.lan`) often fail with `getaddrinfo ENOTFOUND`.

If your monitored URLs use local names:

1. Find your LAN DNS server (e.g. `nslookup portainer.exemple.lan` on another machine).
2. Set `DASHMON_DNS` to that resolver's IP. It is a Compose **substitution**
   variable, so it goes in the `.env` file next to `docker-compose.yml` (or in
   your host environment / the Portainer stack's *Environment variables*), not
   in the service's `environment:` block:

```dotenv
DASHMON_DNS=192.0.2.53
```

   The repo's `docker-compose.yml` wires it to the container:

```yaml
    dns:
      - ${DASHMON_DNS:-127.0.0.11}
```

   `127.0.0.11` is Docker's embedded resolver, so leaving `DASHMON_DNS` empty
   behaves exactly as before.

3. Restart (`docker compose up -d`) and check the status pills turn green.

> **This setting lives in the container definition, not in the image.** Anything
> that recreates the container — `docker compose up`, Portainer's *Pull and
> redeploy*, an update by Watchtower — rebuilds it, and `dns:` only survives if
> it is still in your stack definition. That is exactly why it is driven by an
> environment variable here: environment values are part of the stack, so they
> survive a redeploy, while a `dns:` entry edited once on the running container
> does not. If the pills that were green turn red after a redeploy — Uptime Kuma
> going dark is the usual first symptom — the resolver is the first thing to
> check:
>
> ```sh
> docker inspect dashmon --format '{{json .HostConfig.Dns}}'
> ```
>
> An empty array means the setting is gone. Put it back in the stack definition
> rather than applying it once on the running container, or it will keep
> disappearing.

Without a LAN DNS that knows the names, add explicit `extra_hosts` entries instead:

```yaml
    extra_hosts:
       - "portainer.exemple.lan:192.0.2.10"
```

Checks connect to your LAN directly (over the bridge network), so make sure the
monitored machines answer on their LAN IP — reverse proxies included.

## 7. Private CA certificates

Status checks run inside the container, so Node must trust the authority that
signed the certificates of your monitored services. When it does not, the check
fails with:

```
unable to verify the first certificate
```

Find out which authority actually issued the certificate (use the IP so the test
does not depend on DNS, which is the previous section):

```sh
openssl s_client -connect 192.0.2.104:443 -servername portainer.exemple.lan -showcerts </dev/null
```

The `issuer=` line names the authority — read the `CN=` field. Mount **that**
certificate. Trusting a different authority, even one signed for the same
services, changes nothing.

Export it as PEM, then build a bundle so several authorities can be trusted at
once (`NODE_EXTRA_CA_CERTS` takes a single file):

```bash
mkdir -p /opt/dashmon
cp ./autorite-racine.pem /opt/dashmon/
cp ./autorite-secondaire.pem /opt/dashmon/
cat /opt/dashmon/autorite-racine.pem /opt/dashmon/autorite-secondaire.pem > /opt/dashmon/ca-bundle.pem
chmod 644 /opt/dashmon/ca-bundle.pem
```

Then mount only that file:

```yaml
    environment:
      NODE_EXTRA_CA_CERTS: /certs/ca-bundle.pem

    volumes:
      - dashmon-data:/app/data
      - /opt/dashmon/ca-bundle.pem:/certs/ca-bundle.pem:ro
```

Verify without the dashboard:

```sh
docker exec dashmon node -e "require('https').get('https://portainer.exemple.lan/',r=>console.log('OK',r.statusCode)).on('error',e=>console.log('ERREUR',e.message))"
```

`NODE_EXTRA_CA_CERTS` *adds* to the roots bundled with Node, so public sites keep
working.

> **Ne montez jamais le dossier qui contient vos clés privées.** Un dossier de
> certificats contient généralement aussi les clés de chaque service, et
> éventuellement celle de l'autorité. Seul le certificat de l'CA est nécessaire,
> et ce point vaut aussi pour les sauvegardes : une CA compromise permet de
> signer un certificat pour n'importe lequel de vos services.
>
> Ne placez pas non plus une CA privée dans le `Dockerfile` : l'image est
> publiée publiquement.

If `openssl s_client` returns a single certificate where you expected a chain,
the server is not sending its intermediate. Either complete `ssl_trusted_certificate`
in its reverse proxy configuration, or add the intermediate to `ca-bundle.pem`.

`DASHBOARD_INSECURE_TLS=1` remains available as a last resort for self-signed
certificates. It disables verification for **every** outgoing request, including
public sites, so prefer a bundle.

## 8. Host supervision

The *Supervision* page shows CPU, memory, disk and temperature for the hosts you
enable in the dedicated editor (*Modifier la supervision*, in the top menu). Each
host picks one source:

| Type | What it reads | Fields |
| --- | --- | --- |
| Local | The machine running the container (`os`, `/sys`, `statfs`) | disk path (default `/`) |
| Linux agent | A JSON endpoint you host: `{ "cpu": 12, "ram": 40, "disk": 55, "temperature": 48 }` (all optional, percentages 0–100) | URL, optional bearer token |
| Proxmox | The PVE JSON API (`/api2/json/nodes/<node>/status`) | URL, node, token ID, token secret |

Temperature is unavailable for Proxmox (the PVE API does not expose it) and shows
as `—`; likewise any metric a source does not provide.

### WireGuard peers

WireGuard peers can come from two sources:

- **Local** — read from a filtered dump file. Follow
  [the WireGuard guide](../docs/WIREGUARD.md); Dashmon needs no extra capability.
- **Linux agent** — reported in the JSON `wireguard` field described here.

With an agent, add an optional `wireguard` field to the JSON; the supervision
card then lists each peer with its last handshake and traffic:

```json
{
  "cpu": 12, "ram": 40, "disk": 55, "temperature": 48,
  "wireguard": {
    "interface": "wg0",
    "peers": [
      { "name": "phone", "endpoint": "198.51.100.10:51820",
        "latestHandshake": 1760000000, "rx": 1234567, "tx": 7654321 }
    ]
  }
}
```

- `wireguard` may be one interface, an array of interfaces, or
  `{ "interfaces": [ ... ] }`. Each interface has an `interface` name and a
  `peers` array (max 10 interfaces, 200 peers each).
- `latestHandshake` is an epoch timestamp in **seconds** (milliseconds and ISO
  dates are also accepted). `rx` and `tx` are byte counters.
- `connected` is optional. Without it, a peer is shown as connected when its last
  handshake is less than three minutes old; `latestHandshake: null` shows
  `never`.
- Values are plain text on the page (no HTML), so names and endpoints are safe.
  The agent reads them itself, for example from `wg show all dump`; Dashmon needs
  no privilege on the WireGuard host.
- The *WireGuard* tab of the supervision editor controls the display: hide the
  peer section for a host, or restrict it to a single interface name (empty means
  all interfaces). These preferences are stored in `config.json` under
  `host.monitoring.wireguard` and do not change what the agent reports.

The bundled script refreshes the local file with cron and removes private key
material before Dashmon reads it. The same file also feeds the standalone
WireGuard tile. See [the WireGuard guide](../docs/WIREGUARD.md) for installation,
names and bind mounts. SMART and APT have their own local guides:
[SMART](../docs/SMART.md) and [APT updates](../docs/APT_UPDATES.md).

### Disk of the real host (type Local)

By default the disk metric reads the container's own filesystem, not the host's.
To measure a real host disk, mount it into the container and point the disk path
at the mount:

```yaml
    volumes:
      - dashmon-data:/app/data
      - /:/host:ro
```

then set the disk path to `/host` for that host. Readings of `null` (shown `—`)
are normal when a path does not exist or `/sys` is not exposed.

### Tokens

Token fields hold **either** the name of an allowlisted environment variable
(`PROXMOX_TOKEN_ID`, `PROXMOX_TOKEN_SECRET`, `LINUX_METRICS_TOKEN`, or any name
listed in `DASHBOARD_TOKEN_ENVS`) **or** the literal value. The server resolves
and sends them at read time; a name outside the allowlist is sent literally, it
never exposes an arbitrary container variable.

Create the Proxmox token with read-only (`PVEAuditor`) privileges.

## Notes

- No embedded secrets: the bundled `config.json` only contains public examples. Widget passwords are
  AES-256-GCM encrypted when `DASHMON_MASTER_KEY` is set (plain text otherwise).
- Logs: `docker logs dashmon`.
