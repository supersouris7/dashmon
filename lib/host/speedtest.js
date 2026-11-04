"use strict";
// Speed test of the host's Internet link: latency, jitter, then the maximum
// download and upload rates.
//
// Plain HTTP, nothing to install: by default against speed.cloudflare.com,
// otherwise against a self-hosted LibreSpeed backend (its garbage.php and
// empty.php files), for instance at the other end of a VPN.
//
// Each direction runs STREAMS parallel transfers for at most PHASE_MS, or
// until its volume cap is reached; the first WARMUP_MS (TCP slow start) are
// left out of the rate. Results are kept seven days in speedtest.json, so a
// restart neither loses the history nor starts an extra test.

const fs = require("fs");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const net = require("net");
const { isInsecureTls, safeLookup, isBlockedAddress } = require("../http/client");
const { sanitizeSpeedtest } = require("../config/fields");

const CLOUDFLARE = "https://speed.cloudflare.com/";
const STREAMS = 4;
const PHASE_MS = 8000;
const WARMUP_MS = 1000;
const DOWNLOAD_CAP = 500 * 1000 * 1000;
const UPLOAD_CAP = 250 * 1000 * 1000;
const UPLOAD_BODY = 10 * 1000 * 1000;
const PING_COUNT = 10;
const REQUEST_TIMEOUT = 10000;
const HISTORY_MS = 7 * 24 * 3600 * 1000;
const MAX_RESULTS = 1000;
// A test asked by hand is refused this soon after the previous one.
const MANUAL_COOLDOWN_MS = 60000;

// Addresses of one test. A LibreSpeed URL may name the folder or one of its
// files: both lead to the folder.
function endpoints(server) {
  const bust = () => "r=" + crypto.randomBytes(6).toString("hex");
  if (!server) {
    return {
      kind: "cloudflare",
      ping: () => `${CLOUDFLARE}__down?bytes=0&${bust()}`,
      download: () => `${CLOUDFLARE}__down?bytes=25000000&${bust()}`,
      upload: () => `${CLOUDFLARE}__up?${bust()}`
    };
  }
  const base = new URL(server);
  base.search = "";
  base.hash = "";
  if (/\.(php|html?)$/i.test(base.pathname)) base.pathname = base.pathname.replace(/[^/]*$/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const file = (name, query) => new URL(`${name}?${query}${query ? "&" : ""}${bust()}`, base).href;
  return {
    kind: "librespeed",
    ping: () => file("empty.php", ""),
    download: () => file("garbage.php", "ckSize=100"),
    upload: () => file("empty.php", "")
  };
}

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// One request on the shared agents. Same address rules as lib/http/client.js:
// link-local targets (cloud metadata) are refused.
function open(url, { method = "GET", headers = {}, agents }) {
  const target = new URL(url);
  const literal = target.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && isBlockedAddress(literal)) throw failure("unreachable");
  const secure = target.protocol === "https:";
  return (secure ? https : http).request(target, {
    method,
    agent: secure ? agents.https : agents.http,
    lookup: safeLookup,
    family: 4,
    rejectUnauthorized: !isInsecureTls(),
    headers: { "User-Agent": "Dashmon-Speedtest/1.0", "Cache-Control": "no-store", ...headers }
  });
}

