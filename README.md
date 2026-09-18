# Dashmon

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platforms](https://img.shields.io/badge/docker-amd64%20%7C%20arm64-4f8f89.svg)

A lightweight, self-hosted dashboard for your homelab: centralize your services
in one page, keep an eye on their status, and watch the CPU/RAM of your hosts.

- **One page, your whole lab**: services grouped by category or host, search,
  view modes (rows / columns / full), icon or name display.
- **Status monitoring**: green/red pills for each URL, refreshed automatically.
- **Host metrics**: CPU/RAM widgets from the local host, a tiny Linux agent
  (`/metrics`), or Proxmox with a read-only API token.
- **Themes**: dark & light built-ins, custom themes, import/export, custom CSS.
- **Interface**: English and French, alphabetical or usage-based sorting.
- **Usage-based sorting**: how often you actually open each service.

Node.js / Express server, native ES modules, zero dependency besides Express.
Runs anywhere Docker runs (amd64 & arm64).

## Quick start

### Docker (recommended)

```bash
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  supersouris7/dashmon
```

→ http://localhost:8080

### Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

Full walkthrough, environment variables, nginx example and troubleshooting:
[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

### From source

```bash
npm install
npm start
```

Maintainers: see [deploy/MAINTAINER.md](deploy/MAINTAINER.md) for building and
publishing Docker images.

## First steps

1. Open the dashboard, click **Edit Dashmon** to add your own services
   (name, URL, icon, category, host).
2. Turn on **Status monitoring** on the services you want pills for.
3. Add hosts to monitor CPU/RAM (`local`, Linux `/metrics` or Proxmox).
4. Customize the theme and interface language in **Appearance**.

Config, icons and themes are persisted in `dashmon-data` (`/app/data`) —
backup that volume and you're done. `config.json` only contains public sample
data; all API tokens are referenced by environment variable, see `.env.example`.

> Monitoring URLs that use LAN names (`portainer.lan`, …): Docker's DNS does
> not know your LAN DNS by default. Give the container your resolver or hosts —
> see the [DNS section](deploy/DEPLOYMENT.md#lan-domains-lan-local-and-status-monitoring).

## Icons

Dashmon uses [Font Awesome 6 (Free)](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css)
for service and category icons. Pick any free solid/brand class, e.g.
`fa-solid fa-folder`. Requests for additional icons — within the free set — are
welcome.

## Requests, bugs, ideas

Everything goes through the issue tracker:

- **Bug reports**: what you did, what you expected, what happened, docker
  version, how it's deployed, and anything from `docker logs dashmon`.
- **Icon requests**: the exact Font Awesome 6 free class you'd like per service.
- **Feature ideas / ideas**: describe the use case, not just the feature.

## Support & contact

Dashmon is a homelab side-project, developed and released in good faith — not a
commercial product. **There is no SLA, no guaranteed fixes and no paid support.**

- Prefer GitHub issues for bugs and features (publicly answerable, includes the
  picture gallery above).
- For one-off questions, use GitHub Discussions.

## License

MIT — see [LICENSE](LICENSE). Provided “as is”, without warranty of any kind.
You are free to use, modify and redistribute it, including for commercial
purposes, provided you keep the copyright notice.

---

If you use Dashmon and would like to support its development:

<p align="center">
  <a href="https://github.com/sponsors/supersouris7">♥ Support the project on GitHub Sponsors</a>
</p>