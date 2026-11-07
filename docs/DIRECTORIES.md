# Directory sizes

The **Directories** card in Supervision lists all directories selected on a
machine, with their occupied disk space and the report date. The same setup
works for the local Dashmon host and remote Dashmon agents. Older agents simply
do not provide this card.

## Installation and selection

On each machine to monitor, use a POSIX shell, `awk` and GNU coreutils (`du`, `timeout`, `mktemp`) — no Python or extra runtime is needed. Download
`deploy/directory-sizes.sh` from this repository:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/directory-sizes.sh -o /usr/local/bin/dashmon-directory-sizes.sh
sudo chmod 755 /usr/local/bin/dashmon-directory-sizes.sh
```

In **Settings → Supervision → Local** or **your agent**, open **Directories**.
Keep **Show directory sizes** checked. Add each directory with its **display
name** and **absolute path**, then **Save**. The same form configures local
and remote agents. The installation guide is linked there.

The script reads the saved selection from the chosen container at each run.
Only the Node runtime already included in the container is used to read JSON:
neither Node nor Python needs to be installed on the host.

For the local Dashmon container:

```sh
sh /usr/local/bin/dashmon-directory-sizes.sh
```

For an agent:

```sh
sh /usr/local/bin/dashmon-directory-sizes.sh --container dashmon-agent
```

The script reads directories **on the host**, not inside Docker. No media mount
or privileged container is needed. Run it with an account that can read the
selected directories and publish to Docker. Docker access grants administrative
privileges; do not give it to an untrusted account.

To change the selection, edit the machine's settings in Dashmon and save.
The next script execution uses the new list without editing cron.
Use the up/down arrow buttons beside each entry to change its position, then
save. The card follows this order without waiting for the next scan.
Each row shows only the display name, size and a horizontal bar. Long names
are truncated instead of overflowing; hover over a name to read its path.
The bar shows allocated size divided by total filesystem capacity; percentage
and capacity are available on hover and to screen readers. The report date is
available by hovering over the card title.
Missing capacity is shown as an unknown bar, never as zero occupancy.
The card appears automatically after the next metrics refresh, on the selected
machine's Supervision page. Up to 50 directories are supported.

## Scheduling

Schedule the same command with cron, for example once per hour:

```cron
0 * * * * sh /usr/local/bin/dashmon-directory-sizes.sh --container dashmon-agent
```

Large directories can take time to scan. Each scan is limited to five minutes
per directory; a timeout, inaccessible directory or partial read is displayed
as **Measurement failed**, never as zero. Avoid scheduling overlapping runs.
The report date remains visible if the scheduled job stops running.

## Without Docker

For an installation without Docker, explicit paths remain supported:
`sh directory-sizes.sh --output /srv/dashmon-reports/directory-sizes.json /srv/media`.
Configure
`DIRECTORY_REPORT_FILE` to that file in Dashmon or the agent. The destination
directory must already exist. For containers using a read-only report mount,
write to the host side of that mount instead.

## Permissions

Administrators who can edit supervision settings can choose any directory
readable by the script account on that machine. Run the collector with the
least filesystem privileges needed. It reads sizes only, never file contents.

Reports are written atomically. Only paths and sizes are transmitted, not file
names or contents. Directory paths are visible to authenticated dashboard users.
Sizes are allocated disk usage, not apparent file length; symbolic links inside
a directory are not followed. Nested selections overlap and must not be summed.
