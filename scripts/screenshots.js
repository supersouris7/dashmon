"use strict";
// Regenerates the screenshots of the documentation (docs/images/), from
// fictional data only: npm run screenshots. Requires Chromium (CHROMIUM_BIN,
// "chromium" by default).
//
// A throwaway Dashmon runs on a temporary data folder with the example
// applications, fictional supervision reports (WireGuard, SMART, APT,
// OpenCode, Claude Code) and a widget on each tile. The browser answers
// /api/status and /api/host-metrics itself, with made-up values: nothing of
// the machine running the script shows up. The only download is the logos of
// the applications, from Dashboard Icons (the PNG set the README recommends),
// at a fixed version. Maintainers only: never run in CI.
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "images");
const HOST = "127.0.0.1";
const NOW = Math.floor(Date.now() / 1000);
// Dashboard Icons at a fixed commit: the pictures do not change by themselves.
const ICONS_URL =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@83f32e08257b66fbd971ac8d7645f5b38d52e85d/png/";
const GIB = 1024 ** 3;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Fictional data ---------------------------------------------------------

// Logo (Dashboard Icons name) and live value of each example application. The
// values follow the shapes the widgets receive from their server side
// (widgets/<id>/).
const TILES = {
  Jellyfin: { icon: "jellyfin" },
  qBittorrent: {
    icon: "qbittorrent",
    widget: "qbittorrent",
    info: { downloadSpeed: 12.6 * 1024 ** 2, uploadSpeed: 1.4 * 1024 ** 2, connected: true }
  },
  MeTube: {
    icon: "metube",
    widget: "metube",
    info: { completed: 128, active: 2, queued: 3 }
  },
  "AdGuard Home": {
    icon: "adguard-home",
    widget: "adguard",
    info: { queries: 48213, ratio: 17.6, avgMs: 4 }
  },
  "Uptime Kuma": {
    icon: "uptime-kuma",
    widget: "uptimekuma",
    info: { pages: [{ name: "Homelab", up: 14, total: 14, healthy: true }] }
  },
  OpenWrt: {
    icon: "openwrt",
    widget: "ping",
    info: { state: "up" }
  },
  Portainer: {
    icon: "portainer-alt",
    widget: "docker",
    info: { containers: { active: 23, total: 23 }, updated: { count: 21, total: 23 } }
  },
  Gotify: {
    icon: "gotify",
    widget: "gotify",
    info: {
      latest: {
        title: "Backup finished",
        message: "Nightly backup completed",
        priority: 4,
        receivedAt: (NOW - 1800) * 1000
      }
    }
  },
  Duplicati: {
    icon: "duplicati",
    widget: "duplicati",
    info: { ok: true, lastAttemptAt: (NOW - 3 * 3600) * 1000 }
  }
};

const CLAUDE_MODELS = [
  ["anthropic", "claude-opus-5-5", 0.55],
  ["anthropic", "claude-sonnet-5-5", 0.3],
  ["anthropic", "claude-haiku-5-5", 0.15]
];
const OPENCODE_MODELS = [
  ["anthropic", "claude-sonnet-5-5", 0.5],
  ["openrouter", "qwen3-coder", 0.3],
  ["ollama", "devstral", 0.2]
];

function usagePeriod(scale, days, list) {
  const models = list.map(([providerID, id, share]) => ({
    model: { id, providerID },
    steps: Math.round(420 * scale * share),
    tokens: {
      input: Math.round(9000 * scale * share),
      output: Math.round(310000 * scale * share),
      reasoning: Math.round(90000 * scale * share),
      cache: { read: Math.round(38e6 * scale * share), write: Math.round(2.1e6 * scale * share) }
    }
  }));
  const sum = pick => models.reduce((total, model) => total + pick(model), 0);
  return {
    sessions: Math.round(6 * scale),
    subagents: Math.round(3 * scale),
    prompts: Math.round(48 * scale),
    steps: sum(model => model.steps),
    cost: 0,
    tokens: {
      input: sum(model => model.tokens.input),
      output: sum(model => model.tokens.output),
      reasoning: sum(model => model.tokens.reasoning),
      cache: {
        read: sum(model => model.tokens.cache.read),
        write: sum(model => model.tokens.cache.write)
      }
    },
    activeDays: days,
    streak: Math.min(days, 9),
    activity: Array.from({ length: days }, (_item, index) => {
      const day = new Date((NOW - (days - 1 - index) * 86400) * 1000);
      return {
        date: day.toISOString().slice(0, 10),
        steps: Math.round(220 + 260 * Math.abs(Math.sin(index * 1.7)))
      };
    }),
    models,
    tools: {
      usage: [
        { name: "Bash", calls: Math.round(310 * scale), failed: Math.round(2 * scale) },
        { name: "Read", calls: Math.round(260 * scale), failed: 0 },
        { name: "Edit", calls: Math.round(140 * scale), failed: Math.round(2 * scale) }
      ]
    }
  };
}

