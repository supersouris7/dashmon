# OpenCode statistics

The **OpenCode** card on the Supervision page shows how
[OpenCode](https://opencode.ai) is used on a host: the models used and what each
one consumed (input, output, reasoning and cache tokens, steps, cost), the
sessions and prompts, the most used tools with their failures, and the activity
of the last 30 days.

Collapsed, the card shows today's tokens and a summary of the last 30 days.
Click it to choose a period (today, 7 days, 30 days, all time) and see the
details. It appears only once a report exists.

Dashmon never runs OpenCode itself: a cron job of the user who works with
OpenCode runs `opencode stats --json` and writes the result into the container
data, next to the SMART and APT reports. Only counters are written, never the
prompts, the code or the conversations.

## Installation

**Quickest:** with the [setup tool](SCRIPTS.md#quick-start-dashmon-setup), one
command installs the script and its cron line, asks the schedule and finds the
container. Run it with `sudo` from **your** account: the cron line then goes
into your crontab, not root's.

```sh
sudo dashmon-setup.sh install opencode-stats
```

The rest of this section and the schedule below do the same by hand.

Install the script on the host where OpenCode runs:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/opencode-stats.sh -o /usr/local/bin/dashmon-opencode-stats.sh
sudo chmod 755 /usr/local/bin/dashmon-opencode-stats.sh
```

To update it later, one command updates every script of the machine: see
[Update everything at once](SCRIPTS.md#update-everything-at-once).

Run it **as your own user**, not with `sudo`: the statistics live in your home
directory. Writing into the container requires that this user may use Docker
(member of the `docker` group). A first run on the primary:

```sh
/usr/local/bin/dashmon-opencode-stats.sh
```

For an agent installed with the [startup guide](GETTING_STARTED.md) stack:

```sh
DASHMON_CONTAINER=dashmon-agent /usr/local/bin/dashmon-opencode-stats.sh
```

The script writes to `/app/data/opencode.json` in the `dashmon` container by
default. The name depends on your installation (`docker ps` lists it): if the
script answers `container 'dashmon' not found`, pass `DASHMON_CONTAINER=...`. For a
different path **inside** the container, use `DASHMON_OPENCODE_CONTAINER_PATH`;
Dashmon must then receive the same path through `OPENCODE_REPORT_FILE`.

The script looks for `opencode` in the `PATH`, then in `~/.opencode/bin`. If it
is installed elsewhere, set `OPENCODE_BIN=/path/to/opencode`.

## Schedule

Add **one** of these lines to **your** crontab with `crontab -e`, not the root
crontab ([cron in short](SCRIPTS.md#cron-in-short)):

| Schedule | Cron line |
| --- | --- |
| Every 5 minutes | `*/5 * * * * /usr/local/bin/dashmon-opencode-stats.sh >/dev/null 2>&1` |
| **Every 15 minutes (recommended)** | `*/15 * * * * /usr/local/bin/dashmon-opencode-stats.sh >/dev/null 2>&1` |
| Every hour | `0 * * * * /usr/local/bin/dashmon-opencode-stats.sh >/dev/null 2>&1` |

Every 15 minutes keeps today's tokens current at no real cost. Every 5 minutes
follows a long session more closely; every hour is enough for the 30-day
summary.

For an **agent**:

```cron
*/15 * * * * DASHMON_CONTAINER=dashmon-agent /usr/local/bin/dashmon-opencode-stats.sh >/dev/null 2>&1
```

The card flags a report older than 6 hours: the job has probably stopped.

## Enable or hide the card

The card shows up by itself with the first report. To hide it, open
**Settings → Supervision**, choose the host, then uncheck **Show OpenCode
statistics** in the **OpenCode** section.

## On an application tile

The same figures can show on the OpenCode tile of the dashboard: give the
service the **OpenCode** widget (chosen by itself for a service named
OpenCode). See [the widget catalog](WIDGETS.md#opencode).

## Bind mount variant

If your user cannot reach Docker, mount a host folder into the container. The
script uses the host path, Dashmon the container path.

```yaml
services:
  dashmon:
    volumes:
      - /srv/dashmon-reports:/reports:ro
    environment:
      OPENCODE_REPORT_FILE: /reports/opencode.json
```

The cron line then becomes:

```cron
*/15 * * * * DASHMON_OPENCODE_REPORT=/srv/dashmon-reports/opencode.json /usr/local/bin/dashmon-opencode-stats.sh >/dev/null 2>&1
```

The folder must be writable by your user. The read path stays fixed by the
environment, never by the web interface.
