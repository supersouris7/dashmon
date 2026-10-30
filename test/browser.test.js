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
const token = crypto.randomBytes(24).toString("hex");
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
        DASHMON_SYNC_TOKEN: token,
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
  const agentPort = await freePort();
  const agentBase = `http://${loopback}:${agentPort}`;
  const agentData = path.join(dir, "agent");
  children.push(
    spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(agentPort),
        DATA_DIR: agentData,
        CONFIG_FILE: path.join(agentData, "config.json"),
        DASHMON_MODE: "agent",
        DASHMON_PASSWORD: "",
        DASHMON_SYNC_TOKEN: token,
        DASHMON_MASTER_KEY: ""
      },
      stdio: "ignore"
    })
  );
  await ready(agentBase + "/healthz");
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
  assert.deepEqual(
    await evaluate("[...document.querySelector('#themeSelect').options].map(option=>option.value)"),
    ["dark", "light", "matrix"]
  );
  for (const removed of ["black", "rainbow-dark", "rainbow-light"]) {
    assert.equal(
      await evaluate(
        `Promise.all([import('/js/state.js'),import('/js/themes.js')]).then(async([{state},{loadThemes}])=>{state.theme=${JSON.stringify(removed)};await loadThemes();return document.documentElement.dataset.theme})`
      ),
      "dark"
    );
  }
  assert.equal(await evaluate("!!document.querySelector('#menuSettingsBtn')"), true);
  assert.equal(
    await evaluate(
      "!!document.querySelector('#menuSupervisionBtn, #menuEditBtn, #menuAppearanceBtn')"
    ),
    false
  );
  await evaluate("document.querySelector('#menuSettingsBtn').click()");
  await wait(300);
  await evaluate("document.querySelector('#saveBtn').focus()");
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
  assert.equal(await evaluate("document.activeElement.id"), "closeBtn");
  assert.equal(
    await evaluate("document.querySelector('#modalBackdrop').getBoundingClientRect().top"),
    0
  );
  assert.equal(await evaluate("document.querySelectorAll('.settings-category').length"), 4);
  await evaluate("document.querySelector('.settings-branch summary').click()");
  assert.equal(
    await evaluate("document.querySelector('[data-panel=servicesPanel]').getClientRects().length"),
    0
  );
  await evaluate("document.querySelector('.settings-branch summary').click()");
  await evaluate("document.querySelector('[data-panel=appearancePanel]').click()");
  assert.equal(
    await evaluate(
      "!!document.querySelector('#appearancePanel #themeSelect') && document.querySelector('#appearancePanel').getClientRects().length > 0"
    ),
    true
  );
  // Appearance applies at once: no Cancel / Save footer there.
  assert.equal(
    await evaluate("getComputedStyle(document.querySelector('.editor-footer')).display"),
    "none"
  );
  // Resetting the usage counters asks for confirmation first.
  await evaluate("document.querySelector('#resetUsageBtn').click()");
  await wait(200);
  assert.equal(
    await evaluate("document.querySelector('#confirmBackdrop').classList.contains('show')"),
    true
  );
  await evaluate(
    "document.querySelector('#confirmBackdrop [data-action=cancel], #confirmBackdrop button')?.click()"
  );
  await wait(200);
  await evaluate("document.querySelector('[data-panel=hostsPanel]').click()");
  assert.notEqual(
    await evaluate("getComputedStyle(document.querySelector('.editor-footer')).display"),
    "none"
  );
  assert.equal(await evaluate("!!document.querySelector('[data-panel=replicationPanel]')"), true);
  const picked = await evaluate(
    `(()=>{const b=document.querySelector('#hostsPanel .color-swatch-btn');if(!b)return false;b.click();const p=document.querySelector('#hostsPanel .color-palette:not([hidden])');if(!p)return false;p.querySelector('.color-chip').click();return true;})()`
  );
  assert.equal(picked, true);
  await evaluate(
    "import('/js/state.js').then(({state})=>{const host=state.editHosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local');state.hostMetrics=[{id:host.id,smart:[{device:'/dev/sda'},{device:'/dev/sdb'}]}]})"
  );
  await evaluate("document.querySelector('[data-panel=localHostPanel]').click()");
  assert.equal(
    await evaluate("document.querySelectorAll('#localHostEditor .smart-disk-choice').length"),
    2
  );
  await evaluate("document.querySelector('#localHostEditor .smart-disk-choice').click()");
  assert.equal(
    await evaluate("document.querySelector('#localHostEditor [name=smartDisks]').value"),
    "/dev/sdb"
  );
  await evaluate(
    "(()=>{const input=document.querySelector('#localHostEditor [name=agentHostName]');input.value='Hote principal';input.dispatchEvent(new Event('input',{bubbles:true}));})()"
  );
  const localFields = await evaluate(
    "[...document.querySelectorAll('#localHostEditor input')].map(input=>input.name)"
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.settings-branch summary'),'::before').content"
    ),
    "none"
  );
  assert.equal(
    await evaluate("!!document.querySelector('#settingsSupervision, #settingsAgentsBranch')"),
    false
  );
  assert.equal(
    await evaluate("document.querySelector('[data-panel=localHostPanel]').textContent.trim()"),
    "Local"
  );
  for (const name of ["wireguard", "smart", "aptUpdates"]) {
    const changed = await evaluate(
      `(()=>{const input=document.querySelector('#localHostEditor [name=${name}]');const before=input.checked;input.click();return input.checked!==before;})()`
    );
    assert.equal(changed, true, name);
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
  assert.deepEqual(
    await evaluate(
      "fetch('/api/config').then(r=>r.json()).then(c=>{const host=c.hosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local');return {name:host.name,wireguard:host.monitoring.wireguard.enabled,smart:host.monitoring.smart,apt:host.monitoring.aptUpdates.enabled}})"
    ),
    {
      name: "Hote principal",
      wireguard: false,
      smart: { enabled: false, disks: ["/dev/sdb"] },
      apt: false
    }
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
  await evaluate("document.querySelector('[data-panel=replicationPanel]').click()");
  await evaluate(
    `(()=>{const i=document.querySelector('.agent-editor-item input');i.value=${JSON.stringify(agentBase)};i.dispatchEvent(new Event('input',{bubbles:true}));})()`
  );
  assert.equal(
    await evaluate("document.querySelectorAll('#settingsAgentTree > button').length"),
    1
  );
  assert.equal(
    await evaluate("document.querySelector('#settingsAgentTree button').disabled"),
    true
  );
  await evaluate("document.querySelector('#saveBtn').click()");
  await wait(700);
  assert.equal(
    await evaluate("document.querySelector('#settingsAgentTree button').disabled"),
    false
  );
  await evaluate("document.querySelector('#settingsAgentTree button').click()");
  await wait(700);
  assert.equal(
    await evaluate("!!document.querySelector('#remoteAgentEditor [name=agentHostName]')"),
    true
  );
  assert.deepEqual(
    await evaluate(
      "[...document.querySelectorAll('#remoteAgentEditor input')].map(input=>input.name)"
    ),
    localFields
  );
  assert.equal(await evaluate("document.querySelectorAll('.agent-configure').length"), 0);
  assert.equal(
    await evaluate("document.querySelector('#remoteAgentEditor [name=wireguard]').checked"),
    true
  );
  await evaluate("document.querySelector('#remoteAgentEditor [name=wireguard]').click()");
  assert.equal(
    await evaluate(
      "document.querySelector('#settingsAgentTree button').parentElement.parentElement.querySelector('[data-panel=localHostPanel]') !== null"
    ),
    true
  );
  await evaluate(
    "(()=>{const i=document.querySelector('#remoteAgentEditor [name=agentHostName]');i.value='Agent navigateur';i.dispatchEvent(new Event('input',{bubbles:true}));})()"
  );
  await evaluate(
    "document.querySelector('[data-panel=appearancePanel]').click();document.querySelector('#settingsAgentTree button').click()"
  );
  await wait(100);
  assert.equal(
    await evaluate("document.querySelector('#remoteAgentEditor [name=agentHostName]').value"),
    "Agent navigateur"
  );
  await evaluate("document.querySelector('#closeBtn').click()");
  await wait(100);
  assert.equal(
    await evaluate("document.querySelector('#confirmBackdrop').classList.contains('show')"),
    true
  );
  await evaluate("document.querySelector('#confirmActions button').click()");
  await evaluate("document.querySelector('#saveBtn').click()");
  await wait(700);
  assert.equal(
    await evaluate(
      `fetch('/api/agents/config?url='+encodeURIComponent(${JSON.stringify(agentBase)})).then(r=>r.json()).then(r=>r.config.name)`
    ),
    "Agent navigateur"
  );
  assert.equal(
    await evaluate(
      `fetch('/api/agents/config?url='+encodeURIComponent(${JSON.stringify(agentBase)})).then(r=>r.json()).then(r=>r.config.monitoring.wireguard.enabled)`
    ),
    false
  );
  await evaluate(
    "document.querySelector('[data-panel=servicesPanel]').click(); document.querySelector('#addServiceBtn').click(); document.querySelector('[data-panel=appearancePanel]').click(); document.querySelector('#closeBtn').click()"
  );
  await wait(200);
  assert.equal(
    await evaluate("document.querySelector('#confirmBackdrop').classList.contains('show')"),
    true
  );
  await evaluate("document.querySelectorAll('#confirmActions button')[1].click()");
  await wait(200);
  assert.equal(
    await evaluate("document.querySelector('#modalBackdrop').classList.contains('show')"),
    false
  );
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  // No settings on a phone: the menu entry is hidden and does nothing.
  await wait(300);
  assert.equal(
    await evaluate("getComputedStyle(document.querySelector('#menuSettingsBtn')).display"),
    "none"
  );
  await evaluate("document.querySelector('#menuSettingsBtn').click()");
  await wait(300);
  assert.equal(
    await evaluate("document.querySelector('#modalBackdrop').classList.contains('show')"),
    false
  );
  // Settings open on a wide screen close when the screen becomes phone-sized.
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await evaluate("document.querySelector('#menuSettingsBtn').click()");
  await wait(300);
  assert.equal(
    await evaluate("document.querySelector('#modalBackdrop').classList.contains('show')"),
    true
  );
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await wait(400);
  assert.equal(
    await evaluate("document.querySelector('#modalBackdrop').classList.contains('show')"),
    false
  );
  assert.equal(
    await evaluate("document.querySelector('#confirmBackdrop').classList.contains('show')"),
    false
  );
  ws.close();
  console.log(
    "PASS navigateur : connexion, arborescence, pairage et configuration distante (bureau/mobile)"
  );
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
