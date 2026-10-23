# WireGuard in Dashmon

Dashmon can show your WireGuard peers in two independent places:

- **Host supervision** — its own card on the *Supervision* page, detached from
  the host cards, for a monitored host of type **Local** or **Linux agent**. It
  shows a “last check” line dated from the dump file.
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

It must run as **root** (or via `sudo`): `wg` needs `CAP_NET_ADMIN`, and `docker`
must be able to reach the daemon.

**By default the dump goes straight into the container's data directory** — the
place Dashmon actually reads — so nothing is written on the host and no volume
needs a special mount:

```sh
sudo /usr/local/bin/wireguard-dump.sh
# wg show all dump | docker exec -i dashmon sh -c 'cat > /app/data/wireguard.dump'
```

### Parameters

| Argument | Default | Meaning |
| --- | --- | --- |
| 1st | `dashmon` | container name (`$DASHMON_CONTAINER`) |
| 2nd | `/app/data/wireguard.dump` | path **inside** the container (`$DASHMON_DUMP_CONTAINER_PATH`) |

```sh
sudo /usr/local/bin/wireguard-dump.sh dashmon-prod
sudo /usr/local/bin/wireguard-dump.sh dashmon /data/wireguard.dump
```

**Host-file variant (bind mount).** If the first argument looks like a path
(starts with `/` or `.`), the dump is written to that file on the host instead,
atomically, `chmod 600`, owned by UID `1000`. The folder must then be mounted in
the container and `WIREGUARD_DUMP_FILE` pointed at it. `$DASHMON_WIREGUARD_DUMP`
does the same without an argument.

```sh
sudo /usr/local/bin/wireguard-dump.sh /opt/dashmon/wireguard.dump
```

If `wg` is inside a container rather than on the host, run the command in that
container instead — see [Troubleshooting](#troubleshooting).

### Friendly names

By default a peer is shown by its **public key**, which is unreadable. Map well
known keys to names in the **names file**, which lives next to the dump in
Dashmon's data directory inside the container (`/app/data/wireguard-names.conf`).
One line per peer: the public key, copied verbatim from `wg show all`, then the
name (spaces allowed):

```
# /app/data/wireguard-names.conf
AbCdEf...1234 Office NAS
ZzYyXx...9876 Phone
```

A commented example ships as
[`deploy/wireguard-names.conf.example`](../deploy/wireguard-names.conf.example).
In container mode (default), pull it straight into the container — no host file
needed:

```sh
curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/wireguard-names.conf.example \
  | sudo docker exec -i dashmon sh -c 'cat > /app/data/wireguard-names.conf'
sudo docker exec -it dashmon vi /app/data/wireguard-names.conf
```

`$DASHMON_WIREGUARD_NAMES` changes the path. In container mode it is a path
**inside** the container; in host-file mode it is a path on the host.

Blank lines and lines starting with `#` are ignored. A key with no entry keeps
showing as its public key.

### What the script writes

The raw `wg show all dump` contains the interface **private key** and each peer's
**preshared key**. Dashmon needs neither, so the script replaces both with
`(redacted)` before writing, keeping the tab-separated field count intact (5
fields per interface line, 9 per peer line). Only the interface name, peer
(public key or friendly name), endpoint, handshake and traffic counters survive.

## 2. Choose where Dashmon reads it

Dashmon reads the dump from `WIREGUARD_DUMP_FILE`, defaulting to
`DATA_DIR/wireguard.dump` (`/app/data/wireguard.dump` in the image).

With the default container mode above, the file lands exactly there, so **you
have nothing to configure**: the named `dashmon-data` volume already carries it.

**Host-file variant — bind mount a folder:**

```yaml
services:
  dashmon:
    volumes:
      - dashmon-data:/app/data
      - /opt/dashmon:/dump:ro
    environment:
      WIREGUARD_DUMP_FILE: /dump/wireguard.dump
```

Then let the script write to `/opt/dashmon/wireguard.dump` (host-file variant).

To do it by hand for a one-off check, the same pipe works directly:

```sh
sudo wg show all dump | sudo docker exec -i dashmon sh -c 'cat > /app/data/wireguard.dump'
```

## 3. Schedule it with cron

Edit the **root** crontab (`sudo crontab -e`) and pick a frequency. With no
argument the script writes into the container's data directory:

Once per hour:

```cron
0 * * * * /usr/local/bin/wireguard-dump.sh
```

Once per day, at 03:00:

```cron
0 3 * * * /usr/local/bin/wireguard-dump.sh
```

(Add the container name as an argument if it is not `dashmon`, e.g.
`0 * * * * /usr/local/bin/wireguard-dump.sh dashmon-prod`.)

The more often the file is regenerated, the fresher the handshakes and traffic
counters. A daily refresh is enough to see *who is configured*, but peers that
renegotiate during the day keep showing a stale "last handshake"; hourly is a
good balance for a small host. Dashmon itself re-reads the file at its own
supervision interval (see `HOST_METRICS_INTERVAL`), so there is no point
regenerating it more often than that.

> `wg show all dump` prints no peer names: the **public key** is used as the peer
> name. Map keys to readable names with the [names file](#friendly-names). The
> *WireGuard* tab of the supervision editor can hide a section or filter a single
> interface.

## 4. Security

- The script **redacts** the interface private key and each peer's preshared key
  before writing, so the file Dashmon reads holds no secret key material. Still
  keep it out of version control and restrict its permissions (`chmod 600`).
- A file written **by hand** (not via the script) or by a custom tool would keep
  those keys: prefer the script.
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
| `conteneur 'dashmon' introuvable` | wrong container name | Pass your container name as the first argument. |
| No peers in Dashmon | File missing or empty, or written at the wrong path | `docker exec dashmon wc -c /app/data/wireguard.dump`, and check `WIREGUARD_DUMP_FILE` if you override it. |
| Peers look stale | Cron too infrequent | Refresh hourly. |

If WireGuard runs in a **container**, the host has no `wg` interface; run it in
that container and route the output to Dashmon:

```sh
sudo docker exec <wg-container> wg show all dump \
  | sudo docker exec -i dashmon sh -c 'cat > /app/data/wireguard.dump'
```
