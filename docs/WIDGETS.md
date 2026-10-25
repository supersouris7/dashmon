# Dashmon widgets

A **widget** turns a plain service link into a live tile: instead of only a green
or red dot, it displays the number you actually care about.

Assign one in the service editor (**Edit Dashmon** → pick a service → **Widget**).
It applies immediately, no restart.

| Widget | Tile shows | Configure with |
| --- | --- | --- |
| [Docker](#docker) | Running containers + out-of-date images | mode, URL |
| [Duplicati](#duplicati) | Last backup OK/NOK and its date | API password |
| [AdGuard Home](#adguard-home) | Blocked queries, as a percentage | protocol, URL, user, password |
| [Gotify](#gotify) | Latest notification and priority | client token |
| [qBittorrent](#qbittorrent) | Download and upload speeds | username, password |
| [MeTube](#metube) | Completed videos and current activity | *nothing* |
| [Lichess](#lichess) | ELO rating and one-month evolution | username, variant |
| [Uptime Kuma](#uptime-kuma) | Public status-page monitors | URL, one or two slugs |
| [Ping](#ping) | TCP reachability | host, port (optional) |
| [web](#web-the-default-one) | Up / down dot for a plain link | *nothing* |

GitHub, Docker Hub and YouTube are **not** tile widgets: they power the counters
of the **web-links banner**. See [Web-link counters](#web-link-counters).

---

## Docker

**Shows** how many containers are running out of the total, and which images are
**out of date**. Each image is compared against its registry **by digest**, so an
image whose tag moved without you noticing is flagged instead of silently
reported as up to date.

**Configuration**

- **mode** — `local` to use the container's own Docker socket, or `tcp` to query
  a remote Docker API.
- **url** — the Docker endpoint, e.g. `tcp://host:2375` or `https://…`.
  Leave empty in `local` mode.

In `local` mode, mount the socket read-only:

```yaml
services:
  dashmon:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

> A remote Docker API is unauthenticated by default and is effectively root on
  that host. Keep it on a trusted network only.

## Duplicati

**Shows** whether the most recent backup succeeded (**OK** / **NOK**) and when it
ran.

**Configuration**

- **password** — the Duplicati **API** password, not the backup encryption
  passphrase. Stored encrypted, server-side only.

Dashmon calls the Duplicati API on the service URL you already configured for
the tile.

## AdGuard Home

**Shows** the share of DNS queries your blocker filtered out, as a percentage.

**Configuration**

- **protocol** — `HTTPS` or `HTTP`.
- **url** — host and port of AdGuard Home, e.g. `portainer.exemple.lan:3000`.
- **username** and **password** — your AdGuard Home web credentials. The
  password is stored encrypted and never leaves the server.

## Gotify

**Shows** the latest notification and its priority. A priority of 5 or more is
highlighted, and a priority of 8 or more marks the tile as an alert.

**Configuration**

- **client token** — create a client token in Gotify, then paste it here. It is
  stored encrypted and never leaves the server.

Dashmon reads the latest notification from the Gotify API on the service URL
already configured for the tile.

## qBittorrent

**Shows** the current download and upload speeds. The tooltip also includes the
total data downloaded and uploaded since qBittorrent started.

**Configuration**

- **username** and **password** — the qBittorrent Web UI credentials. The
  password is stored encrypted and never leaves the server.

Dashmon calls the qBittorrent Web API on the service URL already configured for
the tile. Enable the Web UI in qBittorrent's settings before adding the widget.

## MeTube

**Shows** how many videos MeTube has completed, plus currently active or queued
downloads on the second line.

MeTube needs no additional configuration: Dashmon reads its public `/history`
endpoint on the service URL already configured for the tile.

## Lichess

**Shows** your current ELO rating and how it moved over the past month.

**Configuration**

- **username** — your Lichess handle.
- **variant** — `Auto`, `Classical`, `Rapid` or `Blitz`. *Auto* uses your main
  rating.

Uses the public Lichess API — no token.

## Web-link counters

A **web link** (the banner at the top of the dashboard) can show a public number
next to its name. In the web-link editor, set its **counter** and pick a target:
the name then reads *GitHub (109)*, *YouTube (3k)* — the number is bold.

| Counter | Shows | Target |
| --- | --- | --- |
| GitHub | stars of a repository | `owner/name` |
| Docker Hub | pulls of a repository | `name` or `owner/name` |
| YouTube | subscribers of a channel | `@handle`, a full URL, or a `UC…` id |

Large numbers are compacted to stay readable: `3k` for 3 000, `64.6M` for
64 600 000. A counter stays hidden (the name shows alone) until its value is
available, and reappears on its own.

Each counter reads a **public source**, so no token is required:

- **YouTube** is read from the channel's public page — no API key or Google account.
- **Docker Hub** needs no token, so it is subject to Docker Hub's public rate limits.
- **GitHub** uses the anonymous API (60 requests/hour per IP). On rate limit the
  value is simply not shown rather than reported as zero. Add a token through the
  `GITHUB_TOKEN` environment variable if you need more — see
  [.env.example](../.env.example) and the
  [deployment guide](../deploy/DEPLOYMENT.md).

## Uptime Kuma

**Shows** one line per status page: the page name and how many monitors are up.
Green while everything is up, red as soon as one monitor is down. A planned
maintenance is not a failure, so it stays green. The tooltip adds the detail —
*how many* in total, and which monitors are down.

The counter keeps the English word `up` in both languages: it is what a
monitoring tool is expected to say, and *en ligne* would double the tile width
to mean the same thing.

**Configuration**

- **url** — the instance address, e.g. `https://portainer.exemple.lan`. A scheme is
  optional; without one, Dashmon tries `https` then `http`.
- **slug1** — the first status page slug: the last segment of the page URL, so
  `https://portainer.exemple.lan/status/services` means `services`.
- **slug2** — an optional second page, for when you publish several.

Uptime Kuma has no REST API for its monitors — everything goes through
socket.io after login — but its status pages expose two JSON endpoints, which is
what the widget reads. No key, no dependency.

Two things catch people out, and the tooltip reports both instead of leaving you
guessing:

- only monitors sitting in a **public group** of the status page are visible. A
  monitor you never added to the page stays invisible, which looks exactly like
  an empty page;
- an **unknown slug** answers `200` with an empty list rather than an error,
  which is why the widget tells a wrong slug from a genuinely empty page.

## Ping

**Shows** the usual green / red dot — no metric, no extra line.

**Configuration**

- **host** — the IP or hostname to test. It may carry a port
  (`portainer.exemple.lan:445`).
- **port** — the TCP port to connect to. `0` means 80, or 443 when the service
  URL is `https`. It takes priority over a port written in the host.

This is **not** an ICMP ping. Node has no ICMP socket, the image ships no `ping`
binary, and a raw ICMP socket needs a privilege the container does not have. The
widget resolves the name, then opens a TCP connection: it answers "is this
service reachable?", without touching the image or the container's permissions.
Port 80 on a machine that does not serve HTTP therefore shows red even though
the machine is up — which is why the error names the port that was actually
tried.

## web — the default one

Every service without an explicit widget uses this one. It performs a plain HTTP
probe of the link and keeps the familiar green / red dot. Nothing to configure.

---

## How failures are displayed

A widget that measures a **third-party** site — or one of the offline web-link
counters (YouTube, Docker Hub, GitHub) — can fail for reasons that have nothing
to do with your service: a quota, a rate limit, an API change. In that case the
tile goes **neutral**, not red, and a counter shows nothing rather than a fake
zero: Dashmon does not want to cry outage for someone else's problem.

The link itself is still status-checked on its own.

## Secrets

Passwords entered in the editor are stored **encrypted in `config.json`, on the
server side only**. They are never sent back to the browser, and never written to
`localStorage`. Keep your data volume private and back it up as-is.

## Adding your own

Widgets are plugins: one folder in `widgets/`, three files, no build step, no new
npm dependency. Adding one touches **no file of the core** — not the server, not
the renderer, not the editor.

```bash
cp -r widgets/_template widgets/my-widget   # then edit manifest.json, server.js, client.mjs
```

→ **[docs/EXTENDING.md](EXTENDING.md)** — the full guide (manifest, contexts,
security rules, tests).

Missing a widget for a tool you self-host? [Open an issue](https://github.com/supersouris7/dashmon/issues).
