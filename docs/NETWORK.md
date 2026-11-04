# Network throughput

The **Network** card of the Supervision page shows the throughput of each
interface of the host: what it receives (↓) and sends (↑) right now, the peak
of the last hour, the volume exchanged and a graph of the hour. It works for
the main dashboard and for every agent, whether the agent is reached over a
VPN or directly on the LAN.

No Speedtest is run and no extra service is installed: Dashmon reads the
kernel counters (`/proc/net/dev`) every 10 seconds.

## Installation

In Docker, the container only sees its own network. Mount the counters of the
host, read-only, in the stack of the dashboard and of each agent:

```yaml
    volumes:
      - dashmon-data:/app/data
      - /proc/1/net/dev:/host/net/dev:ro
```

Only this file is shared: the processes and the rest of the host stay out of
the container. Redeploy the stack; the card shows a first rate after 10 to 20
seconds.

This mount needs a Linux host (Raspberry Pi OS, Debian, Ubuntu…). Outside
Docker, Dashmon reads `/proc/net/dev` directly. Without the mount, the card
says so and shows the line to add.

## Interfaces

By default the card shows the physical interfaces (`eth0`, `enp1s0`, `wlan0`…)
and the VPN tunnels (`wg0`, `tun0`, `tailscale0`…), marked **VPN**. The
loopback and the interfaces of Docker and virtual machines (`lo`, `veth*`,
`docker*`, `br-*`, `virbr*`…) are never listed.

To choose, open **Settings → Supervision**, then the host or the agent, section
**Network**: click the detected interfaces, or type their names. An empty list
returns to the default choice. A bridge used as the LAN link (`br0`) can be
selected this way.

## How the rate is measured

- Intervals come from a monotonic clock: a time change (NTP, manual) never
  distorts a rate.
- The first reading of an interface only sets the starting point: the card
  shows **Measuring…** until the second one.
- When an interface restarts, its counters go back to zero: the computation
  starts again from there instead of showing an absurd peak.
- One hour of measurements is kept in memory; it starts again empty after a
  restart of Dashmon.
- Rates are shown in bits per second (kb/s, Mb/s, Gb/s), like link speeds;
  volumes in bytes. The volume counts from the start of the interface (usually
  the boot of the host).

The page refreshes with `HOST_METRICS_INTERVAL` (60 s by default): the rate
shown is the one of the last 10 seconds before that refresh.

The path of the counters can be changed with `NETWORK_DEV_FILE`
(default `/host/net/dev`).
