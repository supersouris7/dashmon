# Claude Code statistics

The **Claude Code** card on the Supervision page shows how
[Claude Code](https://claude.com/claude-code) is used on a host: the models used
and what each one consumed (input, output, reasoning and cache tokens, model
replies), the sessions and prompts, the most used tools with their failures, and
the activity of the last 30 days. It is the same card as the
[OpenCode](OPENCODE.md) one.

Collapsed, the card shows today's tokens and a summary of the last 30 days.
Click it to choose a period (today, 7 days, 30 days, all time) and see the
details. It appears only once a report exists.

No cost is shown: the session logs do not record any price, and with a
subscription the API price would not match what you pay.

Dashmon never reads your session logs itself: a cron job of the user who works
with Claude Code reads `~/.claude/projects` and writes a summary into the
container data, next to the SMART and APT reports. Only counters are written,
never the prompts, the code or the conversations.

## Installation

Install the script on the host where Claude Code runs:

```sh
curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/claude-stats.sh | sudo install -m 755 /dev/stdin /usr/local/bin/claude-stats.sh
```

Nothing else is needed on the host: the counting runs with the Node.js of the
Dashmon container, which receives the log lines on its input and keeps nothing.
If Claude Code keeps its data outside `~/.claude`, set `CLAUDE_CONFIG_DIR`, as
for Claude Code itself.

Run it **as your own user**, not with `sudo`: the session logs live in your home
directory. Writing into the container requires that this user may use Docker
(member of the `docker` group). A first run on the primary:

```sh
/usr/local/bin/claude-stats.sh
```

For an agent installed with the [startup guide](GETTING_STARTED.md) stack:

```sh
DASHMON_CONTAINER=dashmon-agent /usr/local/bin/claude-stats.sh
```

The script writes to `/app/data/claude.json` in the `dashmon` container by
default. The name depends on your installation (`docker ps` lists it): if the
script answers `container 'dashmon' not found`, pass `DASHMON_CONTAINER=...`.
For a different path **inside** the container, use
`DASHMON_CLAUDE_CONTAINER_PATH`; Dashmon must then receive the same path
through `CLAUDE_REPORT_FILE`.

## Schedule

Add this line to **your** crontab with `crontab -e` (not the root crontab):

```cron
*/15 * * * * /usr/local/bin/claude-stats.sh >/dev/null 2>&1
```

For an **agent**:

```cron
*/15 * * * * DASHMON_CONTAINER=dashmon-agent /usr/local/bin/claude-stats.sh >/dev/null 2>&1
```

The card flags a report older than 6 hours: the job has probably stopped.

## What is counted

- **Replies**: one per model answer, shown as steps. A reply streamed in several
  parts counts once.
- **Prompts**: the messages you typed, not the tool results or the command
  outputs.
- **Sessions**: one per session log; a session counts in every period where it
  was active. Subagents are counted apart.
- **Tools**: each call, and as a failure each call whose result was an error
  (a refused permission included).

## Enable or hide the card

The card shows up by itself with the first report. To hide it, open
**Settings → Supervision**, choose the host, then uncheck **Show Claude Code
statistics** in the **Claude Code** section.

## Bind mount variant

If your user cannot reach Docker, mount a host folder into the container. The
script uses the host path, Dashmon the container path. Without Docker, the
counting runs on the host: this variant needs
[Node.js](https://nodejs.org). The script looks for `node` in the `PATH`, then
in the newest [nvm](https://github.com/nvm-sh/nvm) install; elsewhere, set
`NODE_BIN=/path/to/node`.

```yaml
services:
  dashmon:
    volumes:
      - /srv/dashmon-reports:/reports:ro
    environment:
      CLAUDE_REPORT_FILE: /reports/claude.json
```

The cron line then becomes:

```cron
*/15 * * * * DASHMON_CLAUDE_REPORT=/srv/dashmon-reports/claude.json /usr/local/bin/claude-stats.sh >/dev/null 2>&1
```

The folder must be writable by your user. The read path stays fixed by the
environment, never by the web interface.
