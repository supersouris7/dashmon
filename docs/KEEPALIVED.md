# Keepalived

Dashmon can show the Keepalived role from two global agent endpoints. The supplied
agent reports `MASTER` when its configured virtual IP is present locally and
`BACKUP` otherwise. The virtual IP itself is never sent to Dashmon.

## Install on each node

Run these commands on each Keepalived node:

```sh
sudo install -d -m 755 /usr/local/lib/dashmon
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/keepalived-agent.py -o /usr/local/lib/dashmon/keepalived-agent.py
sudo chmod 755 /usr/local/lib/dashmon/keepalived-agent.py
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/keepalived-agent.service -o /etc/systemd/system/dashmon-keepalived-agent.service
sudo install -m 600 /dev/null /etc/dashmon-keepalived-agent.env
```

Set the real virtual IP, LAN bind address and a free port in
`/etc/dashmon-keepalived-agent.env`:

```dotenv
KEEPALIVED_VIP=192.0.2.10
KEEPALIVED_BIND=192.0.2.20
KEEPALIVED_PORT=PORT_NUMBER
LINUX_METRICS_TOKEN=
```

Generate one token with `openssl rand -hex 32`, set the same `LINUX_METRICS_TOKEN`
value on both nodes, then keep each file mode at `600`. Do not store the token in a
repository.

Start the agent:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now dashmon-keepalived-agent
sudo systemctl status dashmon-keepalived-agent
```

Restrict the firewall so only Dashmon can reach the agent.

## Configure Dashmon

Use the same `LINUX_METRICS_TOKEN` value on both Keepalived nodes. Dashmon does
not need this variable in its environment.

In *Edit supervision* > *Keepalived*:

1. Set the URL of each Keepalived agent endpoint.
2. Enter the shared token in **Shared Bearer token**.
3. Save the supervision settings.

Dashmon polls both agents independently of host metrics and displays one role card
per configured endpoint.
