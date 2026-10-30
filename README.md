# Dashmon

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platforms](https://img.shields.io/badge/docker-amd64%20%7C%20arm64-4f8f89.svg)

**Your whole homelab on a single screen.** Dashmon lists every service you run,
shows at a glance whether it is up, and — for the tools you actually care about —
puts a **live metric right on the tile**: your running containers, your last
backup, your blocked queries, your current rating.

No account, no cloud, no database. One small Node.js container, one page, and
you stop guessing whether *that* thing is working.

- **Several dashboards, one page** — split your lab across named dashboards, each
  with its own icon; group by category or by host, search, three view modes
  (rows / columns / full), small or large icons.
- **Live widgets, not just green/red dots** — Docker, Duplicati, AdGuard, Gotify,
  qBittorrent, MeTube, Lichess, Uptime Kuma and Ping report straight onto the tile.
  → [widget catalog](docs/WIDGETS.md)
- **Web-link counters** — show GitHub stars, Docker Hub pulls or YouTube
  subscribers right in the web-links banner, e.g. *GitHub (109)*.
- **Real status monitoring** — an up/down pill per URL, refreshed automatically.
- **Host supervision** — a dedicated page with CPU, memory, disk and temperature
  from Dashmon itself or its supervision agents. WireGuard peers can be read from
  a local `wg show all dump` file; a dedicated *Edit supervision* screen
  configures hosts and peer display.
- **Supervision agents** — deploy a lightweight agent on another host and view
  its local metrics from the main dashboard, without copying its configuration.
- **Themes** — dark and light built in, plus your own custom themes and CSS.
- **Two languages** — English and French, throughout the interface.
- **Learns your habits** — services you open often float to the top.

Node.js / Express, a single runtime dependency. Runs anywhere Docker
runs, on **amd64 and arm64**.

---

## Widgets

Widgets add a live metric to a service tile; a service without one remains a
plain status-checked link. GitHub, Docker Hub and YouTube instead power the
web-link counters. See the **[widget catalog](docs/WIDGETS.md)** for available
integrations and configuration.

## Quick start

**[Step-by-step guide: primary, agent, Portainer and Docker Compose](docs/DEMARRAGE.md)**
— includes ready-to-paste stacks, shared-token setup and links to integration guides.

### Docker (recommended)

```bash
read -rs -p "Dashmon password: " DASHMON_PASSWORD
export DASHMON_PASSWORD
# Encrypts widget passwords. Save it somewhere safe: it is needed again
# whenever the container is recreated.
export DASHMON_MASTER_KEY="$(openssl rand -hex 32)"
echo "$DASHMON_MASTER_KEY"
docker run -d --name dashmon --read-only --cap-drop=ALL --security-opt=no-new-privileges:true \
  -p 127.0.0.1:8080:8080 \
  -v dashmon-data:/app/data \
  -e DASHMON_PASSWORD -e DASHMON_MASTER_KEY \
  supersouris7/dashmon
```

→ http://localhost:8080

### Docker Compose

```bash
cp .env.example .env
# fill in DASHMON_PASSWORD and DASHMON_MASTER_KEY in .env
docker compose up -d
```

### Portainer

Use the ready-to-paste [Portainer stack examples](docs/DEMARRAGE.md#2-install-the-primary)
for the main dashboard and its optional supervision agents.

Full walkthrough, environment variables, nginx example and troubleshooting:
[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md). For a copy-paste HTTPS setup,
see **[docs/HTTPS.md](docs/HTTPS.md)**.

### From source

```bash
npm install
npm start
```

Maintainers: see [deploy/MAINTAINER.md](deploy/MAINTAINER.md) for building and
publishing Docker images.

## First steps

1. Click **Edit Dashmon** and add your services (name, URL, icon, category, host).
2. Turn on **Status monitoring** for the services you want a pill on.
3. Give a service a **widget** — that's where the live numbers appear.
4. Add hosts to organize services by machine, with their own icons and colors.
5. Adjust the theme and language under **Appearance**.

Config, icons and themes live in the `dashmon-data` volume (`/app/data`) — back
that volume up, and keep `DASHMON_MASTER_KEY` somewhere safe: widget passwords
are encrypted with it and never sent back to the browser.

Web links live above the toolbar. Their color and visibility are configured in
**Appearance**; visibility is remembered by each browser.

### What lives where

- **On the server (`config.json`)** — your dashboard: services, categories, hosts,
  web links, language, theme, click counters.
- **In this browser only (`localStorage`)** — the layout: view mode, sort,
  grouping, how links open, collapsed sections, small icons. Nothing is written
  to disk and nothing is sent back, so **a layout never travels from one device to
  another**. The values already in `config.json` only seed a browser that has
  never picked a layout.

## Icons

Dashmon uses [Font Awesome 6 (Free)](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css)
for service and category icons — pick any free solid or brand class, e.g.
`fa-solid fa-folder`. Requests for additional icons, within the free set, are
welcome.

You can also upload your own **PNG icons** (editor → **Images** tab) and assign
them to a service. [Dashboard Icons](https://dashboardicons.com/) provides plain
PNG logos for many self-hosted apps.

## Documentation

| | |
| --- | --- |
| **[docs/WIDGETS.md](docs/WIDGETS.md)** | Widgets and web-link counters. |
| **[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)** | Installation, environment and troubleshooting. |
| **[docs/DEMARRAGE.md](docs/DEMARRAGE.md)** | Principal and agent setup, Portainer and Compose stacks. |
| **[docs/HTTPS.md](docs/HTTPS.md)** | HTTPS with nginx: copy-paste configuration, Let's Encrypt or local certificate. |
| **[docs/WIREGUARD.md](docs/WIREGUARD.md)** | WireGuard dump and cron script. |
| **[docs/SMART.md](docs/SMART.md)** / **[docs/APT_UPDATES.md](docs/APT_UPDATES.md)** | Local SMART and APT supervision. |
| **[CUSTOMIZATION.md](CUSTOMIZATION.md)** | Themes and icons. |
| **[docs/EXTENDING.md](docs/EXTENDING.md)** | Widget development. |
| **[deploy/MAINTAINER.md](deploy/MAINTAINER.md)** | Image build and publication. |

> Monitoring URLs that use LAN names such as `portainer.exemple.lan`? Docker's resolver does
> not know your LAN DNS out of the box. Give the container your resolver or hosts —
> see the [DNS section](deploy/DEPLOYMENT.md#6-monitoring-lan-domains-lan-local).

## Requests, bugs, ideas

Everything goes through the issue tracker:

- **Bug reports** — what you did, what you expected, what happened, the Docker
  version, how you deployed it, and anything relevant from `docker logs dashmon`.
- **Icon requests** — the exact Font Awesome 6 free class you'd like per service.
- **Feature ideas** — describe the use case, not just the feature.

## Support & contact

Dashmon is a homelab side-project, developed and released in good faith — not a
commercial product. **There is no SLA, no guaranteed fix window and no paid
support.**

- Prefer GitHub issues for bugs and features: they stay publicly answerable.
- For one-off questions, use GitHub Discussions.

## License

MIT — see [LICENSE](LICENSE). Provided “as is”, without warranty of any kind. You
are free to use, modify and redistribute it, including commercially, provided you
keep the copyright notice.

---

If Dashmon is useful to you and you'd like to support its development:

<p align="center">
  <a href="https://ko-fi.com/dashmon">♥ Support the project on Ko-fi</a>
</p>
