# Dashmon architecture

This page helps contributors locate the responsibilities of the code.
Installation and configuration instructions stay in the README and the other
guides.

## Overview

```text
Browser: state and drafts -> HTTP API -> main server
                                           |-- configuration and storage
                                           |-- local supervision
                                           |-- widgets
                                           `-- remote agents (measurements only)
```

The agent mode exposes its local supervision. The primary queries its agents; it
does not send them its dashboard configuration. Browser-owned layout preferences
are distinct from the server configuration.

## Server

`server.js` only contains the assembly: it reads the configuration, creates the
services, then mounts the Express pipeline in order (security, rate limits,
authentication, routes, errors). Its header serves as the code map. Every file
in `lib/` starts with a comment describing its role.

```text
server.js            application assembly
agent-server.js      agent mode entry point
scripts/
  screenshots.js     regenerates docs/images from fictional data
lib/
  config/            environment variables (settings.js), config.json
                     (store.js, repository.js), validation (normalize.js,
                     fields.js), startup migrations (default web links),
                     encrypted secrets
  http/              outgoing HTTP client (client.js), authentication,
                     protections (headers, origin, rate limits, agent token),
                     request log, errors
  routes/            all HTTP routes, one file per topic; each header lists
                     its routes
  widgets/           widget registry, schema, storage and core
  status/            status loop of the monitored services
  host/              machine measurements (CPU, RAM, disk, scheduled
                     speed test) and WireGuard, SMART, APT, OpenCode
                     and Claude Code reports
  agent/             protocol, identity and agent pairing
  themes.js          theme validation
  version.js         version label and mount detection
  lifecycle.js       startup, status loop and clean shutdown
  log.js             timestamped logs
widgets/<id>/        one folder per widget (see EXTENDING.md)
```

A few rules guide this split:

- Only `lib/config/settings.js` reads `process.env`; the other modules receive
  the `settings` object.
- Routes receive their dependencies as parameters
  (`registerXxxRoutes(app, { ... })`): they know neither the configuration file
  nor the schema, and are tested without starting the server.
- Configuration writes are atomic and revisions (ETag) detect concurrent
  modifications.
- Comments and logs are in English; the messages returned by the API stay in
  French, because the interface displays them.
- Do not add a secret or a real identifier example to the repository.

## Browser

The interface is plain ES modules loaded by `public/index.html` from
`public/js/app.js`, without any build step. Every module starts with a comment
describing its role.

```text
public/js/
  app.js               entry point: start-up, main menu, global events
  state.js             shared state (config, editor drafts, view preferences)
  api.js               reads and writes of the configuration
  render.js            dashboard rendering: visible services, groups, collapse
  dashboard/           tiles (cards.js), sections, web links banner, Fortune
                       Cookie bar (fortune-bar.js), toolbar
                       buttons (view-controls.js), search and group labels
                       (query.js)
  supervision.js       supervision page and metrics refresh
  supervision/         one file per card (host, speed test, WireGuard, SMART, APT,
                       coding agents: OpenCode and Claude Code), shared
                       card behaviour (cards.js), mosaic layout (masonry.js),
                       texts (format.js) and the
                       supervised instances (instances.js)
  editor.js            settings page: navigation tree, save, import / export
  editor/              one file per panel (services, widgets, categories,
                       dashboards, hosts, web links, pairing...), the widget
                       settings dialog and the editor helpers (drafts, drag,
                       colour and icon pickers, confirmation dialog in
                       confirm.js); shared local/agent monitoring form in
                       host-settings.js
  config/              config schema (normalize.js), value checks (sanitize.js),
                       icon list, example data (demo.js), language choice
                       (language.js)
  i18n.js, i18n/       interface texts, one JSON file per language; t() has
                       no DOM, so modules that translate are testable in Node
  language-ui.js       applies the language to the page and re-renders
  element.js           element(tag, class, text), the brick of the cards
  widget-registry.js   loads the widgets published by the server
  pages.js, themes.js, view-prefs.js, images.js, fortune.js, metrics.js...
  preload.js           theme applied before the first paint (dashboard and login)
  login.js             login page
```

- No module imports a module that imports it back: a submodule receives what
  it needs as a parameter or from a shared leaf module.
  `test/import-cycles.test.js` refuses any cycle.
- Styles, in load order: `base.css` (theme variables, page layout, toolbar),
  `editor.css` (form controls, dialogs), `components.css` (tiles, sections,
  supervision cards, settings rows) and `settings.css` (the frame of the
  settings window: title bar, menu tree, panel and footer, each styled once).
- View preferences (columns, sorting, collapsed sections) live in the browser
  (`view-prefs.js`), not in `config.json`.
- `config/normalize.js` and `config/sanitize.js` mirror the server rules: a
  value the server refuses must not be accepted in the browser either.
- Texts are added to both `i18n/fr.json` and `i18n/en.json`: a test checks that
  both files have the same keys.

## Checks

`npm test` runs the tests without a browser, `npm run lint` the static analysis
(ESLint: undefined names, unused variables and imports) and
`npm run format:check` checks the formatting (Prettier; `npm run format` fixes
it). The browser and server normalizations of the config are written twice:
`test/config-parity.test.js` checks that they agree. `npm run test:browser`
needs Chromium and a Node with `WebSocket`; it starts a temporary instance and
browser profile, then checks notably the login, the pairing, the save and the
creation of a host. The `CHROMIUM_BIN` variable can point to the binary if its
name is not `chromium`. Also run `actionlint` from the repository root to check
the workflows. The workflow runs all of these on every push and pull request.
