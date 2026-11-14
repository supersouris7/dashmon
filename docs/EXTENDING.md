# Extend Dashmon

Dashmon has two extension points. Both work the same way: one folder, a
declarative `manifest.json`, a server module and a browser module, discovered at
startup. Adding one touches **no core file**: not `server.js`, the renderer, the
editor, the state or the translations.

| You want to… | Extension point | Folder | Server entry | Browser entry |
| --- | --- | --- | --- | --- |
| show a number on a **service tile** (an API of a self-hosted app) | widget | `widgets/<id>/` | `check(ctx)` | `render(ctx)` |
| add a **card to the Supervision page** (a fact about the machine) | supervision card | `supervisions/<id>/` | `collect(ctx)` | `card(ctx)` |

For the modules and flows behind them, see [`ARCHITECTURE.md`](ARCHITECTURE.md).
To propose your plugin upstream, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Quick start

```bash
cp -r widgets/_template widgets/my-widget          # a tile widget
cp -r supervisions/_template supervisions/my-card  # a supervision card
```

Set `"id"` in `manifest.json` to the folder name, edit the files, then ask
Dashmon whether it would load them, without starting the server:

```bash
npm run plugin:check -- widgets/my-widget
npm run plugin:check -- supervisions/my-card   # also runs collect() once
```

The command prints the registry's verdict (the same one the logs give at
startup) and, for a supervision card, the report it produces. Restart Dashmon
to load the plugin, then reload the page.

Rules common to both kinds:

- the folder name is the `id`: lowercase letters, digits and dashes, 32
  characters max. A folder starting with `_` (the templates) is never loaded;
- no npm dependency, no build step: plain JavaScript, loaded as is. The server
  module is CommonJS, the browser module is an ES module (`.mjs`), so it can be
  imported by the Node tests;
- use what `ctx` gives you rather than `require("../../lib/...")`: that path
  breaks as soon as the plugin is installed outside the repository folder;
- a broken plugin never prevents startup: it is skipped with one log line, the
  others keep working.

---

## Tile widgets

```
widgets/<id>/
  manifest.json   declarative: labels, configuration schema, interval
  server.js       collects the data server-side (CommonJS)
  client.mjs      renders the tile in the browser (ESM)
  client.css      optional: style owned by the widget
```

### manifest.json

```json
{
  "id": "my-widget",
  "version": "1.0.0",
  "label": { "fr": "Mon widget", "en": "My widget" },
  "description": { "fr": "Une ligne dans l'éditeur", "en": "One line in the editor" },
  "interval": 7200000,
  "cacheKey": "service",
  "server": "server.js",
  "client": "client.mjs",
  "strings": {
    "fr": { "url": "URL de l'API", "token": "Jeton API" },
    "en": { "url": "API URL", "token": "API token" }
  },
  "config": [
    { "key": "url", "type": "text", "label": "url", "maxLength": 200 },
    { "key": "token", "type": "secret", "label": "token", "maxLength": 2000,
      "title": { "fr": "Jeton", "en": "Token" } }
  ]
}
```

| Key | Role |
| --- | --- |
| `id` | lowercase letters, digits, dashes, 32 characters max; must match the folder name |
| `interval` | re-check period in ms (default 5 minutes) |
| `cacheKey` | `service` (one entry per URL) or `config` (one entry shared per configuration) |
| `server` / `client` / `css` | file names inside the folder, never a path |
| `strings` | all your texts, `fr` and `en`; a field `label` and `placeholder` refer to them by key |
| `config` | form generated automatically in the editor (24 fields max) |
| `defaultFor` | `"link"`: this widget becomes the one that monitors web links (see below) |
| `hidden` | `true`: internal plugin, absent from the editor widget menu |
| `probe` | `true`: the returned `up`/`down` status drives the tile color |

A config `key` is lowercase: `^[a-z][a-z0-9_]{0,39}$` (`api_url`, not
`apiUrl`). Accepted field types: `text`, `secret`, `select` (+ `options`),
`number` (+ `min`/`max`), `checkbox`, `host` (a supervised host: empty for
automatic, `local`, or the address of a paired agent; read with
`ctx.supervision`). A field can be conditional with
`"when": { "key": "mode", "equals": "tcp" }`: it only appears when another field
has that value.

#### Serving a link: `defaultFor: "link"`

