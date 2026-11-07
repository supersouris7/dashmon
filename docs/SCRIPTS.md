# Updating the host scripts

Some Supervision cards are fed by small scripts installed on each machine
(the primary and every agent) and run by cron. Updating the Dashmon container
does **not** update them: they are copies on the host.

| Script | Card | Guide |
| --- | --- | --- |
| `dashmon-apt-updates.sh` | Updates | [APT_UPDATES.md](APT_UPDATES.md) |
| `dashmon-smart-dump.sh` | Disks | [SMART.md](SMART.md) |
| `dashmon-wireguard-dump.sh` | VPN | [WIREGUARD.md](WIREGUARD.md) |
| `dashmon-opencode-stats.sh` | OpenCode | [OPENCODE.md](OPENCODE.md) |
| `dashmon-claude-stats.sh` | Claude Code | [CLAUDE_CODE.md](CLAUDE_CODE.md) |
| `dashmon-directory-sizes.sh` | Directories | [DIRECTORIES.md](DIRECTORIES.md) |

All of them live in `/usr/local/bin`.

## When to update

Each script carries a version number and writes it into its report. When the
report on a card comes from an older script than the one this Dashmon ships,
the card ends with a yellow notice, **Script to update on this host**, and the
command to run. Nothing else changes: the card keeps working with the old
script until you update it.

## How to update

The same command for every script: it downloads the current version over the
installed one. Replace `NAME` with the name from the table, without `dashmon-`
and `.sh` (for example `apt-updates`), and run it on the machine shown by the
card:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/NAME.sh -o /usr/local/bin/dashmon-NAME.sh
sudo chmod 755 /usr/local/bin/dashmon-NAME.sh
```

The card's notice already contains this command with the right name, ready to
copy. The cron line does not change. The notice disappears after the next run
of the script, once Dashmon has read its new report.

Updates are never automatic on purpose: several scripts run as root, and a
script that downloaded and ran a new version of itself would run code you have
not seen. Read the script on GitHub before updating if you want to know what
changed.

## Moving from the former locations

Before the version numbers, the guides installed the scripts under other
names: `/usr/local/sbin/apt-updates.sh`, `/usr/local/sbin/smart-dump.sh`,
`/usr/local/bin/wireguard-dump.sh`, `/usr/local/bin/opencode-stats.sh`,
`/usr/local/bin/claude-stats.sh`. For each one installed on a machine:

1. Install the new copy with the command above.
2. Point the cron line to the new path: `sudo crontab -e` for the root scripts
   (APT, SMART, WireGuard, directories), `crontab -e` for your own user
   (OpenCode, Claude Code). Keep the variables and arguments of the line as
   they are; only the path changes.
3. Remove the former copy, for example
   `sudo rm /usr/local/sbin/apt-updates.sh`.

`crontab -l` and `sudo crontab -l` list the lines to change.

## For contributors

Raise `SCRIPT_VERSION` in a script whenever you change it: that number is what
makes the cards ask for the update. The image ships the scripts (`deploy/*.sh`)
and reads the expected versions from them.
