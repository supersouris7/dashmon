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

Install the script on the host where OpenCode runs:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/opencode-stats.sh -o /usr/local/bin/opencode-stats.sh
sudo chmod 755 /usr/local/bin/opencode-stats.sh
```

Run it **as your own user**, not with `sudo`: the statistics live in your home
directory. Writing into the container requires that this user may use Docker
(member of the `docker` group). A first run on the primary:

```sh
/usr/local/bin/opencode-stats.sh
```

For an agent installed with the [startup guide](DEMARRAGE.md) stack:

```sh
DASHMON_CONTAINER=dashmon-agent /usr/local/bin/opencode-stats.sh
```

The script writes to `/app/data/opencode.json` in the `dashmon` container by
default. If the container has another name, pass `DASHMON_CONTAINER=...`. For a
different path **inside** the container, use `DASHMON_OPENCODE_CONTAINER_PATH`;
Dashmon must then receive the same path through `OPENCODE_REPORT_FILE`.

The script looks for `opencode` in the `PATH`, then in `~/.opencode/bin`. If it
is installed elsewhere, set `OPENCODE_BIN=/path/to/opencode`.

## Schedule

Add this line to **your** crontab with `crontab -e` (not the root crontab):

```cron
*/15 * * * * /usr/local/bin/opencode-stats.sh >/dev/null 2>&1
```

For an **agent**:

```cron
*/15 * * * * DASHMON_CONTAINER=dashmon-agent /usr/local/bin/opencode-stats.sh >/dev/null 2>&1
```

The card flags a report older than 6 hours: the job has probably stopped.

## Enable or hide the card

The card shows up by itself with the first report. To hide it, open
**Settings → Agents → Hosts**, choose the host, then uncheck **Show OpenCode
statistics** in the **OpenCode** section.

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
*/15 * * * * DASHMON_OPENCODE_REPORT=/srv/dashmon-reports/opencode.json /usr/local/bin/opencode-stats.sh >/dev/null 2>&1
```

The folder must be writable by your user. The read path stays fixed by the
environment, never by the web interface.
