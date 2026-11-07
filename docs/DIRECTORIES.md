# Directory sizes

The **Directories** card in Supervision lists all directories selected on a
machine, with their occupied disk space and the report date. The same setup
works for the local Dashmon host and remote Dashmon agents. Older agents simply
do not provide this card.

## Installation and selection

On each machine to monitor, install Python 3 and GNU coreutils (`du`). Download
`deploy/directory-sizes.py` from this repository and place it at
`/usr/local/bin/dashmon-directory-sizes.py`.

Select directories by passing their absolute paths to the script. Quote paths
containing spaces. For the local Dashmon container:

```sh
python3 /usr/local/bin/dashmon-directory-sizes.py /srv/media /srv/backups
```

For an agent:

```sh
python3 /usr/local/bin/dashmon-directory-sizes.py --container dashmon-agent /srv/media /srv/backups
```

The script reads directories **on the host**, not inside Docker. No media mount
or privileged container is needed. Run it with an account that can read the
selected directories and publish to Docker. Docker access grants administrative
privileges; do not give it to an untrusted account.

To change the selection, change the paths in the command and run it again.
The card appears automatically after the next metrics refresh, on the selected
machine's Supervision page. Up to 50 directories are supported.

## Scheduling

Schedule the same command with cron, for example once per hour:

```cron
0 * * * * python3 /usr/local/bin/dashmon-directory-sizes.py --container dashmon-agent /srv/media /srv/backups
```

Large directories can take time to scan. Each scan is limited to five minutes
per directory; a timeout, inaccessible directory or partial read is displayed
as **Measurement failed**, never as zero. Avoid scheduling overlapping runs.
The report date remains visible if the scheduled job stops running.

## Without Docker

Use `--output /srv/dashmon-reports/directory-sizes.json` and configure
`DIRECTORY_REPORT_FILE` to that file in Dashmon or the agent. The destination
directory must already exist. For containers using a read-only report mount,
write to the host side of that mount instead.

Reports are written atomically. Only paths and sizes are transmitted, not file
names or contents. Directory paths are visible to authenticated dashboard users.
Sizes are allocated disk usage, not apparent file length; symbolic links inside
a directory are not followed. Nested selections overlap and must not be summed.