function check(response) {
  if (response.statusCode >= 200 && response.statusCode < 300) return null;
  response.resume();
  return failure("http_" + response.statusCode);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Time to the response headers, minus the processing time the server
// reports (Cloudflare's Server-Timing), over a connection already open.
function pingOnce(url, agents, clock) {
  return new Promise((resolve, reject) => {
    const started = clock();
    const req = open(url, { agents });
    req.setTimeout(REQUEST_TIMEOUT, () => req.destroy(failure("timeout")));
    req.on("error", reject);
    req.on("response", response => {
      const elapsed = clock() - started;
      const error = check(response);
      if (error) return reject(error);
      response.resume();
      const timing = /dur=([\d.]+)/.exec(String(response.headers["server-timing"] || ""));
      const server = timing ? Number(timing[1]) : 0;
      response.on("end", () => resolve(Math.max(0, elapsed - (server < elapsed ? server : 0))));
    });
    req.end();
  });
}

async function measureLatency(points, agents, clock) {
  // The first request opens the connection (DNS, TCP, TLS): not a latency.
  await pingOnce(points.ping(), agents, clock);
  const samples = [];
  for (let index = 0; index < PING_COUNT; index += 1) {
    samples.push(await pingOnce(points.ping(), agents, clock));
  }
  let jitter = 0;
  for (let index = 1; index < samples.length; index += 1) {
    jitter += Math.abs(samples[index] - samples[index - 1]);
  }
  return {
    latencyMs: Math.round(median(samples) * 10) / 10,
    jitterMs: Math.round((jitter / (samples.length - 1)) * 10) / 10
  };
}

// Runs STREAMS workers until the deadline or the cap; each worker repeats
// its transfer. Returns the rate in bytes per second, warm-up excluded.
async function measurePhase(worker, cap, { clock, phaseMs, warmupMs }) {
  const start = clock();
  const deadline = start + phaseMs;
  const meter = { total: 0, measured: 0, end: 0, requests: new Set() };
  meter.count = bytes => {
    meter.total += bytes;
    const now = clock();
    if (now - start >= warmupMs) meter.measured += bytes;
    if (!meter.end && (now >= deadline || meter.total >= cap)) {
      meter.end = now;
      for (const req of meter.requests) req.destroy();
    }
  };
  meter.done = () => meter.end !== 0 || clock() >= deadline;
  const timer = setTimeout(() => meter.count(0), phaseMs + 50);
  let firstError = null;
  await Promise.all(
    Array.from({ length: STREAMS }, async () => {
      while (!meter.done()) {
        try {
          await worker(meter);
        } catch (error) {
          if (meter.done()) break;
          firstError = firstError || error;
          break;
        }
      }
    })
  );
  clearTimeout(timer);
  const end = meter.end || clock();
  if (!meter.total) throw firstError || failure("failed");
  const window = (end - start - warmupMs) / 1000;
  // A link fast enough to reach the cap before the warm-up is over.
  if (window <= 0.2 || !meter.measured) return Math.round(meter.total / ((end - start) / 1000));
  return Math.round(meter.measured / window);
}

function downloadWorker(points, agents) {
  return meter =>
    new Promise((resolve, reject) => {
      const req = open(points.download(), { agents });
      meter.requests.add(req);
      const finish = error => {
        meter.requests.delete(req);
        if (error && !meter.done()) reject(error);
        else resolve();
      };
      req.setTimeout(REQUEST_TIMEOUT, () => req.destroy(failure("timeout")));
      req.on("error", finish);
      req.on("response", response => {
        const error = check(response);
        if (error) return finish(error);
        response.on("data", chunk => meter.count(chunk.length));
        response.on("end", () => finish());
        response.on("error", finish);
      });
      req.end();
    });
}

const UPLOAD_CHUNK = crypto.randomBytes(64 * 1024);

function uploadWorker(points, agents) {
  return meter =>
    new Promise((resolve, reject) => {
      const req = open(points.upload(), {
        method: "POST",
        agents,
        headers: { "Content-Type": "application/octet-stream", "Content-Length": UPLOAD_BODY }
      });
      meter.requests.add(req);
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        meter.requests.delete(req);
        if (error && !meter.done()) reject(error);
        else resolve();
      };
      req.setTimeout(REQUEST_TIMEOUT, () => req.destroy(failure("timeout")));
      req.on("error", finish);
      req.on("response", response => {
        const error = check(response);
        response.resume();
        if (error) return finish(error);
        response.on("end", () => finish());
      });
      let sent = 0;
      const pump = () => {
        while (sent < UPLOAD_BODY && !meter.done() && !req.destroyed) {
          const size = Math.min(UPLOAD_CHUNK.length, UPLOAD_BODY - sent);
          sent += size;
          const chunk =
            size === UPLOAD_CHUNK.length ? UPLOAD_CHUNK : UPLOAD_CHUNK.subarray(0, size);
          // Counted once handed to the system, not when queued.
          const flowing = req.write(chunk, error => {
            if (!error) meter.count(size);
          });
          if (!flowing) return req.once("drain", pump);
        }
        if (sent >= UPLOAD_BODY) req.end();
        else if (meter.done()) req.destroy();
      };
      pump();
    });
}

function agentsFor() {
  const options = { keepAlive: true, maxSockets: STREAMS };
  return { http: new http.Agent(options), https: new https.Agent(options) };
}

function errorCode(error) {
  if (/^(http_\d{3}|timeout|unreachable|failed)$/.test(error?.code)) return error.code;
  if (
    ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(error?.code)
  )
    return "unreachable";
  if (error?.code === "ETIMEDOUT") return "timeout";
  return "failed";
}