function usageReport(version, models, scale) {
  return {
    updatedAt: NOW - 600,
    version,
    periods: {
      today: usagePeriod(scale, 1, models),
      week: usagePeriod(6 * scale, 7, models),
      month: usagePeriod(22 * scale, 30, models),
      all: usagePeriod(80 * scale, 30, models)
    }
  };
}

function smartDisk(name, model, temperature, hours) {
  return {
    device: { name },
    model_name: model,
    smart_status: { passed: true },
    temperature: { current: temperature },
    power_on_time: { hours }
  };
}

// Supervision reports, in the formats of the deploy/*.sh scripts.
function writeReports(dir) {
  const peer = (name, ip, ago, rx, tx) =>
    ["wg0", name, "(none)", `${ip}:51820`, "192.0.2.10/32", NOW - ago, rx, tx, "25"].join("\t");
  const files = {
    "wireguard.dump": [
      "wg0\tprivate\tpublic\t51820\toff",
      peer("Laptop", "198.51.100.21", 40, 8.4 * GIB, 1.2 * GIB),
      peer("Phone", "198.51.100.34", 95, 2.1 * GIB, 0.4 * GIB),
      peer("Office", "198.51.100.57", 3600 * 5, 0.6 * GIB, 0.2 * GIB)
    ].join("\n"),
    "smart.json": JSON.stringify({
      updatedAt: NOW - 900,
      disks: [
        smartDisk("/dev/nvme0", "Samsung SSD 990 PRO 1TB", 41, 6120),
        smartDisk("/dev/sda", "WD Red Plus 4TB", 34, 18342),
        smartDisk("/dev/sdb", "WD Red Plus 4TB", 35, 18340)
      ]
    }),
    "apt-updates.json": JSON.stringify({
      status: "success",
      updated: 0,
      finishedAt: NOW - 26 * 3600,
      nextRunAt: NOW + 6 * 86400 - 26 * 3600,
      rebootRequired: false
    }),
    "opencode.json": JSON.stringify(usageReport("1.4.2", OPENCODE_MODELS, 0.6)),
    "claude.json": JSON.stringify(usageReport("2.3.0", CLAUDE_MODELS, 1))
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
}

// The example data of the welcome screen, with a widget on each tile and
// monitoring on, so every dot is green.
async function writeConfig(file) {
  const { demoData } = await import(
    pathToFileURL(path.join(ROOT, "public", "js", "config", "demo.js")).href
  );
  const demo = demoData("en");
  const config = {
    dashboards: [{ id: "main", name: "Homelab", icon: "fa-solid fa-house" }],
    categories: demo.categories.map(category => ({ ...category, dashboardId: "main" })),
    hosts: [
      {
        id: "dashmon-local",
        name: "NAS",
        icon: "fa-solid fa-hard-drive",
        monitoring: { type: "local", enabled: true }
      },
      ...demo.hosts.filter(host => host.name !== "NAS")
    ],
    // The router of the example runs OpenWrt here, for its logo.
    services: demo.services.map(service => {
      const name = service.name === "Router" ? "OpenWrt" : service.name;
      return {
        ...service,
        name,
        monitor: true,
        icon: "icons/" + TILES[name].icon + ".png",
        widget: TILES[name].widget ? { type: TILES[name].widget } : null
      };
    }),
    fortune: demo.fortune,
    theme: "dark",
    language: "en",
    viewMode: "columns",
    webLinks: [
      {
        name: "Dashmon",
        url: "https://github.com/supersouris7/dashmon",
        icon: "fa-brands fa-github"
      },
      {
        name: "Awesome Self-Hosted",
        url: "https://awesome-selfhosted.net",
        icon: "fa-solid fa-house-laptop"
      },
      { name: "Docs", url: "https://docs.exemple.lan", icon: "fa-solid fa-book" }
    ],
    webLinksSeedVersion: 2
  };
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

// Answers of the browser in place of the server: every tile up, with its
// widget value, and a host whose figures are made up.
function fakeStatus(config) {
  const status = {};
  config.services.forEach((service, index) => {
    const tile = TILES[service.name];
    const entry = {
      state: "up",
      ok: true,
      ms: 8 + ((index * 7) % 30),
      lastCheck: Date.now(),
      ...(tile?.widget ? tile.info : {})
    };
    // The browser looks a tile up by its widget key, or by its address as
    // the editor writes it (with the final slash).
    for (const key of [service.widget?.key, service.url, new URL(service.url).href])
      if (key) status[key] = entry;
  });
  return status;
}

// A week of made-up hourly speed tests on a 1 Gb/s fibre: a little slower in
// the evening, one failed test.
function fakeSpeedtest() {
  const now = Date.now();
  const hour = 3600000;
  const history = Array.from({ length: 7 * 24 }, (_value, index) => {
    const at = now - (7 * 24 - 1 - index) * hour - 20 * 60000;
    if (index === 100) return [at, null, null, null];
    const evening = Math.sin(((index % 24) / 24) * Math.PI) ** 4;
    const noise = ((index * 37) % 11) / 11;
    return [
      at,
      Math.round(118e6 - evening * 30e6 - noise * 6e6),
      Math.round(73e6 - evening * 12e6 - noise * 4e6),
      Math.round((7.5 + evening * 6 + noise * 2) * 10) / 10
    ];
  });
  const last = history[history.length - 1];
  return {
    available: true,
    running: false,
    interval: 60,
    server: "cloudflare",
    nextAt: last[0] + hour,
    last: {
      at: last[0],
      ok: true,
      server: "cloudflare",
      download: last[1],
      upload: last[2],
      latencyMs: last[3],
      jitterMs: 1.2
    },
    history
  };
}

function fakeHostMetrics(real) {
  return {
    ...real,
    hosts: (real.hosts || []).map(host => ({
      ...host,
      ok: true,
      cpu: 23,
      ram: 41,
      temperature: 47,
      disk: 58,
      os: "Debian GNU/Linux 13 (trixie)",
      cpuModel: "Intel N100",
      cpuCores: 4,
      ramTotal: 16 * GIB,
      speedtest: fakeSpeedtest()
    }))
  };
}

// --- Browser ------------------------------------------------------------------

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, HOST, resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function ready(url) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch (_error) {}
    await wait(100);
  }
  throw new Error("Not ready: " + url);
}

