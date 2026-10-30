# APT updates

The **APT updates** card on the Supervision page shows the last update report
for a Debian or Ubuntu host. Dashmon never runs `apt` itself: a local cron job
runs the script, which writes an atomic JSON report into the container data,
next to the WireGuard and SMART dumps.

The script uses `apt-get -y upgrade`: it installs the updates that require no
removal and no new dependency, then reports when a reboot is required. It does
not install any cron job automatically.

## Installation

Install the files on the host that runs Docker:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/apt-updates.sh -o /usr/local/sbin/apt-updates.sh
sudo chmod 755 /usr/local/sbin/apt-updates.sh
```

**Warning: this command really installs the updates on the host.** It does not
ask for a reboot unless `DASHMON_APT_REBOOT=1` is set. To run a first pass on
the primary:

```sh
sudo /usr/local/sbin/apt-updates.sh
```

For an agent installed with the [startup guide](DEMARRAGE.md) stack:

```sh
sudo env DASHMON_CONTAINER=dashmon-agent /usr/local/sbin/apt-updates.sh
```

The script writes to `/app/data/apt-updates.json` in the `dashmon` container by
default, next to `wireguard.dump` and `smart.json`. If its name differs, pass
`DASHMON_CONTAINER=...` before the command.

For a different path **inside** the container, use
`DASHMON_APT_REPORT_CONTAINER_PATH`. Dashmon must then receive the same path
through `APT_UPDATES_REPORT_FILE`.

## Schedule and reboot

Add this line to the root crontab with `sudo crontab -e`:

```cron
0 3 * * 3 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

For an **agent**, use this line instead:

```cron
0 3 * * 3 DASHMON_CONTAINER=dashmon-agent /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

If your container has another name, find it with `docker ps` and adapt the
command. Create only one APT job per host.

Automatic reboot is **disabled**. To allow it only after a successful update
that requires it, prefix the cron command:

```cron
0 3 * * 3 DASHMON_APT_REBOOT=1 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

To allow the reboot on an agent host:

```cron
0 3 * * 3 DASHMON_CONTAINER=dashmon-agent DASHMON_APT_REBOOT=1 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

Use only one of the proposed APT lines, not several.

The default interval is **7 days**, which matches the weekly job above. If you
schedule another rhythm, tell the script so the card shows a correct next run:

```cron
0 3 * * * DASHMON_APT_INTERVAL_HOURS=24 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

The value is a number of hours. The next run is computed from the end of the
current run: it is an estimate, not a read of the crontab.

The report is written before the reboot request, with the state
`reboot requested`.

## Dashmon supervision

The local host is always monitored. In **Edit supervision**, open the
**APT updates** tab. The card shows an explicit status, **Up to date** or
**Not up to date**, with the same health icon as the host card, then the number
of installed updates. The chevron expands the last run, the next planned run and
a warning when a reboot is required.

On failure, open **Failure detail** on the card: the report gives the step
(`update` or `upgrade`), the exit code and a bounded excerpt of the APT output.
Repository URLs are masked in that excerpt, but it may contain other system
information: limit access to Dashmon. Older reports contain no detail. Install
the up-to-date script on every host; the Dashmon image alone does not upgrade
that script. For a report already failing, read the host APT logs, for example
`sudo tail -n 100 /var/log/apt/term.log` if it exists, without running an update
again.

## Bind mount variant

If the script cannot reach Docker, mount a host folder into the container. The
two paths are distinct: the script uses the host path, Dashmon the container
path.

```yaml
services:
  dashmon:
    volumes:
      - /srv/dashmon-reports:/reports:ro
    environment:
      APT_UPDATES_REPORT_FILE: /reports/apt-updates.json
```

The cron line then becomes:

```cron
0 3 * * 3 DASHMON_APT_REPORT_FILE=/srv/dashmon-reports/apt-updates.json /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

The read path stays fixed by the environment, never by the web interface.
