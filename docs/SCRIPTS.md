# Host scripts

Some Supervision cards are fed by small scripts installed on each machine (the
primary and every agent) and run by cron. Updating the Dashmon container does
**not** update them: they are copies on the host.

| Script | Card | Runs as | Guide |
| --- | --- | --- | --- |
| `dashmon-apt-updates.sh` | Updates | root | [APT_UPDATES.md](APT_UPDATES.md) |
| `dashmon-smart-dump.sh` | Disks | root | [SMART.md](SMART.md) |
| `dashmon-wireguard-dump.sh` | VPN | root | [WIREGUARD.md](WIREGUARD.md) |
| `dashmon-opencode-stats.sh` | OpenCode | your user | [OPENCODE.md](OPENCODE.md) |
| `dashmon-claude-stats.sh` | Claude Code | your user | [CLAUDE_CODE.md](CLAUDE_CODE.md) |
| `dashmon-directory-sizes.sh` | Directories | root | [DIRECTORIES.md](DIRECTORIES.md) |

All of them live in `/usr/local/bin`. The same commands work on the primary
and on an agent.

The app gives the same help: **Settings → Supervision → your host**, section
**Host scripts**, and the **Installation and help** block of each section, with
the commands ready to copy.

## Quick start: dashmon-setup

`dashmon-setup.sh` installs, updates and removes the other scripts, and writes
their cron line for you. Install it once per machine:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/setup.sh -o /usr/local/bin/dashmon-setup.sh
sudo chmod 755 /usr/local/bin/dashmon-setup.sh
```

Then start the menu and answer the questions:

```sh
sudo dashmon-setup.sh
```

The menu numbers the six scripts and shows, for each one, its version, when it
runs and in whose crontab:

```text
  1) APT updates       v1, every Wednesday at 03:00, automatic reboot (cron of root)
  2) SMART             v1, every 15 minutes (cron of root)
  3) WireGuard         not installed
  ...
```

Type a number: the menu says what that script does and asks before
installing it. For an installed script it offers to change its frequency or
remove it. `u` updates them all, `q` quits. After each action, Enter brings
the menu back. For each installation it asks:

- **how often** it runs, among three schedules (Enter keeps the recommended
  one, see [Schedules](#schedules));
- **which container** when the machine runs several Dashmon containers
  (otherwise the one running is used: `dashmon` on the primary,
  `dashmon-agent` on an agent installed with the startup guide);
- for APT, whether the host may **reboot** after an update that requires it
  (no by default);
- for OpenCode and Claude Code, whether to install it anyway when the user
  does not seem to use the tool on this machine;
- whether to **run it once now**, so the card appears without waiting (never
  for APT, which really installs the updates).

The same actions without the menu, for a script or a copy-paste:

```sh
sudo dashmon-setup.sh list                          # what is installed, with the cron lines
sudo dashmon-setup.sh install smart-dump            # script + cron line, recommended schedule
sudo dashmon-setup.sh install smart-dump --frequency 3 --run
sudo dashmon-setup.sh install opencode-stats        # into the crontab of the user who ran sudo
sudo dashmon-setup.sh remove smart-dump             # cron line + script
sudo dashmon-setup.sh update                        # every installed script
```

| Option | Meaning |
| --- | --- |
| `--frequency 1\|2\|3` | One of the three schedules of the script, in the order of the table below. |
| `--container NAME` | Dashmon container to write to, when it cannot be found by itself. |
| `--user NAME` | OpenCode and Claude Code: whose crontab and statistics. Default: the user who ran `sudo`. |
| `--reboot` | APT: allow the reboot after an update that requires it. |
| `--run` | Run the script once right after installing it. |
| `--yes` | Ask nothing; replace a cron line written by hand. |
| `--lang fr\|en` | Language of the messages. |

Several names can follow `install` or `remove`:
`sudo dashmon-setup.sh install smart-dump wireguard-dump`.

Messages are in French when the `LANG` of the session is French; a Raspberry
Pi is often in `en_GB`: add `--lang fr` (`sudo dashmon-setup.sh --lang fr`).

## Update everything at once

When a card ends with the yellow notice **Script to update on this host**, one
command updates **every** Dashmon script installed on that machine, the setup
tool included. It installs nothing new and does not touch the cron lines:

```sh
for n in setup apt-updates smart-dump wireguard-dump opencode-stats claude-stats directory-sizes; do f=/usr/local/bin/dashmon-$n.sh; [ -f "$f" ] || continue; sudo curl -fsSL "https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/$n.sh" -o "$f.new" && sudo chmod 755 "$f.new" && sudo mv "$f.new" "$f" && echo "OK $n"; done
```

The notice of the card contains this command, ready to copy. Each script is
downloaded next to the old one, then renamed over it: a run in progress keeps
its old file, and a cut download changes nothing. The notice disappears after
the next run of the script, once Dashmon has read its new report.

`sudo dashmon-setup.sh update` does the same once the setup tool is installed.

Updates are never automatic on purpose: several scripts run as root, and a
script that downloaded and ran a new version of itself would run code you have
not seen. Read the scripts on GitHub before updating if you want to know what
changed. Dashmon itself never writes on the host: no button in the app can
change a script.

## Schedules

Each script offers three schedules; the setup tool proposes them and keeps the
recommended one (**bold**) by default. They are chosen from what the card
shows and from what a run costs:

| Script | 1 | 2 | 3 | Why |
| --- | --- | --- | --- | --- |
| APT | `0 3 * * *` every day at 03:00 | **`0 3 * * 3` every Wednesday at 03:00** | `0 3 1 * *` the 1st of the month at 03:00 | It really installs the updates: weekly, at night, keeps the host current without upgrading it every day. |
| SMART | `*/5 * * * *` every 5 minutes | **`*/15 * * * *` every 15 minutes** | `0 * * * *` every hour | Temperature and wear move slowly; reading the disks more often only wakes them. |
| WireGuard | **`* * * * *` every minute** | `*/5 * * * *` every 5 minutes | `*/15 * * * *` every 15 minutes | A peer shows online while its last handshake is under 3 minutes old: only a dump every minute keeps that state right. 5 or 15 minutes are enough to see who connected. The dump costs nothing. |
| OpenCode | `*/5 * * * *` every 5 minutes | **`*/15 * * * *` every 15 minutes** | `0 * * * *` every hour | Today's tokens stay current; the card flags a report older than 6 hours. |
| Claude Code | `*/5 * * * *` every 5 minutes | **`*/15 * * * *` every 15 minutes** | `0 * * * *` every hour | Same as OpenCode. |
| Directories | `0 * * * *` every hour | `0 */6 * * *` every 6 hours | **`30 3 * * *` every night at 03:30** | `du` reads every file entry: once a night, after APT. The card flags a report older than 2 days. |

For APT the tool also sets `DASHMON_APT_INTERVAL_HOURS` (24, 168 or 720) so
the card announces the right next run.

## Cron in short

A cron line is five time fields, then the command:

```text
*/15  *  *  *  *   command
 │    │  │  │  └── day of the week (0-7, 0 and 7 = Sunday, 3 = Wednesday)
 │    │  │  └───── month (1-12)
 │    │  └──────── day of the month (1-31)
 │    └─────────── hour (0-23)
 └──────────────── minute (0-59); */15 = every 15 minutes
