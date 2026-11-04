# Speed test

The **Speed test** card of the Supervision page shows the maximum rates of
the host's Internet link: download (↓), upload (↑), latency and jitter. A test
runs every hour by default, on the main dashboard and on every agent, so each
host measures its own link, whether the agent is reached over a VPN or
directly on the LAN.

Folded, the card shows the last result and a graph of the last 24 hours.
Opened, it adds the jitter, the best rates of the week, the server, the time of
the next test and a graph of the last 7 days. **Test now** runs one at once
(about 20 seconds).

Nothing to install and no volume to mount: the test is plain HTTPS from the
container.

## Settings

**Settings → Supervision**, then the host or the agent, section **Speed test**:

- **Show the Speed test card**: off, no test runs on this host.
- **Automatic test**: every 15 minutes, every hour (default), every 6 hours,
  every day, or never (tests asked by hand only).
- **Server**: empty for Cloudflare (`speed.cloudflare.com`), or the address of
  your own LibreSpeed server.

## How a test is measured

1. **Latency**: 10 small requests over a connection already open; the latency
   is their median, the jitter the mean gap between two in a row.
2. **Download**, then **upload**: 4 parallel transfers for about 8 seconds.
   The first second (TCP slow start) is left out of the rate.

Rates are shown in bits per second (Mb/s, Gb/s), like ISP offers. A failed
test (server unreachable, error) shows on the card and leaves a gap in the
graph; the next one runs at the usual time.

Results are kept 7 days in `speedtest.json`, in the data volume: a restart
neither loses the history nor runs an extra test. The first automatic test of
a new install runs a minute or two after start-up.

## Data used

Each direction stops after 8 seconds or once its cap is reached: 500 MB down,
250 MB up. A link under 100 Mb/s uses about 100 MB down per test; a 1 Gb/s
fibre reaches the caps, about 750 MB per test, or 18 GB a day at one test an
hour. On a metered or shared link, choose every 6 hours or every day.

`SPEEDTEST_SCHEDULE=off` turns off automatic tests for the whole instance;
**Test now** keeps working.

## Your own server: LibreSpeed

To measure another path than the one to Cloudflare, for instance the VPN
link between two sites, run a [LibreSpeed](https://github.com/librespeed/speedtest)
server at the other end and give the address of the folder holding its
`garbage.php` and `empty.php` files:

```text
http://speed.exemple.lan/backend/
```

The address of one of the two files is accepted too. The test then measures
the link between the host and that server.