async function openBrowser(dir, children) {
  const port = await freePort();
  children.push(
    spawn(
      process.env.CHROMIUM_BIN || "chromium",
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-color-profile=srgb",
        "--lang=en-US",
        `--user-data-dir=${path.join(dir, "browser")}`,
        `--remote-debugging-port=${port}`,
        "about:blank"
      ],
      { stdio: "ignore" }
    )
  );
  await ready(`http://${HOST}:${port}/json/version`);
  const target = (await (await fetch(`http://${HOST}:${port}/json`)).json()).find(
    item => item.type === "page"
  );
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const handlers = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method) handlers.forEach(handler => handler(message));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const run = async expression => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ": " + expression);
    return result.result.value;
  };
  return { call, run, on: handler => handlers.push(handler), close: () => socket.close() };
}

// /api/status and /api/host-metrics never reach the page from the server.
async function interceptApis(browser) {
  browser.on(async message => {
    if (message.method !== "Fetch.requestPaused") return;
    const { requestId, request, responseStatusCode } = message.params;
    const reply = body =>
      browser.call("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64")
      });
    try {
      if (/\/api\/(status|refresh)/.test(request.url)) {
        // Read each time: saving widget settings changes their status key.
        const config = await browser.run(`fetch("/api/config").then(r => r.json())`);
        return await reply(fakeStatus(config));
      }
      if (responseStatusCode) {
        const { body, base64Encoded } = await browser.call("Fetch.getResponseBody", { requestId });
        const text = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
        return await reply(fakeHostMetrics(JSON.parse(text)));
      }
      await browser.call("Fetch.continueRequest", { requestId });
    } catch (error) {
      console.error("Interception:", error.message);
      browser.call("Fetch.continueRequest", { requestId }).catch(() => {});
    }
  });
  await browser.call("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/status*", requestStage: "Request" },
      { urlPattern: "*/api/refresh*", requestStage: "Request" },
      { urlPattern: "*/api/host-metrics*", requestStage: "Response" }
    ]
  });
}