A service without a widget is a **link** (a plain URL to monitor). It is
Dashmon's first widget (`widgets/web`) that monitors it, thanks to its
`"defaultFor": "link"`. A service that has a widget is always handled by that
widget, even if a plugin claims the `link` slot.

This mechanism makes it possible to **add a link type without touching the
core**: a `defaultFor: "link"` plugin is never chosen by the user (it is
`hidden`). Metric plugins that have no tile renderer are hidden too: YouTube,
Docker Hub and GitHub feed the **web links strip counters**, not the widget
menu. Only one plugin can claim a slot: if two manifests ask for it, the second
is rejected and the error appears in the logs.

For a link plugin that displays a metric:

- `probe: true` makes the tile driven by the `state` you return. It is your
  call: an API that refuses to deliver its counter while the page answers is
  `{ state: "up", ok: false }`, hence a neutral tile, not a red one;
- `interval` is your period (a public API such as GitHub caps at 60 requests per
  hour: 6 h is not excessive);
- `cacheKey: "service"` keeps one entry per service URL.

### server.js

```js
function createState(){ return { tokens: new Map() }; }   // optional

async function check(ctx){
  // ctx.config: the configuration, DECRYPTED secrets
  // ctx.service: the service as stored (name, url...)
  // ctx.api(base, path, options): shared HTTP client (timeouts, TLS, IPv4)
  // ctx.probe(href): { ok, code, ms, error }, the link probe
  // ctx.state: your memory, created once per widget
  // ctx.storage: what must survive a restart (see below)
  // ctx.resultError(code): { errorCode, error } of a common failure
  // ctx.log(message): one line in the Dashmon logs
  return { ok: true, value: 42 };                          // -> status cache
}

function purge(activeUrls, state){ /* forget what is no longer monitored */ }

module.exports = { createState, check, purge };
```

The returned status is a free-form object: its content is your display, Dashmon
does not touch it. `check` should not throw: return `{ ok:false, error }`.
For a common cause, `ctx.resultError(code)` gives `{ errorCode, error }`, which
the tile shows in the viewer's language:
`return { ok: false, ...ctx.resultError("invalid_url") }`. The codes are listed
in `lib/http/api-errors.js`.

#### Keeping a value over time

`ctx.state` lives in memory: a restart forgets it. When a widget must remember a
history (rating evolution, counter, version already seen), `ctx.storage` writes
a JSON file under your name in the data folder:

```js
// ctx.storage.read(name, fallback) / ctx.storage.write(name, value)
const store = ctx.storage.read("my-history", { points: [] });
store.points.push({ at: Date.now(), value: 42 });
ctx.storage.write("my-history", { points: store.points.slice(-90) });
```

Only a file name (`letters`, digits, `.`, `-`, `_`, 64 characters max) and 1 MB
are accepted: writing elsewhere is impossible. The write is atomic and silent on
failure — a read-only widget degrades its display, it never prevents startup.
This is exactly what the `lichess` widget uses to show the last known ELO when
lichess.org returns a 429.

### client.mjs

```js
export function render(ctx){
  return {
    badge: "42",            // 1st line
    badgeUnit: "tokens",    // optional, after the value; hidden on a narrow tile
    badgeClass: "ok",       // ok | nok | warn | pending | ""
    time: "2 min ago",      // 2nd line (hidden in icon mode)
    timeClass: "",          // warn | delta-up | delta-down | ""
    title: "My widget"      // tooltip
  };
}
```

`render` must touch **neither the DOM nor `document`**, and must not throw: the
core catches your exceptions and only degrades your tile. If you need a fully
custom rendering, export `element(ctx)` that returns a DOM node: the core uses
it instead of the descriptor.

`ctx` provides `info` (your status), `config`, `lang`, `t(key)` and the helpers
`formatDateTime`, `formatNumber`, `formatCompactNumber`.

A `client.mjs` is optional when the tile is already rendered by the generic
client: this is the case for a `hidden` plugin such as the link probe.

---

## Supervision cards

A supervision card shows a fact about a **monitored machine** on the
Supervision page: a backup report, a service queue, a hardware sensor, the
output of a host script. It is collected on the machine running Dashmon — the
main instance or an **agent** — and travels to the main dashboard with the
other metrics, so a card written once works for every paired machine.