// One full test. Never rejects: a failure is a result too.
async function runMeasure(
  server,
  { clock = () => performance.now(), now = Date.now, phaseMs = PHASE_MS, warmupMs = WARMUP_MS } = {}
) {
  const timing = { clock, phaseMs, warmupMs };
  const points = endpoints(server);
  const agents = agentsFor();
  const at = now();
  try {
    const latency = await measureLatency(points, agents, clock);
    const download = await measurePhase(downloadWorker(points, agents), DOWNLOAD_CAP, timing);
    const upload = await measurePhase(uploadWorker(points, agents), UPLOAD_CAP, timing);
    return { at, ok: true, server: points.kind, download, upload, ...latency };
  } catch (error) {
    return { at, ok: false, server: points.kind, error: errorCode(error) };
  } finally {
    agents.http.destroy();
    agents.https.destroy();
  }
}

// --- History and schedule ---------------------------------------------------

function validResult(item) {
  return (
    item &&
    typeof item === "object" &&
    Number.isFinite(item.at) &&
    typeof item.ok === "boolean" &&
    (!item.ok ||
      ["download", "upload", "latencyMs", "jitterMs"].every(key => Number.isFinite(item[key])))
  );
}

function readHistory(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed?.results) ? parsed.results.filter(validResult) : [];
  } catch (_error) {
    return [];
  }
}

function writeHistory(file, results) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ results }) + "\n", { mode: 0o600 });
  fs.renameSync(temporary, file);
}

// readPrefs(): speed test settings of the monitored local host, or null when
// this instance has none. scheduled: false only runs tests asked by hand.
function createSpeedtest({
  file,
  readPrefs,
  scheduled = true,
  measure = runMeasure,
  now = Date.now,
  tickMs = 60000,
  firstDelayMs = 60000,
  onResult = () => {},
  log = null
}) {
  let results = file ? readHistory(file) : [];
  let running = null;
  let timer = null;

  function prefs() {
    try {
      const raw = readPrefs();
      return raw ? sanitizeSpeedtest(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function store(result) {
    const cutoff = now() - HISTORY_MS;
    results = [...results, result].filter(item => item.at >= cutoff).slice(-MAX_RESULTS);
    if (file) {
      try {
        writeHistory(file, results);
      } catch (error) {
        log?.warn(`Speed test history not saved: ${error.message}`);
      }
    }
    onResult(result);
    return result;
  }

  function run(server) {
    if (!running) {
      running = Promise.resolve()
        .then(() => measure(server))
        .then(store)
        .finally(() => {
          running = null;
        });
    }
    return running;
  }

  function nextAt(current = prefs()) {
    if (!scheduled || !current?.enabled || !current.interval) return null;
    const last = results[results.length - 1];
    return last ? last.at + current.interval * 60000 : null;
  }

  function tick() {
    const current = prefs();
    if (!current?.enabled || !current.interval || running) return;
    const due = nextAt(current);
    if (due === null || now() >= due) run(current.server);
  }

  function start() {
    if (!scheduled || timer) return;
    timer = setTimeout(function loop() {
      tick();
      timer = setTimeout(loop, tickMs);
      timer.unref?.();
    }, firstDelayMs);
    timer.unref?.();
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
  }

  // Test asked from the supervision page: joins the one running, refused
  // right after another one.
  function runNow() {
    const current = prefs();
    if (!current?.enabled) return { status: 404 };
    if (running) return { status: 200, result: running };
    const last = results[results.length - 1];
    if (last && now() - last.at < MANUAL_COOLDOWN_MS) {
      return { status: 429, retryAfter: Math.ceil((last.at + MANUAL_COOLDOWN_MS - now()) / 1000) };
    }
    return { status: 200, result: run(current.server) };
  }

  function report(current = prefs()) {
    if (!current?.enabled) return null;
    const cutoff = now() - HISTORY_MS;
    const recent = results.filter(item => item.at >= cutoff);
    return {
      available: true,
      running: !!running,
      interval: scheduled ? current.interval : 0,
      server: current.server ? "librespeed" : "cloudflare",
      nextAt: nextAt(current),
      last: recent[recent.length - 1] || null,
      // [time, download, upload, latency]; a failed test has nulls.
      history: recent.map(item =>
        item.ok
          ? [item.at, item.download, item.upload, item.latencyMs]
          : [item.at, null, null, null]
      )
    };
  }

  return { start, stop, tick, runNow, report };
}

module.exports = {
  createSpeedtest,
  runMeasure,
  endpoints,
  median,
  STREAMS,
  PHASE_MS,
  WARMUP_MS,
  MANUAL_COOLDOWN_MS,
  HISTORY_MS
};
