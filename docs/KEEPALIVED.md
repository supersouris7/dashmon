# Keepalived

Dashmon can show the Keepalived role of each Linux agent host. The supplied
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

Generate a token with `openssl rand -hex 32`, set it as `LINUX_METRICS_TOKEN`, then
keep the file mode at `600`. Do not store the token in a repository.

Start the agent:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now dashmon-keepalived-agent
sudo systemctl status dashmon-keepalived-agent
```

Restrict the firewall so only Dashmon can reach the agent.

## Configure Dashmon

Use the same `LINUX_METRICS_TOKEN` value on both nodes and in Dashmon's
environment, then redeploy Dashmon. With Compose, this is the
`LINUX_METRICS_TOKEN` entry in its `.env` file; `docker-compose.yml` already
forwards it to the container.

In *Edit supervision* > *Hosts*, create one host for each Keepalived node:

1. Enable monitoring and choose **Linux agent**.
2. Set the URL to that node's Keepalived agent endpoint.
3. In **Bearer token**, enter `LINUX_METRICS_TOKEN` exactly, not the token
   value.
4. Save the supervision settings.

Dashmon displays one Keepalived card for each agent that returns this field.
