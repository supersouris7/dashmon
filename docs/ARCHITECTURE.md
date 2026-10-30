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
lib/
  config/            environment variables (settings.js), config.json
                     (store.js, repository.js), validation (normalize.js,
                     fields.js), startup migrations, encrypted secrets
  http/              outgoing HTTP client (client.js), authentication,
                     protections (headers, origin, rate limits, agent token),
                     request log, errors
  routes/            all HTTP routes, one file per topic; each header lists
                     its routes
  widgets/           widget registry, schema, storage and core
  status/            status loop of the monitored services
  host/              machine measurements (CPU, RAM, disk) and WireGuard,
                     SMART and APT reports
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

- `public/js/state.js` holds the shared state and the configuration
  normalization; `api.js` handles the writes and the HTTP revisions.
- `editor.js` orchestrates the panels and the save. The drafts and their
  preparation live in `editor-draft.js`, `host-monitoring-draft.js` and
  `replication-draft.js`.
- `pairing-editor.js` and `pairing-list.js` handle the agent form;
  `monitoring-editors.js` and `apt-editor.js` handle the supervision options.
  `confirm-dialog.js`, `color-picker.js` and `editor-drag.js` carry shared editor
  components.
- `render.js`, `pages.js` and `supervision.js` build the views; `view-prefs.js`
  keeps the local presentation preferences.

## Checks

`npm test` runs the tests without a browser and `npm run format:check` checks
the formatting (Prettier; `npm run format` fixes it). `npm run test:browser`
needs Chromium and a Node with `WebSocket`; it starts a temporary instance and
browser profile, then checks notably the login, the pairing, the save and the
creation of a host. The `CHROMIUM_BIN` variable can point to the binary if its
name is not `chromium`. Also run `actionlint` from the repository root to check
the workflows.
