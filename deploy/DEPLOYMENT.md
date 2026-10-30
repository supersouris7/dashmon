# Dashmon — Docker deployment

For a concise, step-by-step installation of the main dashboard and agents with
copyable Portainer or Docker Compose stacks, start with the
[startup guide](../docs/DEMARRAGE.md).

Run Dashmon from the prebuilt image on Docker Hub. No build required.

## Prerequisites

- Docker 20+

## 1. Run

With Compose:

```bash
cp .env.example .env
# edit .env: DASHMON_PASSWORD and DASHMON_MASTER_KEY are mandatory
docker compose up -d
```

Or directly:

```bash
docker run -d --name dashmon --read-only --cap-drop=ALL --security-opt=no-new-privileges:true \
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
The socket grants powerful access to Docker: mounting the socket with `:ro` does
not make the Docker API read-only. Only grant it to a trusted container.
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
| `DASHMON_PASSWORD` | empty outside Docker | Primary dashboard login; browser session lasts 30 days. Required in Docker for the primary. Not used by agents |
| `TRUST_PROXY` | `0` | `1` only if nginx terminates HTTPS in front of the container |
| `DASHBOARD_INSECURE_TLS` | empty | `1` if your monitored hosts use self-signed certificates |
| `DASHMON_MASTER_KEY` | **required** (main dashboard) | AES-256-GCM master key encrypting widget secrets (e.g. Duplicati password) in `config.json`. Not needed by agents |
| `DASHMON_SYNC_TOKEN` | empty | Shared secret authorizing the main dashboard to read agent metrics |

### Widget secrets (Duplicati…)

Service widgets (e.g. Duplicati) send a server-side password from the editor.

This password is **encrypted (AES-256-GCM)** in `config.json` with
`DASHMON_MASTER_KEY`, which the main dashboard requires: it refuses to start
without it. Passwords are never sent back to the browser, not even encrypted:
the editor only shows that one is configured.

Generate a key once, keep it secret, never commit it:

```bash
# Linux / macOS
openssl rand -hex 32
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Then assign the generated value to `DASHMON_MASTER_KEY` in `.env` (Compose)
or in the container environment.

Behaviour:

- Passwords stored in plain text by an older version are encrypted automatically at start-up.
- A configuration export contains no password: after importing it into another
  instance, re-enter the widget passwords.
- If the key changes later, previously encrypted passwords become unreadable — re-enter them in the editor (empty field keeps the stored secret).

## 3. Data

## Portainer stacks

These examples can be pasted into **Stacks → Add stack → Web editor** in
Portainer. Add the named values under **Environment variables** in the stack
editor before deploying. Do not put passwords or keys directly in the YAML or
commit them to a repository.

The examples use the `unstable` image, which receives builds from `main`.
Use `latest` instead when a stable release containing the agent is available.
Update the image and redeploy the stack to pick up a newer build.

### Main Dashmon stack

Create `DASHMON_PASSWORD` and `DASHMON_MASTER_KEY` (both required)
in Portainer's stack environment. The master key encrypts widget credentials;
keep a backup of it separately from the data volume. If using agents, also set
`DASHMON_SYNC_TOKEN` to a separate, long random value. The same sync token must
be configured on every agent connected to this main instance.

```yaml
services:
  dashmon:
    image: supersouris7/dashmon:unstable
    container_name: dashmon
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    ports:
      - "8080:8080"
    environment:
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Set DASHMON_PASSWORD}
      DASHMON_MASTER_KEY: ${DASHMON_MASTER_KEY:?Set DASHMON_MASTER_KEY}
      DASHMON_SYNC_TOKEN: ${DASHMON_SYNC_TOKEN:-}
    volumes:
      - dashmon-data:/app/data

volumes:
  dashmon-data:
```