// The logos go straight into the icons folder, as if imported by the user.
async function downloadIcons(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const { icon } of Object.values(TILES)) {
    const response = await fetch(ICONS_URL + icon + ".png");
    if (!response.ok) throw new Error(`Logo ${icon}: HTTP ${response.status}`);
    fs.writeFileSync(path.join(dir, icon + ".png"), Buffer.from(await response.arrayBuffer()));
  }
}

// --- Pictures -----------------------------------------------------------------

async function shoot(browser, file) {
  const { data } = await browser.call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function viewport(browser, width, height, scale = 1) {
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: width < 500
  });
}

async function show(browser, base, { theme = "dark", page = "dashboard", expanded = false } = {}) {
  await browser.run(`fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: ${JSON.stringify(theme)} })
  }).then(r => r.status)`);
  await browser.call("Page.navigate", { url: base + "/" });
  await wait(1800);
  // The page is remembered by the browser: always pick it.
  await browser.run(`localStorage.clear()`);
  await browser.call("Page.reload");
  await wait(1500);
  if (page === "supervision") {
    await browser.run(`(async () => {
      const tab = [...document.querySelectorAll("#pageSwitchGroup button")].find(
        button => button.textContent.trim() === "NAS"
      );
      tab.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    })()`);
  }
  if (expanded) {
    await browser.run(`document.querySelector("#collapseAllBtn").click()`);
    await wait(600);
  }
}

// Height of the whole page, to show a long page in one picture.
async function fullHeight(browser, width, scale = 1) {
  const height = await browser.run(`Math.ceil(document.documentElement.scrollHeight)`);
  await viewport(browser, width, height, scale);
  await wait(400);
}

const THEMES = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["matrix", "Matrix"],
  ["polar", "Polar night"],
  ["high-contrast", "High contrast"]
];

// Pictures of the application, kept in a temporary folder for the
// compositions, except those the documentation shows as they are.
async function takePictures(browser, base, temp) {
  const raw = {};
  const keep = async (name, own) => {
    raw[name] = await shoot(browser, path.join(own ? OUT : temp, name + ".png"));
  };
  // Heights cut at the content: no empty band under the tiles.
  await viewport(browser, 1600, 660);
  for (const [theme] of THEMES) {
    await show(browser, base, { theme });
    await keep("theme-" + theme);
  }
  await viewport(browser, 1440, 660);
  await show(browser, base);
  await keep("dashboard", true);
  await viewport(browser, 1440, 780);
  await show(browser, base, { page: "supervision" });
  await keep("supervision", true);
  await show(browser, base, { page: "supervision", expanded: true });
  await fullHeight(browser, 1440);
  await keep("supervision-detailed", true);
  await viewport(browser, 1440, 900);
  await show(browser, base);
  await browser.run(`(async () => {
    document.querySelector("#menuSettingsBtn").click();
    await new Promise(resolve => setTimeout(resolve, 600));
  })()`);
  await keep("settings", true);
  await viewport(browser, 390, 844, 2);
  await show(browser, base);
  await keep("phone-dashboard");
  await show(browser, base, { page: "supervision" });
  await keep("phone-supervision");
  await show(browser, base, { page: "supervision", expanded: true });
  await browser.run(`document.querySelector(".supervision-card-smart, [data-smart-key]")
    ?.scrollIntoView({ block: "start" })`);
  await wait(400);
  await keep("phone-detailed");
  return raw;
}

// A page made of pictures, captured in turn: the themes cut diagonally and
// the phones.
async function compose(browser, name, width, height, html) {
  await viewport(browser, width, height);
  await browser.call("Page.navigate", { url: "about:blank" });
  await wait(200);
  await browser.run(`document.open(); document.write(${JSON.stringify(html)}); document.close();
    Promise.all([...document.images].map(img => img.decode()))`);
  await wait(300);
  await shoot(browser, path.join(OUT, name + ".png"));
}

const dataUrl = file => "data:image/png;base64," + fs.readFileSync(file).toString("base64");

