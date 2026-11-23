"use strict";
// Speed test: addresses, a real measurement against a local LibreSpeed-like
// server, schedule, manual test, history on disk.
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { createSpeedtest, runMeasure, endpoints, median } = require("../lib/host/speedtest");
const { sanitizeSpeedtest, sanitizeHostMonitoring } = require("../lib/config/fields");

(async () => {
  // Addresses: Cloudflare by default; a LibreSpeed URL leads to its folder.
  const cloudflare = endpoints("");
  assert.equal(cloudflare.kind, "cloudflare");
  assert.match(cloudflare.download(), /^https:\/\/speed\.cloudflare\.com\/__down\?bytes=\d+&r=/);
  assert.match(cloudflare.upload(), /^https:\/\/speed\.cloudflare\.com\/__up\?r=/);
  for (const server of [
    "http://speed.exemple.lan/backend",
    "http://speed.exemple.lan/backend/",
    "http://speed.exemple.lan/backend/garbage.php?ckSize=10"
  ]) {
    const points = endpoints(server);
    assert.equal(points.kind, "librespeed");
    assert.match(
      points.download(),
      /^http:\/\/speed\.exemple\.lan\/backend\/garbage\.php\?ckSize=100&r=/
    );
    assert.match(points.upload(), /^http:\/\/speed\.exemple\.lan\/backend\/empty\.php\?r=/);
  }
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);

  // Settings: defaults are not stored, unknown intervals fall back to 1 h.
  assert.deepEqual(sanitizeSpeedtest({}), { enabled: true, interval: 60, server: "" });
  assert.deepEqual(sanitizeSpeedtest({ interval: 7, server: "ftp://x" }), {
    enabled: true,
    interval: 60,
    server: ""
  });
  assert.equal(sanitizeSpeedtest({ interval: 0 }).interval, 0);
  assert.equal(
    sanitizeHostMonitoring({ enabled: true, speedtest: { interval: 60 } }).speedtest,
    undefined
  );
  assert.deepEqual(
    sanitizeHostMonitoring({ enabled: true, speedtest: { interval: 360 } }).speedtest,
    { enabled: true, interval: 360, server: "" }
  );

  // Real measurement over the loopback, against garbage.php / empty.php.
  let uploaded = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/backend/garbage.php") {
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      const chunk = Buffer.alloc(1024 * 1024);
      let left = Number(url.searchParams.get("ckSize")) || 1;
      const pump = () => {
        while (left > 0) {
          left -= 1;
          if (!res.write(chunk)) return res.once("drain", pump);
        }
        res.end();
      };
      res.on("close", () => {
        left = 0;
      });
      return pump();
    }
    if (url.pathname === "/backend/empty.php") {
      req.on("data", chunk => {
        uploaded += chunk.length;
      });
      req.on("end", () => res.end());
      req.on("error", () => {});
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/backend/`;
  const result = await runMeasure(base, { phaseMs: 600, warmupMs: 100 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.server, "librespeed");
  assert.ok(result.download > 0 && result.upload > 0, JSON.stringify(result));
  assert.ok(result.latencyMs >= 0 && result.jitterMs >= 0);
  assert.ok(uploaded > 0);

  // A server answering errors gives a failed result, never an exception.
  const missing = await runMeasure(`http://127.0.0.1:${server.address().port}/none/`, {
    phaseMs: 300,
    warmupMs: 50
  });
  assert.deepEqual({ ok: missing.ok, error: missing.error }, { ok: false, error: "http_404" });
  server.close();
  const refused = await runMeasure("http://127.0.0.1:1/", { phaseMs: 300, warmupMs: 50 });
  assert.equal(refused.error, "unreachable");

  // Schedule: the first test at once (phase 0), then one per interval, in
  // this instance's slot.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-speedtest-"));
  const file = path.join(dir, "speedtest.json");
  const HOUR = 3600000;
  let clock = 277778 * HOUR; // on an hour boundary
  let prefs = { interval: 60 };
  const runs = [];
  const measure = async target => {
    runs.push(target);
    return {
      at: clock,
      ok: true,
      server: "cloudflare",
      download: 1e8,
      upload: 2e7,
      latencyMs: 12,
      jitterMs: 1.5
    };
  };
  let notified = 0;
  const test = createSpeedtest({
    file,
    readPrefs: () => prefs,
    measure,
    now: () => clock,
    phase: 0,
    onResult: () => {
      notified += 1;
    }
  });
  assert.equal(test.report().last, null);
  test.tick();
  await new Promise(setImmediate);
  assert.equal(runs.length, 1);
  assert.equal(notified, 1);
  clock += 30 * 60000;
  test.tick();
  await new Promise(setImmediate);
  assert.equal(runs.length, 1, "not due before the interval");
  clock += 31 * 60000;
  test.tick();
  await new Promise(setImmediate);
  assert.equal(runs.length, 2);

  // Manual: refused right after a test, allowed one minute later.
  assert.equal(test.runNow().status, 429);
  clock += 61000;
  const manual = test.runNow();
  assert.equal(manual.status, 200);
  assert.equal((await manual.result).ok, true);
  assert.equal(runs.length, 3);

  // Report: last result and compact history.
  const report = test.report();
  assert.equal(report.server, "cloudflare");
  assert.equal(report.history.length, 3);
  assert.deepEqual(report.history[0].slice(1), [1e8, 2e7, 12]);
  // Next slot of phase 0 at least half an interval after the last test.
  assert.equal(report.nextAt, 277778 * HOUR + 2 * HOUR);

  // Interval 0: no automatic test, a manual one still runs.
  prefs = { interval: 0 };
  clock += 10 * 3600000;
  test.tick();
  await new Promise(setImmediate);
  assert.equal(runs.length, 3);
  assert.equal(test.report().nextAt, null);
  // Disabled or not monitored: no card, no test.
  prefs = { enabled: false };
  assert.equal(test.report(), null);
  assert.equal(test.runNow().status, 404);
  prefs = null;
  assert.equal(test.report(), null);

  // The history survives a restart and drops results older than 7 days.
  prefs = { interval: 60 };
  const again = createSpeedtest({ file, readPrefs: () => prefs, measure, now: () => clock });
  assert.equal(again.report().history.length, 3);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  clock += 8 * 24 * 3600000;
  const later = createSpeedtest({ file, readPrefs: () => prefs, measure, now: () => clock });
  assert.equal(later.report().history.length, 0);
  // A damaged file starts an empty history.
  fs.writeFileSync(file, "{oops");
  assert.equal(
    createSpeedtest({ file, readPrefs: () => prefs, measure }).report().history.length,
    0
  );

  // Two requests at once share one test.
  let release;
  const slow = createSpeedtest({
    readPrefs: () => ({}),
    measure: () =>
      new Promise(resolve => {
        release = () =>
          resolve({ at: Date.now(), ok: false, server: "cloudflare", error: "timeout" });
      })
  });
  const first = slow.runNow();
  const second = slow.runNow();
  assert.equal(slow.report().running, true);
  await new Promise(setImmediate);
  release();
  assert.equal(await first.result, await second.result);
  assert.equal(slow.report().history[0][1], null);

  // Hosts of one site test in different slots, which stay put whatever the
  // time a test took; after a 429 the next automatic test waits 3 hours.
  {
    let at = 500 * HOUR;
    let answer = { ok: true };
    const fake = () => async () => ({ at, server: "cloudflare", ...answer });
    const a = createSpeedtest({
      readPrefs: () => ({}),
      measure: fake(),
      now: () => at,
      phase: 0.25
    });
    const b = createSpeedtest({
      readPrefs: () => ({}),
      measure: fake(),
      now: () => at,
      phase: 0.75
    });
    // First test within a quarter of an hour, spread by the phase.
    assert.equal(a.report().nextAt, at + 0.25 * 15 * 60000);
    assert.equal(b.report().nextAt, at + 0.75 * 15 * 60000);
    at += 20 * 60000;
    a.tick();
    b.tick();
    await new Promise(setImmediate);
    assert.equal(a.report().nextAt, 501 * HOUR + 15 * 60000);
    assert.equal(b.report().nextAt, 501 * HOUR + 45 * 60000);
    at = 501 * HOUR + 15 * 60000 + 50000; // started 50 s late
    a.tick();
    await new Promise(setImmediate);
    assert.equal(a.report().nextAt, 502 * HOUR + 15 * 60000, "the slot does not drift");
    answer = { ok: false, error: "http_429" };
    at = 502 * HOUR + 15 * 60000;
    a.tick();
    await new Promise(setImmediate);
    assert.equal(a.report().nextAt, 505 * HOUR + 15 * 60000, "3 hours after a 429");
    at += 2 * HOUR;
    a.tick();
    await new Promise(setImmediate);
    assert.equal(a.report().history.length, 3, "no test during the back-off");
  }

  // Without a schedule (SPEEDTEST_SCHEDULE=off) nothing runs on its own.
  const off = createSpeedtest({ readPrefs: () => ({}), scheduled: false, measure });
  off.start();
  assert.equal(off.report().interval, 0);
  off.stop();

  fs.rmSync(dir, { recursive: true, force: true });
  console.log("speedtest tests passed");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
