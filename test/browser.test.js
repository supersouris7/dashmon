"use strict";
// Test facultatif : necessite Chromium et un Node avec WebSocket natif.
// Les donnees, le mot de passe et le profil navigateur sont ephemeres.
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const root = path.join(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-browser-"));
const password = crypto.randomBytes(24).toString("hex");
const children = [];
const loopback = [127, 0, 0, 1].join(".");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, loopback, resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function ready(url) {
  for (let i = 0; i < 150; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_error) {}
    await wait(100);
  }
  throw new Error("Service de test indisponible");
}
async function main() {
  const appPort = await freePort(),
    debugPort = await freePort();
  const base = `http://${loopback}:${appPort}`;
  const dataDir = path.join(dir, "data");
  children.push(
    spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(appPort),
        DATA_DIR: dataDir,
        CONFIG_FILE: path.join(dataDir, "config.json"),
        DASHMON_MODE: "primary",
        DASHMON_PASSWORD: password,
        DASHMON_SYNC_TOKEN: "",
        DASHMON_MASTER_KEY: crypto.randomBytes(32).toString("hex"),
        ICONS_DIR: path.join(dataDir, "icons"),
        THEMES_CUSTOM_DIR: path.join(dataDir, "themes"),
        THEMES_NATIVE_DIR: path.join(root, "public", "themes"),
        DASHBOARD_INSECURE_TLS: "0",
        DASHMON_WIDGET_DIR: "",
        DASHMON_PLUGINS_DIR: "",
        DASHMON_ALLOW_UNSAFE_PLUGINS: "0",
        WIREGUARD_DUMP_FILE: path.join(dataDir, "wireguard.dump"),
        SMART_DUMP_FILE: path.join(dataDir, "smart.json"),
        APT_UPDATES_REPORT_FILE: path.join(dataDir, "apt-updates.json")
      },
      stdio: "ignore"
    })
  );
  await ready(base + "/healthz");
  const executable = process.env.CHROMIUM_BIN || "chromium";
  children.push(
    spawn(
      executable,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        `--user-data-dir=${dir}/profile`,
        `--remote-debugging-port=${debugPort}`,
        "about:blank"
      ],
      { stdio: "ignore" }
    )
  );
  await ready(`http://${loopback}:${debugPort}/json/version`);
  const targets = await (await fetch(`http://${loopback}:${debugPort}/json`)).json();
  const ws = new WebSocket(targets.find(item => item.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await call("Page.enable");
  await call("Page.navigate", { url: base + "/login.html" });
  await wait(800);
  const login = await evaluate(
    `fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:${JSON.stringify(password)}})}).then(r=>r.status)`
  );
  assert.equal(login, 200);
  await call("Page.navigate", { url: base + "/" });
  await wait(1800);
  assert.equal(await evaluate("!!document.querySelector('#menuSupervisionBtn')"), true);
  await evaluate("document.querySelector('#menuSupervisionBtn').click()");
  await wait(300);
  assert.equal(await evaluate("!!document.querySelector('[data-panel=replicationPanel]')"), true);
  const picked = await evaluate(
    `(()=>{const b=document.querySelector('#hostsPanel .color-swatch-btn');if(!b)return false;b.click();const p=document.querySelector('#hostsPanel .color-palette:not([hidden])');if(!p)return false;p.querySelector('.color-chip').click();return true;})()`
  );
  assert.equal(picked, true);
  for (const panel of ["wireguardPanel", "smartPanel", "aptUpdatesPanel"]) {
    const changed = await evaluate(
      `(()=>{document.querySelector('[data-panel=${panel}]').click();const root=document.querySelector('#${panel}');const button=root.querySelector('.monitor-toggle');if(!button)return false;const before=button.getAttribute('aria-pressed');button.click();return root.querySelector('.monitor-toggle').getAttribute('aria-pressed')!==before;})()`
    );
    assert.equal(changed, true, panel);
  }
  await evaluate("document.querySelector('[data-panel=replicationPanel]').click()");
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('#replicationEditor .agent-editor-actions button')];b.at(-1).click();const i=document.querySelector('.agent-editor-item input');i.value='http://exemple.lan';i.dispatchEvent(new Event('input',{bubbles:true}));})()`
  );
  await evaluate("document.querySelector('#saveBtn').click()");
  await wait(400);
  const warning = await evaluate(
    "document.querySelector('#confirmBackdrop').classList.contains('show') && document.querySelectorAll('#confirmActions button').length===3"
  );
  assert.equal(warning, true);
  await evaluate("document.querySelectorAll('#confirmActions button')[1].click()");
  await wait(700);
  assert.deepEqual(
    await evaluate("fetch('/api/config').then(r=>r.json()).then(c=>c.replication.secondaries)"),
    ["http://exemple.lan/"]
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.agent-editor-item input');i.value='http://[';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-panel=hostsPanel]').click();document.querySelector('[data-panel=replicationPanel]').click();})()`
  );
  assert.equal(
    await evaluate("document.querySelector('.agent-editor-item input').value"),
    "http://["
  );
  await evaluate(
    `(()=>{const i=document.querySelector('.agent-editor-item input');i.value='http://exemple.lan';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#saveBtn').click();})()`
  );
  await wait(250);
  await evaluate("document.querySelector('#confirmActions button').click()");
  await wait(250);
  assert.equal(
    await evaluate("document.querySelector('#hostsPanel').classList.contains('active')"),
    true
  );
  await evaluate("document.querySelector('#saveBtn').click()");
  await wait(700);
  const linked = await evaluate(
    "fetch('/api/config').then(r=>r.json()).then(c=>({host:c.replication.agentHosts['http://exemple.lan/'],hosts:c.hosts.map(h=>h.id)}))"
  );
  assert.ok(linked.host && linked.hosts.includes(linked.host));
  ws.close();
  console.log("PASS navigateur : connexion, pairage, sauvegarde et hote associe");
}
main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const exits = children.map(child =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise(resolve => child.once("exit", resolve))
    );
    children.forEach(child => child.kill("SIGTERM"));
    await Promise.race([Promise.all(exits), wait(2000)]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
