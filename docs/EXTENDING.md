# Add a widget to Dashmon

For an overview of the modules and application flows, see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

Dashmon has no widget list in its code. Each widget is a self-contained folder
in `widgets/`, discovered at startup. Adding an integration modifies **no** core
file: neither `server.js`, nor `render.js`, nor `editor.js`, nor `state.js`, nor
`i18n.js`.

```
widgets/<id>/
  manifest.json   declarative: labels, configuration schema, interval
  server.js       collects the data server-side (CommonJS)
  client.mjs      renders the tile in the browser (ESM)
  client.css      optional: style owned by the widget
```

The fastest starting point: copy `widgets/_template/` (not loaded by Dashmon, it
is a template), rename the folder, edit the three files.

The widgets shipped in `widgets/` are official. The external folders
`DASHMON_WIDGET_DIR` / `DASHMON_PLUGINS_DIR` are **disabled by default**. The
explicit activation through `DASHMON_ALLOW_UNSAFE_PLUGINS=1` runs their code in
the main process, **without security isolation**: only use trusted code. Real
isolation of third-party contributions is not available yet; do not mount
unknown code.

## manifest.json

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
    "fr": { "token": "Jeton API", "pending": "Vérification…" },
    "en": { "token": "API token", "pending": "Checking…" }
  },
  "config": [
    { "key": "apiUrl", "type": "text", "label": "apiUrl", "maxLength": 200 },
    { "key": "apiToken", "type": "secret", "label": "token", "maxLength": 2000,
      "placeholder": "token", "title": { "fr": "Jeton", "en": "Token" } }
  ]
}
```

| Key | Role |
| --- | --- |
| `id` | lowercase letters, dashes, 32 characters max; must match the folder name |
| `interval` | re-check period in ms |
| `cacheKey` | `service` (one entry per URL) or `config` (one entry shared per configuration) |
| `server` / `client` / `css` | file names inside the folder, never a path |
| `strings` | all your texts; a field `label` and `placeholder` refer to them by key |
| `config` | form generated automatically in the editor |
| `defaultFor` | `"link"`: this widget becomes the one that monitors web links (see below) |
| `hidden` | `true`: internal plugin, absent from the editor widget menu |
| `probe` | `true`: the returned `up`/`down` status drives the tile color |

Accepted field types: `text`, `secret`, `select` (+ `options`), `number`
(+ `min`/`max`), `checkbox`. A field can be conditional with
`"when": { "key": "mode", "equals": "tcp" }`: it only appears when another field
has that value.

### Serving a link: `defaultFor: "link"`

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

## server.js

```js
function createState(){ return { tokens: new Map() }; }   // optional

async function check(ctx){
  // ctx.config: the configuration, DECRYPTED secrets
  // ctx.api(base, path, options): shared HTTP client (timeouts, TLS, IPv4)
  // ctx.probe(href): { ok, code, ms, error }, the link probe
  // ctx.state: your memory, created once per widget
  // ctx.storage: what must survive a restart (see below)
  // ctx.log(message): one line in the Dashmon logs
  return { ok: true, value: 42 };                          // -> status cache
}

function purge(activeUrls, state){ /* forget what is no longer monitored */ }

module.exports = { createState, check, purge };
```

The returned status is a free-form object: its content is your display, Dashmon
does not touch it. `check` must never throw: return `{ ok:false, error }`.

### Keeping a value over time

`ctx.state` lives in memory: a restart forgets it. When a widget must remember a
history (rating evolution, counter, version already seen), `ctx.storage` writes
a JSON file under your name in the data folder:

```js
// ctx.storage.read(name, fallback) / ctx.storage.write(name, value)
const store = ctx.storage.read("my-history", { points: [] });
store.points.push({ at: Date.now(), value: 42 });
ctx.storage.write("my-history", store.slice(-90));
```

Only a file name (`letters`, digits, `.`, `-`, `_`, 64 characters max) and 1 MB
are accepted: writing elsewhere is impossible. The write is atomic and silent on
failure — a read-only widget degrades its display, it never prevents startup.
This is exactly what the `lichess` widget uses to show the last known ELO when
lichess.org returns a 429.

## client.mjs

```js
export function render(ctx){
  return {
    badge: "42",            // 1st line
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

## Testing

```
npm test
```

- `test/widgets.test.js` loads the registry, checks the manifests, the
  normalization, the cache keys, the purge and the renderers;
- `test/frontend.test.js` checks the syntax of the browser modules and the
  client registry;
- a broken plugin never makes the load fail: it is ignored and listed in the
  logs, the other widgets keep working.

## Security rules

- **No secret on the client side.** Only `server.js` sees the secrets in clear
  text (decrypted by the server); `client.mjs` only receives the computed
  status.
- The `secret` type is encrypted on write (`aes1.`) and never returned in clear
  text by the API; the editor shows "saved password" and only rewrites the value
  if you enter a new one.
- Declared file names cannot contain `/` or `..`: the registry rejects the
  plugin, it never serves a file outside its folder.
- No npm dependency: a widget is plain JavaScript, loaded as is. The client
  `.mjs` makes it importable in the Node tests.
- `ctx.api` caps the response body (2 MB) and uses the same timeout as the rest
  of Dashmon: do not build your own HTTP client. To read a larger HTML page, ask
  for `maxBody` (capped at 8 MB) and `{ raw: true }` to receive
  `{ status, body, headers }` instead of JSON.
- A `client.mjs` is optional when the tile is already rendered by the generic
  client: this is the case for a `hidden` plugin such as the link probe, which
  builds no metric.

## Installing a third-party widget

Copy the folder into `widgets/`, or mount a read-only plugins folder and point
to it with the `DASHMON_WIDGET_DIR` environment variable (both roots are scanned
at startup, native plugins first). Restart Dashmon (the registry is read at
startup), then reload the page.

## If the plugin is missing or broken

The core depends on no widget: nothing breaks, and above all nothing is lost.

- at startup, an invalid folder (unreadable manifest, `id` different from the
  folder, unknown field, missing server file) is ignored with one log line; the
  other widgets load normally;
- a service configured with an unknown widget is displayed as a standard service
  and **its configuration is kept** as is on save: reinstall the plugin and it
  will find it again;
- the registry is loaded before the port opens, so `/api/widgets` cannot return
  an empty list on the browser first load.
