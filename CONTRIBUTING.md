# Contributing to Dashmon

Thanks for wanting to improve Dashmon. Bugs, ideas and questions go to the
[issue tracker](https://github.com/supersouris7/dashmon/issues); this page is
for code changes, and especially for **new widgets and Supervision cards**,
which you can write without touching the core.

## Set up

```bash
git clone https://github.com/supersouris7/dashmon.git
cd dashmon
npm ci
DASHMON_MASTER_KEY=$(openssl rand -hex 32) node server.js
```

Runtime data goes to `data/`, ignored by git. Without `DASHMON_PASSWORD` and outside Docker, Dashmon listens on
`127.0.0.1:8080` only, without login: fine for development. Keep the same
master key between restarts if you save widget passwords (otherwise they can
no longer be decrypted). Node 24 is used by the image and the CI. There is no build step: edit a file,
restart the server (server code) or reload the page (browser code).

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — where each responsibility
  lives, and the extension points;
- [`docs/EXTENDING.md`](docs/EXTENDING.md) — how to write a widget or a
  Supervision card.

## Add a widget or a Supervision card

1. Copy the template and name the folder after your plugin id:
   `cp -r widgets/_template widgets/<id>` or
   `cp -r supervisions/_template supervisions/<id>`.
2. Set `"id"` in `manifest.json`, write the texts in **French and English**.
3. Check it: `npm run plugin:check -- widgets/<id>` (or `supervisions/<id>`).
4. Add tests next to the existing ones (see *Testing* in
   [`EXTENDING.md`](docs/EXTENDING.md#testing)): at least the behaviour of
   `check` / `collect` on a normal answer and on a failure, and the renderer.
5. Document it for users: a section in [`docs/WIDGETS.md`](docs/WIDGETS.md) for
   a widget, a short guide in `docs/` for a card that needs a host script.

A plugin pull request should change **only** its folder, its tests and its
documentation. If you need something from the core (a new `ctx` helper, a field
type), open an issue or a separate pull request first: the core change is then
reviewed on its own.

What makes a plugin easy to accept:

- no npm dependency, no build step;
- no secret in a report, a log line or a test fixture;
- a third-party service that fails or rate-limits gives a neutral tile or no
  card, never a red one for someone else's problem;
- reasonable periods: respect the rate limits of public APIs.

## Before opening a pull request

```bash
npm run format:check   # Prettier (npm run format fixes it)
npm run lint           # ESLint: no error
npm test               # every suite of test/run.js passes
actionlint             # when you touch .github/workflows
npm run test:browser   # optional: needs Chromium, runs the full journey
```

The CI runs the same checks on every pull request.

## Public repository: no personal data

Never commit, in code, documentation, examples, fixtures or commit messages:

- a host name, domain or IP address of a real network;
- a user name, handle, account or e-mail address;
- a token, key, password or instance id, real or made up to look real;
- a URL or port of a private service.

Use the documentation values already in the repository instead: addresses in
`192.0.2.0/24` and `198.51.100.0/24` (RFC 5737), domains `exemple.lan` and
`portainer.exemple.lan`. A secret referenced by name in a workflow
(`${{ secrets.NAME }}`) is fine; its value never is.

## Conventions

- Code comments and logs in English; texts shown to users in `fr` and `en`
  (`public/js/i18n/*.json`, or the `strings` of a plugin manifest).
- Every file starts with a comment describing its role.
- Commit messages in French, present tense, prefixed by their topic, as in
  `git log --oneline` — for example
  `widgets : ajoute le widget Exemple` or
  `supervision : carte de charge systeme`.
