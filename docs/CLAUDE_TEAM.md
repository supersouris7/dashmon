# Claude team

The **Claude team** card on the Supervision page shows what
[Claude Code](https://claude.com/claude-code) is doing on a host right now:

- the **sessions** that are open, with their project, their state (*working* or
  *waiting*), the model they use and for how long;
- the **team**, led by the **project lead** (the main session, which hands
  tasks to the agents: active while a session works): each agent you declared in `~/.claude/agents` (and the built-in
  ones, such as `Explore`, once they have been used), with its configured
  model, an *active* or *inactive* mark and, for an active one, the task it
  works on, its project and the model really used;
- the **last 24 hours** (open the card): the number of tasks per agent and the
  ten latest tasks.

The card appears only once a report exists. It is complementary to the
[Claude Code statistics](CLAUDE_CODE.md), which count tokens and tools; this one
shows the activity as it happens.

Dashmon never reads your Claude Code files itself: a cron job of the user who
works with Claude Code reads them and writes a short summary into the container
data, next to the other reports. **Only summaries are written**: the name of the
project folder (not its path), the state, the model, and a task title truncated
to 80 characters, with control characters removed. Never a prompt, code or
conversation, and never the session identifier. To drop even the titles, see
[Hide the task titles](#hide-the-task-titles).

## Installation

**Quickest:** with the [setup tool](SCRIPTS.md#quick-start-dashmon-setup), one
command installs the script and its cron line, asks the schedule and finds the
container. Run it with `sudo` from **your** account: the cron line then goes
into your crontab, not root's.

```sh
sudo dashmon-setup.sh install claude-team
```

The rest of this section and the schedule below do the same by hand.

Install the script on the host where Claude Code runs:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/claude-team.sh -o /usr/local/bin/dashmon-claude-team.sh
sudo chmod 755 /usr/local/bin/dashmon-claude-team.sh
```

To update it later, one command updates every script of the machine: see
[Update everything at once](SCRIPTS.md#update-everything-at-once).

Nothing else is needed on the host: the summary is built with the Node.js of the
Dashmon container, which receives a few lines on its input and keeps nothing.
If Claude Code keeps its data outside `~/.claude`, set `CLAUDE_CONFIG_DIR`, as
for Claude Code itself.

Run it **as your own user**, not with `sudo`: Claude Code's files live in your
home directory. Writing into the container requires that this user may use
Docker (member of the `docker` group). A first run on the primary:

```sh
/usr/local/bin/dashmon-claude-team.sh
```

For an agent installed with the [startup guide](GETTING_STARTED.md) stack:

```sh
DASHMON_CONTAINER=dashmon-agent /usr/local/bin/dashmon-claude-team.sh
```

The script writes to `/app/data/claude-team.json` in the `dashmon` container by
default. The name depends on your installation (`docker ps` lists it): if the
script answers `container 'dashmon' not found`, pass `DASHMON_CONTAINER=...`.
For a different path **inside** the container, use
`DASHMON_CLAUDE_TEAM_CONTAINER_PATH`; Dashmon must then receive the same path
through `CLAUDE_TEAM_REPORT_FILE`.

## Schedule

Add **one** of these lines to **your** crontab with `crontab -e`, not the root
crontab ([cron in short](SCRIPTS.md#cron-in-short)):

| Schedule | Cron line |
| --- | --- |
| **Every minute (recommended)** | `* * * * * /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1` |
| Every 5 minutes | `*/5 * * * * /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1` |
| Every 15 minutes | `*/15 * * * * /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1` |

Every minute shows a new session or a started agent within two minutes. The run
is light: it reads the sessions and the files modified in the last 24 hours,
and of those only the beginning and the end. It takes well under a second.

For an **agent**:

```cron
* * * * * DASHMON_CONTAINER=dashmon-agent /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1
```

The card flags a report older than 10 minutes: the job has probably stopped.

## What is shown

- **Sessions**: the sessions of `~/.claude/sessions` whose process still runs.
  The state is *working* while Claude Code reports `busy`, *waiting* when it
  is `idle`; any other value shows as unknown. The model is the one of the
  session's last reply.
- **Agents**: a subagent is **active** when its log was written less than two
  minutes ago, its last message is not a finished turn and its session is
  still open. This is an approximation: an agent waiting more than two minutes
  for a long command shows as inactive until it writes again. Its model is the
  one of its last reply, not the alias set in its definition. The project is
  the folder it works in.
- **Names**: an agent shows under its role, the first sentence of its
  `description` when it is a short job title (`description: Security expert.
  Use it to…` shows *Security expert*), with its identifier next to it. The
  built-in agents (`Explore`, `Plan`, `general-purpose`…) have a translated
  name. Without such a sentence, the identifier is shown.
- **Project lead**: the main Claude Code session itself. It is *active* while a
  session is working, with the model and the project of that session.
- **Declared agents** that were never launched show as *inactive* with their
  configured model (`model` of their `~/.claude/agents/*.md` file); `—` when
  the file sets none.
- **Last 24 hours**: the subagent runs started or active in that period.

The status is always written (*Active* / *Inactive*, *Working* / *Waiting*) and
carried by an icon of a different shape, not only by a colour.

The format of the files of Claude Code is internal and may change: the script
reads them loosely, and a value it cannot find is left out of the report
instead of being guessed.

## Hide the task titles

Task titles are free text and may be sensitive. To write none, set
`DASHMON_CLAUDE_TEAM_TITLES=0`: the report then holds the project only (the
title, the session name and the agent descriptions are not written at all,
not merely hidden). The role, a job title of 40 characters at most, is kept:

```cron
* * * * * DASHMON_CLAUDE_TEAM_TITLES=0 /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1
```

## Enable or hide the card

The card shows up by itself with the first report. To hide it, open
**Settings → Supervision**, choose the host, then uncheck **Show the Claude
team** in the **Claude team** section.

## Bind mount variant

If your user cannot reach Docker, mount a host folder into the container. The
script uses the host path, Dashmon the container path. Without Docker, the
summary is built on the host: this variant needs
[Node.js](https://nodejs.org). The script looks for `node` in the `PATH`, then
in the newest [nvm](https://github.com/nvm-sh/nvm) install; elsewhere, set
`NODE_BIN=/path/to/node`.

```yaml
services:
  dashmon:
    volumes:
      - /srv/dashmon-reports:/reports:ro
    environment:
      CLAUDE_TEAM_REPORT_FILE: /reports/claude-team.json
```

The cron line then becomes:

```cron
* * * * * DASHMON_CLAUDE_TEAM_REPORT=/srv/dashmon-reports/claude-team.json /usr/local/bin/dashmon-claude-team.sh >/dev/null 2>&1
```

The folder must be writable by your user. The read path stays fixed by the
environment, never by the web interface.