```

The times are those of the host. Each user has a crontab:

- `sudo crontab -l` lists the **root** crontab (APT, SMART, WireGuard,
  directories), `sudo crontab -e` edits it;
- `crontab -l` lists **your** crontab (OpenCode, Claude Code), `crontab -e`
  edits it.

A line written by the setup tool looks like this:

```cron
*/15 * * * * DASHMON_CONTAINER=dashmon /usr/local/bin/dashmon-smart-dump.sh >/dev/null 2>&1 # dashmon:smart-dump
```

- `DASHMON_CONTAINER=...` names the container the report is written to;
- `>/dev/null 2>&1` drops the output, so cron sends no mail at each run;
- `# dashmon:smart-dump` is how the tool finds its line again. Keep it if you
  edit the line by hand; the tool replaces only that line and never touches
  the others.

To see why a job does not run, run its command by hand, without
`>/dev/null 2>&1`: the script prints the cause (container not found, missing
tool...). `grep CRON /var/log/syslog` or `journalctl -u cron` shows whether
cron started it.

Create **one line per script** on each machine: two lines for the same script
would run it twice.

## Without the setup tool

Every guide gives the manual installation. The same two commands work for
every script: replace `NAME` with the name from the table, without `dashmon-`
and `.sh` (for example `apt-updates`):

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/NAME.sh -o /usr/local/bin/dashmon-NAME.sh
sudo chmod 755 /usr/local/bin/dashmon-NAME.sh
```

Then add the cron line given by the guide. To remove a script, delete its cron
line, then the file: `sudo rm /usr/local/bin/dashmon-NAME.sh`.

## Moving from the former locations

Before the version numbers, the guides installed the scripts under other
names: `/usr/local/sbin/apt-updates.sh`, `/usr/local/sbin/smart-dump.sh`,
`/usr/local/bin/wireguard-dump.sh`, `/usr/local/bin/opencode-stats.sh`,
`/usr/local/bin/claude-stats.sh`.

With the setup tool, install the script again: `sudo dashmon-setup.sh install
apt-updates`. It shows the former cron line and asks before replacing it; once
replaced, it deletes the former copy. A line with special variables (bind
mount variant, `DASHMON_APT_REBOOT`...) is shown first: answer no to keep it,
then change only its path by hand.

By hand, for each script installed on a machine:

1. Install the new copy with the commands above.
2. Point the cron line to the new path: `sudo crontab -e` for the root scripts
   (APT, SMART, WireGuard, directories), `crontab -e` for your own user
   (OpenCode, Claude Code). Keep the variables and arguments of the line as
   they are; only the path changes.
3. Remove the former copy, for example
   `sudo rm /usr/local/sbin/apt-updates.sh`.

## For contributors

Raise `SCRIPT_VERSION` in a script whenever you change it: that number is what
makes the cards ask for the update. The image ships the scripts (`deploy/*.sh`)
and reads the expected versions from them. The schedules exist twice, in
`deploy/setup.sh` and `public/js/supervision/script-commands.js`;
`test/setup-script.test.js` checks that they match.
