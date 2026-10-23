# WireGuard in Dashmon

Dashmon can show your WireGuard peers in two independent places:

- **Host supervision** — inside a monitored host card (type **Local** or **Linux
  agent**), on the *Supervision* page.
- **Tile widget** — a standalone tile, assigned like any other widget in the
  service editor (**Edit Dashmon** → service → **Widget** → **WireGuard**), with
  no host involved.

Both read the same thing: a dump of `wg show all dump`, either from a file on the
Dashmon host (local dump) or reported by an agent.

This guide covers the **local dump**: the script, its installation, and the cron
schedule.

---

## 1. Install the script

The script `wireguard-dump.sh` lives in the repository:
[`deploy/wireguard-dump.sh`](../deploy/wireguard-dump.sh).

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/wireguard-dump.sh \
  -o /usr/local/bin/wireguard-dump.sh
sudo chmod +x /usr/local/bin/wireguard-dump.sh
```

It must run as **root** (or via `sudo`): `wg` needs `CAP_NET_ADMIN`. It writes
`wg show all dump` atomically, sets restrictive permissions (the dump contains
the interface private key), and, when run as root, hands the file to UID `1000`
(the Dashmon container user) so a bind-mounted file stays readable.

Default output: `/opt/dashmon/wireguard.dump`. Override it with an argument or the
`DASHMON_WIREGUARD_DUMP` variable:

```sh
sudo /usr/local/bin/wireguard-dump.sh /path/to/wireguard.dump
```

If `wg` is inside a container rather than on the host, run the command in that
container instead — see [Troubleshooting](#troubleshooting).

## 2. Choose where Dashmon reads it

Dashmon reads the dump from `WIREGUARD_DUMP_FILE`, defaulting to
`DATA_DIR/wireguard.dump` (`/app/data/wireguard.dump` in the image).

**Recommended — bind mount a host folder:**

```yaml
services:
  dashmon:
    volumes:
      - dashmon-data:/app/data
      - /opt/dashmon:/dump:ro
    environment:
      WIREGUARD_DUMP_FILE: /dump/wireguard.dump
```

Then let the script write to `/opt/dashmon/wireguard.dump` (its default).

**Alternative — keep the named volume** and copy the file into the running
container from cron:

```sh
sudo /usr/local/bin/wireguard-dump.sh /tmp/wireguard.dump
sudo docker cp /tmp/wireguard.dump dashmon:/app/data/wireguard.dump
```

Or pipe it straight in, without a host temp file:

```sh
sudo wg show all dump | sudo docker exec -i dashmon sh -c 'cat > /app/data/wireguard.dump'
```

## 3. Schedule it with cron

Edit the **root** crontab (`sudo crontab -e`) and pick a frequency.

Once per hour:

```cron
0 * * * * /usr/local/bin/wireguard-dump.sh
```

Once per day, at 03:00:

```cron
0 3 * * * /usr/local/bin/wireguard-dump.sh
```

The more often the file is regenerated, the fresher the handshakes and traffic
counters. A daily refresh is enough to see *who is configured*, but peers that
renegotiate during the day keep showing a stale "last handshake"; hourly is a
good balance for a small host. Dashmon itself re-reads the file at its own
supervision interval (see `HOST_METRICS_INTERVAL`), so there is no point
regenerating it more often than that.

> `wg show all dump` prints no peer names: the **public key** is used as the peer
> name. The *WireGuard* tab of the supervision editor can hide a section or
> filter a single interface.

## 4. Security

- The dump contains the **interface private key**. Keep it out of version
  control, restrict its permissions (`chmod 600`), and never paste it in an
  issue.
- Dashmon only reads the fields it needs and never serves the file over HTTP.
- The file path is fixed by the environment (`WIREGUARD_DUMP_FILE`), never taken
  from the web configuration: a saved config cannot make the server read an
  arbitrary file.
- No `NET_ADMIN` capability and no host network mode are required on the Dashmon
  side: it only reads the file.

## 5. Agent alternative

Instead of a file, a type **Linux agent** host may report peers in its JSON
`wireguard` field. See
[deploy/DEPLOYMENT.md §8](../deploy/DEPLOYMENT.md#8-host-supervision).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unable to access interface wg0: Operation not permitted` | `wg` run without privileges | Run the script with `sudo` (root crontab). |
| `permission denied ... docker.sock` | cron/user not allowed to use Docker | Use the root crontab, or add the user to the `docker` group. |
| Empty file (0 B) | Shell redirection failed, or two commands ran on one line | Run one command per line, or use the script. |
| No peers in Dashmon | File missing, unreadable by UID `1000`, or refreshed at the wrong path | Check `WIREGUARD_DUMP_FILE`, then `docker exec dashmon wc -c /app/data/wireguard.dump`. |
| Peers look stale | Cron too infrequent | Refresh hourly. |

If WireGuard runs in a **container**, the host has no `wg` interface; run it in
that container and route the output to Dashmon:

```sh
sudo docker exec <wg-container> wg show all dump \
  | sudo docker exec -i dashmon sh -c 'cat > /app/data/wireguard.dump'
```