```
supervisions/<id>/
  manifest.json   labels, icon, texts
  server.js       collect(ctx): builds the report on the monitored machine
  client.mjs      card(ctx): turns the report into a card in the browser
  client.css      optional: style owned by the card
```

The template (`supervisions/_template/`) is a complete, working card: the load
average and uptime of the machine.

### How it flows

```text
collect(ctx) on the host  ->  host metrics: plugins.<id> = report
   (every HOST_METRICS_INTERVAL)        |  local page, or agent -> main dashboard
                                        v
                       card(ctx) in the browser -> descriptor -> card drawn by Dashmon
```

- `collect` runs for the local monitored host on every metrics refresh (60 s by
  default), on the main instance and on agents alike.
- Its report is placed under `plugins.<id>` of the host metrics: its own
  namespace, it can never overwrite a built-in field.
- Each host has a **Show the card** switch per installed plugin in
  **Settings → Supervision → *your host or agent***, in a section named after
  the card (stored as `monitoring.plugins.<id>.enabled`; the card is shown by
  default).
- A card collected by an agent is drawn by the main dashboard: **the plugin must
  be installed on both** (the agent collects, the main instance renders).

### manifest.json

```json
{
  "id": "my-card",
  "version": "1.0.0",
  "label": { "fr": "Charge système", "en": "System load" },
  "description": { "fr": "Charge moyenne et durée de fonctionnement.", "en": "Load average and uptime." },
  "icon": "fa-solid fa-gauge-high",
  "server": "server.js",
  "client": "client.mjs",
  "strings": {
    "fr": { "idle": "Charge normale" },
    "en": { "idle": "Normal load" }
  }
}
```

`label` is the card title, `description` is shown under the switch in the host
settings, `icon` is a Font Awesome 6 free class. `interval`, `config` and the
other widget keys have no effect here: a card follows the metrics refresh and
is configured by its host switch.

### server.js

```js
function createState(){ return {}; }               // optional

function collect(ctx){
  const file = ctx.readDataFile("my-report.json");  // written by a host script
  if (!file) return null;                           // nothing to show: no card
  return { value: Number(file.data.value) || 0, at: file.modifiedAt };
}

module.exports = { createState, collect };
```

`ctx` provides:

| Field | Role |
| --- | --- |
| `host` | `{ id, name, monitoring }`: the supervised host and its settings |
| `state` | your memory, created once by `createState()` |
| `storage` | `read(name, fallback)` / `write(name, value)`: JSON that survives a restart, in `data/supervisions/<id>/` |
| `readDataFile(name, { maxBytes })` | reads a JSON file of the data folder: `{ data, modifiedAt }` (seconds) or `null`. A bare file name only, 2 MB max |
| `sanitizeText(value, max)` | clean, bounded text |
| `log(message)` | one line in the Dashmon logs |

`collect` may be `async`. Return a plain JSON object, or `null` when there is
nothing to show on this host (no report yet, feature absent). Dashmon enforces:

- **5 seconds** to answer, otherwise the card is dropped for this round;
- **64 KB** per report once serialised: a card summary, not a dump;
- an exception, a timeout or an invalid report only drops **your** card; the
  cause is logged once, not on every refresh.

**Never put a secret in the report**: it is sent to the browser, and from an
agent to the main dashboard.

#### Reading what a host script wrote

Most cards read a report produced on the host by a script run from cron, the
way Dashmon's own APT, SMART or WireGuard cards do (see
[`SCRIPTS.md`](SCRIPTS.md)): the script writes a JSON file into the data folder
mounted in the container, `collect` reads it with `ctx.readDataFile`. Keep the
script outside the container's privileges: Dashmon only reads its output.

### client.mjs

```js
export function card(ctx){
  const { report, t, formatNumber } = ctx;
  return {
    status: "ok",                       // ok | warning | critical | unknown
    summary: t("idle"),                 // text of the health line
    value: formatNumber(report.value),  // big number
    unit: "per core",                   // text after it
    rows: [{ label: "Up for", value: "2 d 4 h" }],                  // always visible
    details: [{ label: "Load 5 min", value: "0.4", tone: "ok" }],  // shown when expanded
    note: ""                            // muted paragraph
  };
}
```

Every field is optional. Dashmon draws the card with the frame, health line,
colours, host tint and expand behaviour of the built-in cards: a card with
`details` gets the chevron, and its expanded state is remembered like the
others. `tone` colours a value: `ok`, `warning` or `critical`. Texts and rows
are bounded (30 rows), unknown values are ignored.