// The same dashboard in the five themes, one diagonal band each, side by
// side with no separator and no caption.
function themesHtml(raw, width = 1600, height = 660) {
  // Each boundary crosses the bottom of the tiles at a fifth of the width, so
  // every band shows the same room there; the outer bands run off the picture.
  const slant = 240;
  const middleY = height - 50;
  const step = width / THEMES.length;
  const at = (k, y) => k * step + (slant * (middleY - y)) / height;
  const bands = THEMES.map(([theme], k) => {
    const clip = `polygon(${at(k, 0)}px 0, ${at(k + 1, 0)}px 0, ${at(k + 1, height)}px ${height}px, ${at(k, height)}px ${height}px)`;
    return `<img src="${dataUrl(raw["theme-" + theme])}" style="clip-path: ${clip}">`;
  }).join("");
  return `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
  img { position: absolute; inset: 0; width: ${width}px; height: ${height}px; }
  </style></head><body>${bands}</body></html>`;
}

// Three phones side by side: dashboard, supervision folded and detailed.
function phonesHtml(raw) {
  const phone = (name, label) => `<figure>
    <img src="${dataUrl(raw[name])}"><figcaption>${label}</figcaption></figure>`;
  return `<!doctype html><html><head><style>
  html, body { margin: 0; width: 1600px; height: 1000px; overflow: hidden; }
  body {
    display: flex; justify-content: center; align-items: center; gap: 70px;
    background: linear-gradient(160deg, #161b26, #0d1018);
    font: 600 22px system-ui, sans-serif; color: #e9edf5;
  }
  figure { margin: 0; display: grid; justify-items: center; gap: 22px; }
  img {
    width: 380px; border-radius: 46px; border: 11px solid #05070b;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12);
  }
  </style></head><body>
    ${phone("phone-dashboard", "Dashboard")}
    ${phone("phone-supervision", "Supervision")}
    ${phone("phone-detailed", "Details")}
  </body></html>`;
}

// --- Run ------------------------------------------------------------------------

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-shots-"));
  const children = [];
  try {
    const data = path.join(temp, "data");
    fs.mkdirSync(data, { recursive: true });
    writeReports(data);
    await writeConfig(path.join(data, "config.json"));
    await downloadIcons(path.join(data, "icons"));
    const password = crypto.randomBytes(16).toString("hex");
    const port = await freePort();
    const base = `http://${HOST}:${port}`;
    children.push(
      spawn(process.execPath, ["server.js"], {
        cwd: ROOT,
        stdio: "ignore",
        env: {
          SPEEDTEST_SCHEDULE: "off",
          PATH: process.env.PATH,
          PORT: String(port),
          DATA_DIR: data,
          CONFIG_FILE: path.join(data, "config.json"),
          ICONS_DIR: path.join(data, "icons"),
          THEMES_CUSTOM_DIR: path.join(data, "themes"),
          DASHMON_PASSWORD: password,
          DASHMON_MASTER_KEY: crypto.randomBytes(32).toString("hex"),
          // No check reaches a real service: the widgets fail quietly and the
          // browser shows the made-up values.
          DOCKER_SOCKET: path.join(temp, "no-docker.sock"),
          WIREGUARD_DUMP_FILE: path.join(data, "wireguard.dump"),
          SMART_DUMP_FILE: path.join(data, "smart.json"),
          APT_UPDATES_REPORT_FILE: path.join(data, "apt-updates.json"),
          OPENCODE_REPORT_FILE: path.join(data, "opencode.json"),
          CLAUDE_REPORT_FILE: path.join(data, "claude.json")
        }
      })
    );
    await ready(base + "/healthz");
    const browser = await openBrowser(temp, children);
    await browser.call("Page.navigate", { url: base + "/login.html" });
    await wait(700);
    await browser.run(`fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ${JSON.stringify(password)} })
    }).then(r => r.status)`);
    await interceptApis(browser);
    await browser.call("Page.navigate", { url: base + "/" });
    await wait(1500);
    fs.mkdirSync(OUT, { recursive: true });
    const raw = await takePictures(browser, base, temp);
    await compose(browser, "themes", 1600, 660, themesHtml(raw));
    await compose(browser, "mobile", 1600, 1000, phonesHtml(raw));
    browser.close();
    console.log("Screenshots written to " + path.relative(ROOT, OUT));
  } finally {
    children.forEach(child => child.kill());
    await wait(300);
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