The published port listens on host interfaces by default: restrict access using
a firewall or put Dashmon behind HTTPS. If accessing it only through a reverse
proxy on the same host, bind the port to loopback instead. See the
[Docker widget](#docker-widget-optional-socket) section before adding socket
access.

### Supervision agents

Deploy this separate stack on each monitored host. In its Portainer environment,
set `DASHMON_SYNC_TOKEN` to the same value as on the main dashboard. Agents have
no web interface and need no password; their API requires the token.

```yaml
services:
  dashmon-agent:
    image: supersouris7/dashmon:unstable
    container_name: dashmon-agent
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    ports:
      - "8080:8080"
    environment:
      DASHMON_MODE: agent
      DASHMON_SYNC_TOKEN: ${DASHMON_SYNC_TOKEN:?Set DASHMON_SYNC_TOKEN}
    volumes:
      - dashmon-agent-data:/app/data
      # Optional: mount the host filesystem read-only, then select /host
      # as the disk path in the agent settings on the primary.
      # - /:/host:ro

volumes:
  dashmon-agent-data:
```

The standalone Compose file `deploy/agent.compose.yml` lets Docker assign the
container name; use `docker ps` to find that name when installing report scripts.
If the
main dashboard and an agent run on the same host, give one stack a different
published host port; the container port remains `8080`. Restrict access to the
agent's port to the main dashboard and administrators. Use HTTPS or a trusted
private network: the sync token travels in a request header.

Use the primary settings to name the agent host, configure its disk path and choose
WireGuard, SMART and APT reports. The reports must be generated on the host and
mounted into the agent as described in their respective documentation. CPU and
RAM reflect what the container can observe; the default disk is the container
filesystem. To monitor a host filesystem, mount it read-only and set its
container path in the agent configuration on the primary.

On the main instance, open **Settings → Supervision → Pairing**, enter each agent's
base URL on its own line, optionally enter a tab name for each agent, and save.
Then link the host created in the **Hosts** tab: its color and icon are reused
when hovering the host tile in Supervision. Without a host, the pairing still
works but the tile keeps its default appearance. Without a name, the tab uses
the address's hostname. The Supervision page can then select each agent. The
main instance fetches metrics on demand; it never sends dashboard
configuration to an agent. Configure HTTPS or a trusted private network: the
shared token travels in an HTTP header. Restrict access to the published port.
For each address, **Test connection** checks access and the sync token from the
main server, even before saving. Once saved, the agent gets a branch under
**Supervision → Remote agents**. **Configure** opens that branch's configuration
inside the primary. The primary forwards reads and writes to this saved address;
the token never reaches the browser. Concurrent changes are rejected rather
than overwritten. Test only addresses you trust: the sync token is sent to the address.

Upgrade both the primary and agents for remote configuration. Older agents still
provide metrics but cannot be configured through this interface. Agent settings
are written only to their existing data volume; `read_only: true`, read-only host
mounts and dropped capabilities remain unchanged. There is no remote command
execution. A leftover `DASHMON_PASSWORD` on an agent is ignored.

Existing secondary configurations are retained. To convert one, back up its
data volume, start it with `DASHMON_MODE=agent` and `DASHMON_SYNC_TOKEN`,
then review its configuration on the primary. The first existing local host is reused. The
old replication endpoint no longer accepts configuration; legacy secondary
roles no longer lock the dashboard when running in normal mode.

The `dashmon-data` volume (`/app/data`) persists config, images and custom themes.
Backup: `docker cp dashmon:/app/data ./backup-data` (container stopped).

> **Upgrading an old installation**: the official image now runs as the non-root
> `node` user (uid 1000). If your volume was created by an earlier version, fix
> its owner once:
> `docker run --rm -v dashmon-data:/d alpine chown -R 1000:1000 /d`

## 4. nginx (optional)

A full example: `deploy/nginx.example.conf`. If you use it, set `TRUST_PROXY=1`
and enable `client_max_body_size` in nginx for image imports.

For a step-by-step, copy-paste guide (host nginx, Let's Encrypt, local
certificates, Docker variant and troubleshooting), see
[docs/HTTPS.md](../docs/HTTPS.md).

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

> **Never mount the folder that holds your private keys.** A certificate folder
> usually also contains the key of each service, and possibly the authority key.
> Only the CA certificate is needed, and this applies to backups too: a
> compromised CA can sign a certificate for any of your services.
>
> Do not put a private CA in the `Dockerfile` either: the image is published
> publicly.

If `openssl s_client` returns a single certificate where you expected a chain,
the server is not sending its intermediate. Either complete `ssl_trusted_certificate`
in its reverse proxy configuration, or add the intermediate to `ca-bundle.pem`.

`DASHBOARD_INSECURE_TLS=1` remains available as a last resort for self-signed
certificates. It disables verification for **every** outgoing request, including
public sites, so prefer a bundle.

## 8. Host supervision

The *Supervision* page always shows the local host's CPU, memory, disk and
temperature as observed by the container. Configure the disk path in the
supervision editor, or use [agents](#supervision-agents) for other machines.
Unavailable measurements are shown as `—`. Direct Proxmox API monitoring is no
longer available; existing service and host entries remain in the dashboard.
Back up the data volume before upgrading: legacy Proxmox monitoring settings
are removed from the configuration on the next save, while host names and
service associations are retained.

### WireGuard peers

WireGuard peers for local hosts are read from a filtered dump file. The bundled
script refreshes it with cron and removes private key material before Dashmon
reads it. See [the WireGuard guide](../docs/WIREGUARD.md) for installation,
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

## Notes

- No embedded secrets: the bundled `config.json` only contains public examples. Widget passwords are
  AES-256-GCM encrypted with `DASHMON_MASTER_KEY` and never sent to the browser.
- Logs: `docker logs dashmon`.
