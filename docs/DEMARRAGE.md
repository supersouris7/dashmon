# Install Dashmon and its agents

## Choose your installation

- **Primary**: the dashboard, installed once.
- **Agent**: optional; installed on every other machine you want to monitor.
- **Portainer**: paste the stack into **Stacks → Add stack → Web editor**.
- **Docker Compose**: paste the same stack into `compose.yaml`, then run
  `docker compose up -d` from its folder.

The examples use `unstable`, updated from `main`. For a stable release, replace
it with a published version that includes the agents. The examples create named
Docker volumes: do not delete them during an upgrade.

## 1. Prepare the secrets

Generate **two distinct values**, one for the primary encryption key and one for
the token shared by the agents:

```sh
openssl rand -base64 32
openssl rand -base64 32
```

Also pick a password for the primary and, for each agent, a password for its
local page. Never publish these values.

| Variable | Primary | Agent |
| --- | --- | --- |
| `DASHMON_PASSWORD` | Dashboard password | Local page password; may differ |
| `DASHMON_MASTER_KEY` | Widget secret encryption key, **required** | Not needed |
| `DASHMON_SYNC_TOKEN` | Shared token, required for the agents | **Same value as the primary** |

Keep a backup of the master key: if it changes, previously encrypted widget
secrets become unreadable. Generate it with `openssl rand -hex 32`. For an
installation without an agent, the token may stay empty.

### Where to enter the values

**Portainer:** on the stack page, under **Environment variables**, add the names
and their values, then click **Deploy the stack**. The variables are visible to
Portainer administrators: protect that access.

**Docker Compose:** in the same folder as `compose.yaml`, create a private
`.env` file and open it in your editor:

```sh
umask 077
touch .env
nano .env
```

Enter the names below with your values. For the agent, the master key may be
omitted. Never commit `.env`.

```dotenv
DASHMON_PASSWORD=
DASHMON_MASTER_KEY=
DASHMON_SYNC_TOKEN=
```

## 2. Install the primary

Paste this stack into Portainer or into `compose.yaml`:

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

With Compose, from the folder that contains `compose.yaml` and `.env`:

```sh
docker compose up -d
docker compose ps
```

Open your server address on port **8080** and sign in. In `8080:8080`, the first
number is the server port; change it if it is already taken. The second is
Dashmon's internal port: leave it at `8080`.

These ports are published on the server interfaces. Limit access with a firewall
and use HTTPS or a trusted private network. For local-only access through a proxy
on the same server, use `127.0.0.1:8080:8080` instead.

For HTTPS access with nginx, follow the **[HTTPS with nginx](HTTPS.md)** guide:
copy-paste configuration, Let's Encrypt or local certificate, and checks.

## 3. Install an agent

On the machine to monitor, create **another stack** and set its password as well
as the **same** `DASHMON_SYNC_TOKEN` as the primary:

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
      - "8081:8080"
    environment:
      DASHMON_MODE: agent
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Set DASHMON_PASSWORD}
      DASHMON_SYNC_TOKEN: ${DASHMON_SYNC_TOKEN:?Set DASHMON_SYNC_TOKEN}
    volumes:
      - dashmon-agent-data:/app/data
      # Optional: host disk, read-only.
      # - /:/host:ro

volumes:
  dashmon-agent-data:
```

With Compose, create a separate folder, put this stack and its own `.env` in it,
then run `docker compose up -d`. The container names above let you use the
integration guides' commands directly; adapt them if you install several
instances on the same server.

The named volume keeps the agent settings. To use a host folder instead, replace
`dashmon-agent-data:/app/data` with the absolute path of your folder followed by
`:/app/data`, then remove the final `volumes` section. The folder must be
writable by the container UID `1000`.

1. Open the agent address on its published port, here `8081`, then sign in with
   **its** password.
2. Set the host name and the options you need. To measure the host disk,
   uncomment the `/host:ro` mount, redeploy and enter `/host` in the disk path
   field. Otherwise the measurement covers the container.
3. On the primary: **Settings → Supervision → Pairing**. Add the agent full address,
   for example `http://exemple.lan:8081`, then name the tab if you want.
   Next, link the host created in the **Hosts** tab: its color and icon are used
   when hovering its tile in Supervision. Without a host, the pairing still
   works but the tile keeps its default appearance.
4. Click **Test connection**, then **Save**. The **Configure** button opens the
   agent page. The tab appears in Supervision.

The test uses the **primary** network and certificate; the Configure button uses
the browser. Only test a trusted address: the token is sent to it. Restrict the
agent port and protect the traffic with HTTPS or a trusted private network.

## 4. Add WireGuard, SMART or APT

Install the scripts **on every host concerned**, not inside the agent. For an
agent, use its container name in the commands and the cron job. The guides
provide the full commands:

- [WireGuard: install and schedule the dump](WIREGUARD.md)
- [SMART: install and schedule the dump](SMART.md)
- [APT: install and schedule the updates](APT_UPDATES.md)

The reports stay optional. APT **actually installs updates**; its automatic
reboot is disabled unless explicitly enabled.

## 5. Upgrade and back up

**Portainer:** open the stack, then **Pull and redeploy** asking for the image
download. Keep the volume and the environment variables.

**Compose:** in each stack folder:

```sh
docker compose pull
docker compose up -d
```

Back up the primary data volume and its master key separately. Each agent has
its own configuration volume. Upgrading an image does not upgrade the scripts
installed on the hosts.

## Quick troubleshooting

| Problem | Check |
| --- | --- |
| Port already in use | `sudo ss -ltnp`; change the left-hand port in `ports`. |
| Agent unreachable | Check its port, the firewall and the address from the primary. |
| Token rejected | Check that `DASHMON_SYNC_TOKEN` is identical on both stacks, then redeploy. |
| Certificate or DNS error | See [DNS and certificates](../deploy/DEPLOYMENT.md#6-monitoring-lan-domains-lan-local). |
| No SMART, APT or WireGuard data | Check the script and the container name on the host concerned. |
| Mounted folder not writable | The container uses UID `1000`; check the folder owner and permissions. |

The [deployment documentation](../deploy/DEPLOYMENT.md) also covers the proxy,
DNS, certificates and the optional Docker socket. For a step-by-step HTTPS
setup, see [HTTPS with nginx](HTTPS.md).
