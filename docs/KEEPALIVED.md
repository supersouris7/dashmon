# Keepalived

Dashmon can show the Keepalived role of each Linux agent host. The supplied
agent reports `MASTER` when its configured virtual IP is present locally and
`BACKUP` otherwise. The virtual IP itself is never sent to Dashmon.

## Install on each node

Install `deploy/keepalived-agent.py` as `/usr/local/lib/dashmon/keepalived-agent.py`
and make it executable. Create `/etc/default/dashmon-keepalived-agent` with the
real virtual IP, the LAN bind address and a free port:

```dotenv
KEEPALIVED_VIP=192.0.2.10
KEEPALIVED_BIND=192.0.2.20
KEEPALIVED_PORT=PORT_NUMBER
```

Provide `KEEPALIVED_TOKEN` through a protected systemd environment file or
systemd credentials. Do not store its value in a repository.

Create `/etc/systemd/system/dashmon-keepalived-agent.service`:

```ini
[Unit]
Description=Dashmon Keepalived agent
After=network-online.target keepalived.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/default/dashmon-keepalived-agent
ExecStart=/usr/local/lib/dashmon/keepalived-agent.py
DynamicUser=yes
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable it with `systemctl daemon-reload` then `systemctl enable --now dashmon-keepalived-agent`.
Restrict the firewall so only Dashmon can reach the agent.

## Configure Dashmon

1. In *Edit supervision*, configure each Keepalived node as a **Linux agent**.
2. Set its URL to the agent endpoint.
3. Set the token field to the matching token value, or to the name of an
   allowlisted Dashmon environment variable.

Dashmon displays one Keepalived card for each agent that returns this field.
