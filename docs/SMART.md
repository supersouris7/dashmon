# SMART supervision

Dashmon can display the SMART status, temperature and wear counters of the
Docker host disks. This supervision is local: the script runs on the machine
that hosts the Dashmon container.

## Installation

Install `smartmontools`, then fetch the script:

```sh
sudo apt install smartmontools
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/smart-dump.sh -o /usr/local/sbin/smart-dump.sh
sudo chmod 755 /usr/local/sbin/smart-dump.sh
```

The script detects the disks reachable with `smartctl --scan-open`, runs
`smartctl -j -q noserial -a` for each of them, then writes the result to
`/app/data/smart.json` in the `dashmon` container:

```sh
sudo /usr/local/sbin/smart-dump.sh
```

For an agent installed with the [startup guide](DEMARRAGE.md) stack:

```sh
sudo /usr/local/sbin/smart-dump.sh dashmon-agent
```

The container name and the path can be given as arguments:

```sh
sudo /usr/local/sbin/smart-dump.sh dashmon /app/data/smart.json
```

To limit the disks read, set `DASHMON_SMART_DEVICES`:

```sh
sudo DASHMON_SMART_DEVICES="/dev/sda /dev/sdb" /usr/local/sbin/smart-dump.sh
```

USB enclosures do not all expose SMART. If `smartctl` needs a device-type
option, adapt a local copy of the script.

## Scheduling

One dump every fifteen minutes is enough. Add this line with `sudo crontab -e`:

```cron
*/15 * * * * /usr/local/sbin/smart-dump.sh >/dev/null 2>&1
```

For an agent, replace that line with:

```cron
*/15 * * * * /usr/local/sbin/smart-dump.sh dashmon-agent >/dev/null 2>&1
```

If your container has another name, find it with `docker ps` and replace
`dashmon-agent`. In the agent local page, enable **SMART** and leave the disk
list empty to show them all.

## Dashmon configuration

The local host is always monitored. In **Edit supervision**, open the
**SMART** tab. The disk list is optional: empty, it shows every disk in the
dump; enter for example `/dev/sda, /dev/sdb` to filter. Click **Save**, then
**Apply**.

The server reads `/app/data/smart.json` by default. For a bind mount, mount for
example `/srv/dashmon-reports` on `/reports:ro`, use
`SMART_DUMP_FILE=/reports/smart.json` for Dashmon and
`DASHMON_SMART_DUMP=/srv/dashmon-reports/smart.json` for the script.

## Security

The script uses `-q noserial`: disk serial numbers are not placed in the dump.
The file is written atomically so Dashmon never reads an incomplete dump.
