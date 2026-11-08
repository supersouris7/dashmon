# SMART supervision

Dashmon can display the SMART status, temperature and wear counters of the
Docker host disks. This supervision is local: the script runs on the machine
that hosts the Dashmon container.

## Installation

**Quickest:** with the [setup tool](SCRIPTS.md#quick-start-dashmon-setup), one
command installs the script and its cron line, asks the schedule and finds the
container:

```sh
sudo dashmon-setup.sh install smart-dump
```

The rest of this section and the schedule below do the same by hand.

Install `smartmontools`, then fetch the script:

```sh
sudo apt install smartmontools
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/smart-dump.sh -o /usr/local/bin/dashmon-smart-dump.sh
sudo chmod 755 /usr/local/bin/dashmon-smart-dump.sh
```

To update it later, one command updates every script of the machine: see
[Update everything at once](SCRIPTS.md#update-everything-at-once).

The script detects the disks reachable with `smartctl --scan-open`, runs
`smartctl -j -q noserial -a` for each of them, then writes the result to
`/app/data/smart.json` in the `dashmon` container:

```sh
sudo /usr/local/bin/dashmon-smart-dump.sh
```

For an agent installed with the [startup guide](GETTING_STARTED.md) stack:

```sh
sudo /usr/local/bin/dashmon-smart-dump.sh dashmon-agent
```

The container name and the path can be given as arguments:

```sh
sudo /usr/local/bin/dashmon-smart-dump.sh dashmon /app/data/smart.json
```

To limit the disks read, set `DASHMON_SMART_DEVICES`:

```sh
sudo DASHMON_SMART_DEVICES="/dev/sda /dev/sdb" /usr/local/bin/dashmon-smart-dump.sh
```

USB enclosures do not all expose SMART. If `smartctl` needs a device-type
option, adapt a local copy of the script.

## Scheduling

Add **one** of these lines to the root crontab with `sudo crontab -e`
([cron in short](SCRIPTS.md#cron-in-short)):

| Schedule | Cron line |
| --- | --- |
| Every 5 minutes | `*/5 * * * * /usr/local/bin/dashmon-smart-dump.sh >/dev/null 2>&1` |
| **Every 15 minutes (recommended)** | `*/15 * * * * /usr/local/bin/dashmon-smart-dump.sh >/dev/null 2>&1` |
| Every hour | `0 * * * * /usr/local/bin/dashmon-smart-dump.sh >/dev/null 2>&1` |

Temperature and wear move slowly: every 15 minutes is enough, and reading the
disks more often only keeps them awake. Every hour suits disks that should
sleep.

For an agent, replace that line with:

```cron
*/15 * * * * /usr/local/bin/dashmon-smart-dump.sh dashmon-agent >/dev/null 2>&1
```

If your container has another name, find it with `docker ps` and replace
`dashmon-agent`. In **Settings → Supervision → your agent**,
enable **SMART** and leave the disk
list empty to show them all.

## Dashmon configuration

The local host is always monitored. Open **Settings → Supervision → Local**, then **SMART**.
The disk list is optional: empty, it shows every disk in the dump; enter for
example `/dev/sda, /dev/sdb` to filter. Click **Save**.

The server reads `/app/data/smart.json` by default. For a bind mount, mount for
example `/srv/dashmon-reports` on `/reports:ro`, use
`SMART_DUMP_FILE=/reports/smart.json` for Dashmon and
`DASHMON_SMART_DUMP=/srv/dashmon-reports/smart.json` for the script.

## Security

The script uses `-q noserial`: disk serial numbers are not placed in the dump.
The file is written atomically so Dashmon never reads an incomplete dump.