`ctx` provides `report` (what `collect` returned), `host` (`{ id, name }`),
`lang`, `t(key)`, `formatNumber`, `formatCompactNumber`, `formatDateTime`,
`relativeAge(epochSeconds)` (*3 min ago*) and `reportDate(epochSeconds)`.

Like a widget, `card` must touch neither the DOM nor `document`, and must not
throw. For a fully custom body, export `element(ctx)` returning a DOM node: the
title bar stays Dashmon's. Style it in your `client.css`, scoped under
`.supervision-card-plugin-<id>`.

---

## Testing

```
npm run plugin:check -- <folder>   # one plugin, as the registry sees it
npm test                           # the whole suite
```

- `test/widgets-*.test.js`, one file per topic, load the registry and check
  the manifests (`registry`), the configuration, cache keys and purge
  (`core`), the probe (`probe`), each widget's backend (`lichess`, `links`,
  `status`) and the renderers (`renderers`); a new widget adds its checks to
  the matching file, with the helpers of `test/widgets/helpers.js`;
- `test/supervisions.test.js` checks the supervision core (isolation of a
  failing plugin, bounds, data files) and the card descriptor; a new card adds
  its `collect` and `card` checks there;
- `test/agent.test.js` checks that a card collected by an agent reaches the
  main dashboard;
- both templates are loaded by the tests: if you change the engine, they must
  still load once copied.

## Security rules

- **No secret on the client side.** Only a widget's `server.js` sees secrets in
  clear text (decrypted by the server); `client.mjs` only receives the computed
  status. A supervision card has no secret field at all.
- The `secret` type is encrypted on write (`aes1.`) and never returned in clear
  text by the API; the editor shows "saved password" and only rewrites the value
  if you enter a new one.
- Declared file names cannot contain `/` or `..`: the registry rejects the
  plugin, it never serves a file outside its folder. The server module is
  never served to the browser.
- `ctx.api` caps the response body (2 MB) and uses the same timeout as the rest
  of Dashmon: do not build your own HTTP client. To read a larger HTML page, ask
  for `maxBody` (capped at 8 MB) and `{ raw: true }` to receive
  `{ status, body, headers }` instead of JSON.
- `ctx.storage` and `ctx.readDataFile` accept a bare file name only: a plugin
  cannot read or write outside the data folder through them.

**A plugin is code that runs inside the Dashmon process, with its rights.** The
bounds above protect against mistakes, not against malicious code. Only install
plugins whose source you have read or whose author you trust.

## Installing a third-party plugin

The simplest way is to copy the folder into `widgets/` or `supervisions/` of
your build. With the published image, mount a read-only folder of plugins and
point to it:

| Variable | Scanned in addition to |
| --- | --- |
| `DASHMON_WIDGET_DIR` (or `DASHMON_PLUGINS_DIR`) | `widgets/` |
| `DASHMON_SUPERVISION_DIR` | `supervisions/` |

These folders are **ignored unless `DASHMON_ALLOW_UNSAFE_PLUGINS=1`** is also
set: their code runs in the main process **without security isolation**. The
logs say so at every startup. Built-in plugins load first; an external plugin
with the id of one already loaded is refused, it never replaces it.

```yaml
services:
  dashmon:
    environment:
      DASHMON_ALLOW_UNSAFE_PLUGINS: "1"
      DASHMON_SUPERVISION_DIR: /plugins/supervisions
    volumes:
      - ./plugins:/plugins:ro
```

For a supervision card read through an agent, set the same variables on the
agent (to collect) and on the main dashboard (to render).

Restart Dashmon (the registries are read at startup), then reload the page.

## If a plugin is missing or broken

The core depends on no plugin: nothing breaks, and above all nothing is lost.

- at startup, an invalid folder (unreadable manifest, `id` different from the
  folder, unknown field, missing server file) is ignored with one log line; the
  other plugins load normally;
- a service configured with an unknown widget is displayed as a standard service
  and **its configuration is kept** as is on save: reinstall the plugin and it
  will find it again. The same goes for a host's card switch;
- a supervision report whose plugin is not installed on the main dashboard is
  simply not drawn;
- the registries are loaded before the port opens, so `/api/widgets` and
  `/api/supervisions` cannot return an empty list on the browser first load.
