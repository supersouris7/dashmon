# Dashmon

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platforms](https://img.shields.io/badge/docker-amd64%20%7C%20arm64-4f8f89.svg)

A lightweight self-hosted dashboard to centralize your services: quick access, URL status monitoring, host CPU/RAM metrics, themes and a fr/en interface.

Node.js / Express server, native ES modules, no dependency besides express.

## Quick start

```bash
docker run -d --name dashmon -p 8080:8080 \
  -v dashmon-data:/app/data \
  supersouris7/dashmon
```

→ http://localhost:8080

Docker Compose: see [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

## Features

- **Services**: cards by category or host, search, view modes (rows/columns/full)
- **Monitoring**: URL status + CPU/RAM metrics (`local`, Linux agent `/metrics`, Proxmox)
- **Themes**: native and custom, import/export, custom CSS
- **Interface**: en/fr, alphabetical or usage-based sorting
- **Docker**: standalone multi-arch image (amd64/arm64), `latest`, `unstable` and `vX.Y.Z` tags

## Development

```bash
npm install
npm start
```

## Configuration

Editable from the UI (`Edit Dashmon`). Key fields:

- `services[]`: `name`, `url`, `icon`, `category`, `host`, `monitor`
- `categories[]`, `hosts[]`, `webLinks[]`
- `viewMode` (`rows`/`columns`/`plain`), `openMode`, `groupMode`, `sortMode`
- `theme`, `language` (`en`/`fr`)

Monitoring: `local`, `linux` (Prometheus `/metrics` agent) or `proxmox` (read-only API token).

Environment variables: see `.env.example`. Runtime data in `data/` (`dashmon-data` volume).

## API

| Method | Route | Role |
| --- | --- | --- |
| `GET`/`PUT` | `/api/config` | Read / save config |
| `GET`/`POST`/`DELETE` | `/api/icons` | List / import / delete images |
| `GET`/`POST`/`DELETE` | `/api/themes` | Themes (list / import / delete) |
| `GET` | `/api/themes/:id/export` | Export a theme |
| `GET` | `/api/status` | Status of monitored services |
| `GET` | `/api/host-metrics` | Host CPU/RAM metrics |

## License

MIT — see [LICENSE](LICENSE).

---

Dashmon is developed for my own homelab and released as open source. If you use it and would like to support its development:

<p align="center">
  <a href="https://github.com/sponsors/supersouris7">♥ Support the project on GitHub Sponsors</a>
</p>