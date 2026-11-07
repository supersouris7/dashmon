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
  for (let i = 0; i < 600; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_error) {}
    await wait(100);
  }
  throw new Error("Service de test indisponible : " + url);
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
        SPEEDTEST_SCHEDULE: "off",
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
        SPEEDTEST_SCHEDULE: "off",
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
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${dir}/profile`,
        `--remote-debugging-port=${debugPort}`,
        "about:blank"
      ],
      { stdio: ["ignore", "ignore", "inherit"] }
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
  // The theme is applied before the first paint: the preload script is a file
  // the Content-Security-Policy accepts, not an inline script it would block.
  await evaluate("localStorage.setItem('dashmon.theme', 'light')");
  await call("Page.navigate", { url: base + "/login.html" });
  await wait(800);
  assert.equal(await evaluate("document.documentElement.dataset.theme"), "light");
  assert.equal(
    await evaluate("document.querySelector('#loginBtn').textContent"),
    (await evaluate("navigator.language")).startsWith("fr") ? "Connexion" : "Sign in"
  );
  await evaluate("localStorage.removeItem('dashmon.theme')");
  const login = await evaluate(
    `fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:${JSON.stringify(password)}})}).then(r=>r.status)`
  );
  assert.equal(login, 200);
  await call("Page.navigate", { url: base + "/" });
  await wait(1800);
  assert.deepEqual(
    await evaluate("[...document.querySelector('#themeSelect').options].map(option=>option.value)"),
    ["dark", "light", "polar", "matrix", "high-contrast"]
  );
  for (const removed of ["black", "rainbow-dark", "rainbow-light"]) {
    assert.equal(
      await evaluate(
        `Promise.all([import('/js/state.js'),import('/js/themes.js')]).then(async([{state},{loadThemes}])=>{state.theme=${JSON.stringify(removed)};await loadThemes();return document.documentElement.dataset.theme})`
      ),
      "dark"
    );
  }
  // Search: the magnifier opens a line under the toolbar, closing it clears it.
  assert.equal(await evaluate("document.querySelector('#searchBox').hidden"), true);
  await evaluate("document.querySelector('#searchBtn').click()");
  assert.equal(
    await evaluate(
      "!document.querySelector('#searchBox').hidden && document.activeElement.id === 'search' && document.querySelector('#searchBtn').getAttribute('aria-expanded')"
    ),
    "true"
  );
  await evaluate(
    "document.querySelector('#search').value='x';document.querySelector('#search').dispatchEvent(new Event('input'))"
  );
  await evaluate("document.querySelector('#searchBtn').click()");
  assert.equal(
    await evaluate(
      "document.querySelector('#searchBox').hidden && document.querySelector('#search').value === '' && document.activeElement.id"
    ),
    "searchBtn"
  );
  await evaluate(
    "document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))"
  );
  assert.equal(await evaluate("document.activeElement.id"), "search");
  await evaluate("document.querySelector('#searchBtn').click()");
  // Fortune Cookie bar: turned on in the theme panel, closed until midnight by
  // its cross, brought back by "Refresh statuses".
  assert.equal(await evaluate("document.querySelector('#fortuneBar').hidden"), true);
  await evaluate(
    "{localStorage.removeItem('dashmon.fortuneClosed');const s=document.querySelector('#fortuneSelect');s.value='on';s.dispatchEvent(new Event('change'))}"
  );
  await wait(600);
  assert.equal(
    await evaluate(
      "!document.querySelector('#fortuneBar').hidden && document.querySelector('#fortuneText').textContent.length > 0"
    ),
    true
  );
  await evaluate("document.querySelector('#fortuneCloseBtn').click()");
  assert.equal(await evaluate("document.querySelector('#fortuneBar').hidden"), true);
  assert.match(
    await evaluate("localStorage.getItem('dashmon.fortuneClosed')"),
    /^\d{4}-\d{2}-\d{2}$/
  );
  await evaluate("document.querySelector('#menuRefreshBtn').click()");
  assert.equal(await evaluate("document.querySelector('#fortuneBar').hidden"), false);
  await evaluate(
    "{const s=document.querySelector('#fortuneSelect');s.value='off';s.dispatchEvent(new Event('change'))}"
  );
  assert.equal(await evaluate("document.querySelector('#fortuneBar').hidden"), true);
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
  assert.equal(await evaluate("document.querySelectorAll('.settings-category').length"), 5);
  await evaluate("document.querySelector('.settings-branch summary').click()");
  assert.equal(
    await evaluate("document.querySelector('[data-panel=servicesPanel]').getClientRects().length"),
    0
  );
  await evaluate("document.querySelector('.settings-branch summary').click()");
  // Layout of the settings: one control height, nothing wider than its panel,
  // a title on each panel, the empty image list on one line.
  for (const panel of [
    "webLinksPanel",
    "hostsPanel",
    "imagesPanel",
    "themePanel",
    "preferencesPanel"
  ]) {
    await evaluate(`document.querySelector('[data-panel=${panel}]').click()`);
    await wait(150);
    assert.deepEqual(
      await evaluate(
        `[...new Set([...document.querySelectorAll('#${panel} :is(.edit-input,.edit-select,.action-btn,.square-btn)')].filter(e=>e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().height)))]`
      ),
      [38],
      panel
    );
    assert.equal(
      await evaluate(
        `(()=>{const p=document.querySelector('#${panel}');const r=p.getBoundingClientRect();return p.scrollWidth<=p.clientWidth&&[...p.querySelectorAll('*')].every(e=>e.getBoundingClientRect().right<=r.right+1)})()`
      ),
      true,
      panel
    );
    assert.notEqual(
      await evaluate(`document.querySelector('#${panel} .settings-panel-title').textContent`),
      "",
      panel
    );
  }
  assert.ok(
    (await evaluate(
      "document.querySelector('.image-manager-empty')?.getBoundingClientRect().height"
    )) < 40
  );
  // In every list the icon button sits left of the name.
  await evaluate(
    "document.querySelector('[data-panel=categoriesPanel]').click();document.querySelector('#addCategoryBtn').click()"
  );
  for (const [panel, row] of [
    ["dashboardsPanel", ".dashboard-row"],
    ["categoriesPanel", ".category-row"],
    ["hostsPanel", ".host-row"],
    ["webLinksPanel", ".web-link-row"]
  ]) {
    await evaluate(`document.querySelector('[data-panel=${panel}]').click()`);
    assert.equal(
      await evaluate(
        `(()=>{const r=document.querySelector('#${panel} ${row}');const i=r.querySelector('.icon-picker').getBoundingClientRect();const n=r.querySelector('.edit-input').getBoundingClientRect();return i.right<=n.left&&Math.abs(i.top-n.top)<2})()`
      ),
      true,
      panel
    );
  }
  // Every field of the settings has a name of its own: a placeholder is not a
  // label, it disappears as soon as something is typed.
  for (const panel of [
    "servicesPanel",
    "dashboardsPanel",
    "categoriesPanel",
    "hostsPanel",
    "webLinksPanel",
    "preferencesPanel"
  ]) {
    await evaluate(`document.querySelector('[data-panel=${panel}]').click()`);
    assert.deepEqual(
      await evaluate(
        `[...document.querySelectorAll('#${panel} :is(input:not([type=hidden]),select,textarea)')].filter(e=>e.getClientRects().length&&!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels.length||e.title)).map(e=>e.id||e.className)`
      ),
      [],
      panel
    );
  }
  assert.equal(await evaluate("document.querySelectorAll('h1').length"), 1);
  await evaluate(
    "import('/js/state.js').then(({state})=>{state.editCategories.pop()}).then(()=>import('/js/editor/categories.js')).then(({renderCategoryEditor})=>renderCategoryEditor())"
  );
  // Row trash buttons: a 38 px square without a word, named for screen readers.
  await evaluate("document.querySelector('[data-panel=hostsPanel]').click()");
  assert.deepEqual(
    await evaluate(
      "(()=>{const b=document.querySelector('#hostsPanel .delete-btn');const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),b.textContent.trim(),!!b.getAttribute('aria-label')]})()"
    ),
    [38, 38, "", true]
  );
  // The image of an application is a square tile at the start of its card.
  await evaluate(
    "document.querySelector('[data-panel=servicesPanel]').click();document.querySelector('#addServiceBtn').click()"
  );
  assert.deepEqual(
    await evaluate(
      "(()=>{const c=document.querySelector('.service-row:last-child');const b=c.querySelector('.service-image-btn');const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),c.firstElementChild===b,r.left<c.querySelector('.service-field').getBoundingClientRect().left]})()"
    ),
    [64, 64, true, true]
  );
  // Small buttons carry no word; monitoring is a dot with an info bubble.
  assert.deepEqual(
    await evaluate(
      "(()=>{const c=document.querySelector('.service-row:last-child');const m=c.querySelector('.monitor-toggle');const w=c.querySelector('.widget-config-btn');const h=c.querySelector('.monitor-help');return [m.textContent.trim(),!!m.querySelector('.monitor-dot'),!!m.getAttribute('aria-label'),w.textContent.trim(),Math.round(w.getBoundingClientRect().width),!!h.title,h.nextElementSibling===m]})()"
    ),
    ["", true, true, "", 38, true, true]
  );
  await evaluate(
    "import('/js/state.js').then(({state})=>{state.editServices.pop()}).then(()=>import('/js/editor/services.js')).then(({renderServiceEditor})=>renderServiceEditor())"
  );
  // Theme and preferences are two entries of the Appearance branch.
  await evaluate("document.querySelector('[data-panel=preferencesPanel]').click()");
  assert.equal(
    await evaluate(
      "!!document.querySelector('#preferencesPanel #languageSelect') && !document.querySelector('#preferencesPanel #themeSelect')"
    ),
    true
  );
  assert.equal(
    await evaluate("getComputedStyle(document.querySelector('.editor-footer')).display"),
    "none"
  );
  await evaluate("document.querySelector('[data-panel=themePanel]').click()");
  assert.equal(
    await evaluate(
      "!!document.querySelector('#themePanel #themeSelect') && document.querySelector('#themePanel').getClientRects().length > 0"
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
    await evaluate(`(()=>{
    const button = [...document.querySelectorAll('#localHostEditor button')]
      .find(b => b.textContent === 'Add directory' || b.textContent === 'Ajouter un répertoire');
    if (!button) return false;
    button.scrollIntoView();
    return button.getBoundingClientRect().height > 0 && getComputedStyle(button).visibility !== 'hidden';
  })()`),
    true,
    "repertoires : bouton Ajouter visible"
  );
  await evaluate(`(()=>{
    const button = [...document.querySelectorAll('#localHostEditor button')]
      .find(b => b.textContent === 'Add directory' || b.textContent === 'Ajouter un répertoire');
    button.click();
    for (const [name, value] of [['directorySizesName','Films'],['directorySizesPath','/srv/media']]) {
      const input = document.querySelector('#localHostEditor [name='+name+']');
      input.value = value;
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  })()`);
  assert.deepEqual(
    await evaluate(`import('/js/state.js').then(({state})=>
    state.editHosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local').monitoring.directorySizes.entries
  )`),
    [{ name: "Films", path: "/srv/media" }]
  );
  await evaluate(`(()=>{
    [...document.querySelectorAll('#localHostEditor button')]
      .find(b => b.textContent === 'Add directory' || b.textContent === 'Ajouter un répertoire').click();
    const row = document.querySelector('#localHostEditor .directory-setting:last-child');
    for (const [name,value] of [['directorySizesName','Archives'],['directorySizesPath','/srv/backups']]) {
      const input = row.querySelector('[name='+name+']');
      input.value = value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    row.querySelector('[data-move="-1"]').click();
  })()`);
  assert.deepEqual(
    await evaluate(`import('/js/state.js').then(({state})=>
      state.editHosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local').monitoring.directorySizes.entries.map(e=>e.name))`),
    ["Archives", "Films"],
    "repertoires : monter conserve les valeurs"
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#localHostEditor .directory-setting [data-move=\"-1\"]').disabled"
    ),
    true
  );
  await evaluate(
    "document.querySelector('#localHostEditor .directory-setting [data-move=\"1\"]').click()"
  );
  assert.deepEqual(
    await evaluate(`import('/js/state.js').then(({state})=>
      state.editHosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local').monitoring.directorySizes.entries.map(e=>e.name))`),
    ["Films", "Archives"],
    "repertoires : descendre conserve les valeurs"
  );
  // Directory rows stay inside a narrow panel, including the icon controls.
  assert.equal(
    await evaluate(`(()=>{
    const list = document.querySelector('#localHostEditor .directory-settings-list');
    list.style.width = '240px';
    const valid = list.scrollWidth <= list.clientWidth;
    list.style.width = '';
    return valid;
  })()`),
    true,
    "repertoires : parametres sans debordement"
  );
  await evaluate(`(()=>{
    while(document.querySelector('#localHostEditor .directory-setting .delete-btn'))
      document.querySelector('#localHostEditor .directory-setting .delete-btn').click();
  })()`);
  assert.equal(
    await evaluate("!!document.querySelector('#localHostEditor [name=directorySizesPath]')"),
    false
  );
  assert.deepEqual(
    await evaluate(`import('/js/supervision/directory-card.js').then(({directoryCard})=>{
    const card = directoryCard({}, {updatedAt:1700000000,directories:[
      {name:'Un nom de répertoire très long '.repeat(10),path:'/srv/media',bytes:1024,capacity:4096},
      {path:'/srv/backups/'+'dossier'.repeat(100),bytes:0,capacity:4096},
      {name:'Absent',path:'/srv/missing',bytes:null,capacity:null}
    ]});
    card.style.cssText='position:fixed;top:0;left:0;width:220px';
    document.body.append(card);
    const rows=[...card.querySelectorAll('.directory-summary')];
    const result = {
      fits: card.scrollWidth <= card.clientWidth && [...card.querySelectorAll('*')].every(e=>
        e.getBoundingClientRect().right <= card.getBoundingClientRect().right+1),
      sizes:rows.map(r=>r.lastElementChild.textContent),
      bars:card.querySelectorAll('[role=progressbar]').length,
      percent:card.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),
      unknown:card.querySelectorAll('.supervision-track.unknown').length,
      detailsHidden:!card.textContent.includes('capacity')&&!card.textContent.includes('capacité')&&
        !card.textContent.includes('25%')&&!card.querySelector('.supervision-smart-updated'),
      path:rows[0].firstElementChild.title
    };
    card.remove();
    return result;
  })`),
    {
      fits: true,
      sizes: ["1 kB", "0 B", "—"],
      bars: 2,
      percent: "25",
      unknown: 1,
      detailsHidden: true,
      path: "/srv/media"
    },
    "repertoires : tuile epuree, accesible et sans debordement a 220 px"
  );
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
  // Icon of the local supervision tab, chosen from the host form.
  assert.equal(
    await evaluate(
      "document.querySelector('#localHostPanel .settings-panel-title .icon-picker-current i').className"
    ),
    "fa-solid fa-chart-simple"
  );
  await evaluate(
    "(()=>{const p=document.querySelector('#localHostPanel .settings-panel-title .icon-picker');p.querySelector('.icon-picker-current').click();[...p.querySelectorAll('.icon-choice')].find(c=>c.querySelector('i').className==='fa-solid fa-house').click()})()"
  );
  // The settings tree repeats the chosen tab icon.
  assert.equal(
    await evaluate("document.querySelector('[data-panel=localHostPanel] i').className"),
    "fa-solid fa-house"
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
  await evaluate(
    "(()=>{const s=document.querySelector('#localHostEditor [name=speedtestInterval]');s.value='15';s.dispatchEvent(new Event('change',{bubbles:true}));})()"
  );
  for (const name of ["wireguard", "speedtest", "smart", "aptUpdates", "opencode", "claude"]) {
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
      "fetch('/api/config').then(r=>r.json()).then(c=>{const host=c.hosts.find(h=>h.monitoring?.enabled&&h.monitoring.type==='local');return {name:host.name,tab:host.tabIcon,wireguard:host.monitoring.wireguard.enabled,speedtest:host.monitoring.speedtest,smart:host.monitoring.smart,apt:host.monitoring.aptUpdates.enabled,opencode:host.monitoring.opencode.enabled,claude:host.monitoring.claude.enabled}})"
    ),
    {
      name: "Hote principal",
      tab: "fa-solid fa-house",
      wireguard: false,
      speedtest: { enabled: false, interval: 15, server: "" },
      smart: { enabled: false, disks: ["/dev/sdb"] },
      apt: false,
      opencode: false,
      claude: false
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
  await evaluate(
    "(()=>{const p=document.querySelector('#remoteAgentPanel .settings-panel-title .icon-picker');p.querySelector('.icon-picker-current').click();[...p.querySelectorAll('.icon-choice')].find(c=>c.querySelector('i').className==='fa-solid fa-network-wired').click()})()"
  );

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
    "document.querySelector('[data-panel=themePanel]').click();document.querySelector('#settingsAgentTree button').click()"
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
  // The tab icons are saved by this dashboard and dress the navigation.
  assert.equal(
    await evaluate(
      `fetch('/api/config').then(r=>r.json()).then(c=>c.replication.agentIcons[new URL(${JSON.stringify(agentBase)}).href])`
    ),
    "fa-solid fa-network-wired"
  );
  assert.deepEqual(
    await evaluate(
      `["local",new URL(${JSON.stringify(agentBase)}).href].map(id=>document.querySelector('.page-btn[data-supervision-instance-id="'+id+'"] i')?.className)`
    ),
    ["fa-solid fa-house", "fa-solid fa-network-wired"]
  );
  await evaluate(
    "document.querySelector('[data-panel=servicesPanel]').click(); document.querySelector('#addServiceBtn').click(); document.querySelector('[data-panel=themePanel]').click(); document.querySelector('#closeBtn').click()"
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
