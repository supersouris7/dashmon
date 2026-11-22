// Same monitoring form for the primary and agents; only their save differs.
import { t } from "../i18n.js";
import { state } from "../state.js";
import { listSupervisionPlugins, pluginLabel, pluginString } from "../supervision-registry.js";
import { workingPrefs } from "../config/plugin-prefs.js";
import { withPluginReports } from "../supervision/legacy.js";
import { SPEEDTEST_DEFAULT_INTERVAL, SPEEDTEST_INTERVALS } from "../config/normalize.js";
import { moveItem } from "./drag.js";
import { setIconButton, setDeleteIcon } from "./icon-button.js";
import { commandLine } from "../supervision/script-notice.js";
import {
  SCRIPT_FREQUENCIES,
  AUTO_UPDATE_COMMAND,
  SETUP_INSTALL_COMMAND,
  UPDATE_COMMAND,
  installCommand
} from "../supervision/script-commands.js";

function hint(key) {
  const text = document.createElement("p");
  text.className = "host-monitor-hint";
  text.textContent = t(key);
  return text;
}

// title: an interface text key, or { text } for a label already translated
// (supervision plugins carry their own).
function section(form, key, icon) {
  const box = document.createElement("fieldset");
  box.className = "host-settings-section";
  const legend = document.createElement("legend");
  const symbol = document.createElement("i");
  symbol.className = icon;
  symbol.setAttribute("aria-hidden", "true");
  const title = typeof key === "object" ? key.text : t(key);
  legend.append(symbol, document.createTextNode(" " + title));
  box.appendChild(legend);
  form.appendChild(box);
  return box;
}

// key: an interface text key, or { text } already translated.
function field(box, key, control) {
  const label = document.createElement("label");
  label.className = "host-monitor-field";
  const text = document.createElement("span");
  text.textContent = typeof key === "object" ? key.text : t(key);
  label.append(text, control);
  box.appendChild(label);
}

function input(box, key, value, change, placeholder) {
  const control = document.createElement("input");
  control.className = "edit-input";
  control.name = key;
  control.value = value || "";
  control.maxLength =
    key === "agentHostName"
      ? 100
      : key === "smartDisks"
        ? 2000
        : key === "speedtestServer"
          ? 300
          : 200;
  if (placeholder) control.placeholder = t(placeholder);
  control.addEventListener("input", () => change(control.value));
  field(box, key, control);
  return control;
}

// A report shown or hidden on the supervision page: absent means shown.
function toggle(box, monitoring, key, label) {
  const control = document.createElement("input");
  control.type = "checkbox";
  control.name = key;
  control.checked = monitoring[key]?.enabled !== false;
  control.addEventListener("change", () => {
    monitoring[key] = { ...monitoring[key], enabled: control.checked };
  });
  field(box, label, control);
}

// guide: a file of docs/ or a full https URL (supervision plugin manifest).
function guideLink(file) {
  const doc = document.createElement("a");
  doc.href = /^https:\/\//.test(file)
    ? file
    : "https://github.com/supersouris7/dashmon/blob/main/docs/" + file;
  doc.target = "_blank";
  doc.rel = "noopener noreferrer";
  doc.textContent = t("hostGuideLink");
  return doc;
}

// A folded help block; returns its body, where the content goes.
function helpBox(box, summaryKey) {
  const details = document.createElement("details");
  details.className = "host-settings-help";
  const summary = document.createElement("summary");
  summary.textContent = t(summaryKey);
  const body = document.createElement("div");
  body.className = "host-settings-help-body";
  details.append(summary, body);
  box.appendChild(details);
  return body;
}

// The three schedules the setup tool offers, the recommended one marked.
function frequencyList(script) {
  const list = document.createElement("ul");
  list.className = "script-frequencies";
  for (const { cron, key, recommended } of SCRIPT_FREQUENCIES[script]) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = cron;
    const text = t(key) + (recommended ? ` (${t("scriptRecommended")})` : "");
    item.append(code, document.createTextNode(" " + text));
    if (recommended) item.className = "recommended";
    list.appendChild(item);
  }
  return list;
}

// Setup help of a section; with a host script the setup tool knows, how to
// install it, how often it runs, and how to remove it. intro: a text key, or
// { text } already translated.
function help(box, intro, file, script) {
  const details = helpBox(box, "hostSetupGuide");
  if (typeof intro === "object") {
    const text = hint("hostSetupGuide");
    text.textContent = intro.text;
    details.appendChild(text);
  } else if (intro) details.appendChild(hint(intro));
  if (script && SCRIPT_FREQUENCIES[script]) {
    details.append(
      hint("scriptInstallStep"),
      commandLine(installCommand(script)),
      hint("scriptFrequencies"),
      frequencyList(script),
      hint(
        script === "opencode-stats" || script === "claude-stats" || script === "claude-team"
          ? "scriptCronUser"
          : "scriptCronRoot"
      ),
      hint("scriptRemoveStep"),
      commandLine(`sudo dashmon-setup.sh remove ${script}`)
    );
  }
  if (file) details.appendChild(guideLink(file));
}

// How the host scripts are installed and updated, once for every section.
function scriptsSection(form) {
  const box = section(form, "hostScriptsTitle", "fa-solid fa-scroll");
  box.appendChild(hint("hostScriptsIntro"));
  const details = helpBox(box, "hostScriptsHow");
  details.append(
    hint("hostScriptsSetup"),
    commandLine(SETUP_INSTALL_COMMAND),
    hint("hostScriptsMenu"),
    commandLine("sudo dashmon-setup.sh"),
    hint("hostScriptsUpdate"),
    commandLine(UPDATE_COMMAND),
    hint("hostScriptsAuto"),
    commandLine(AUTO_UPDATE_COMMAND),
    frequencyList("setup"),
    guideLink("SCRIPTS.md")
  );
}

function generalSection(form, config, onRename) {
  const general = section(form, "hostGeneral", "fa-solid fa-server");
  input(general, "agentHostName", config.name, value => {
    config.name = value;
    onRename(value);
  });
  input(
    general,
    "hostDiskPath",
    config.monitoring.path,
    value => {
      config.monitoring.path = value;
    },
    "phDiskPath"
  );
  general.appendChild(hint("hostLocalHint"));
}

// Speed test: on/off, how often, and the server (empty: Cloudflare).
function speedtestSection(form, monitoring) {
  const box = section(form, "tabSpeedtest", "fa-solid fa-gauge-high");
  toggle(box, monitoring, "speedtest", "speedtestShow");
  const select = document.createElement("select");
  select.className = "edit-input";
  select.name = "speedtestInterval";
  for (const minutes of SPEEDTEST_INTERVALS) {
    const option = document.createElement("option");
    option.value = String(minutes);
    option.textContent = t("speedtestEvery" + minutes);
    select.appendChild(option);
  }
  select.value = String(monitoring.speedtest?.interval ?? SPEEDTEST_DEFAULT_INTERVAL);
  select.addEventListener("change", () => {
    monitoring.speedtest = { ...monitoring.speedtest, interval: Number(select.value) };
  });
  field(box, "speedtestInterval", select);
  input(
    box,
    "speedtestServer",
    monitoring.speedtest?.server,
    value => {
      monitoring.speedtest = { ...monitoring.speedtest, server: value.trim() };
    },
    "phSpeedtestServer"
  );
  help(box, "speedtestHelp", "SPEEDTEST.md");
}

// --- Supervision plugins ----------------------------------------------------
// Each installed plugin (supervisions/<id>/) gets a section built from the
// "settings" of its manifest: its switch, its fields, then its setup help.
// Field types: text, choices (a list of names, typed or picked among the ones
// the host reported) and list (records, e.g. a name and a path per row).

function textControl(name, value, maxLength, placeholder, change) {
  const control = document.createElement("input");
  control.className = "edit-input";
  control.name = name;
  control.value = value || "";
  control.maxLength = maxLength;
  if (placeholder) control.placeholder = placeholder;
  control.addEventListener("input", () => change(control.value));
  return control;
}

// Names typed by hand, or picked among the ones of the plugin's report. An
// empty list means "all".
function choicesField(box, prefs, spec, text, report) {
  const detected = spec.detect
    ? [
        ...new Set(
          (Array.isArray(report?.[spec.detect.list]) ? report[spec.detect.list] : [])
            .map(item => item?.[spec.detect.key])
            .filter(value => typeof value === "string" && value)
        )
      ]
    : [];
  const choices = document.createElement("div");
  choices.className = "smart-disk-choices";
  const selection = () => prefs[spec.key] || [];
  const update = list => {
    prefs[spec.key] = list.slice(0, spec.max);
  };
  const control = textControl(
    spec.label || spec.key,
    selection().join(", "),
    2000,
    text(spec.placeholder),
    value => {
      update([
        ...new Set(
          value
            .split(/[,\n]/)
            .map(item => item.trim())
            .filter(Boolean)
        )
      ]);
      renderChoices();
    }
  );
  field(box, { text: text(spec.label) }, control);
  function renderChoices() {
    choices.replaceChildren();
    if (!detected.length) return;
    const label = document.createElement("span");
    label.textContent = text(spec.detectedLabel || "smartDetectedDisks");
    choices.appendChild(label);
    for (const name of detected) {
      const current = selection();
      const selected = !current.length || current.includes(name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "smart-disk-choice" + (selected ? " active" : "");
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = name;
      button.addEventListener("click", () => {
        // From "all", the first click turns it into an explicit list.
        const base = current.length ? current : detected;
        update(selected ? base.filter(value => value !== name) : [...base, name]);
        control.value = selection().join(", ");
        renderChoices();
      });
      choices.appendChild(button);
    }
  }
  renderChoices();
  box.appendChild(choices);
}

function moveButtons(rows, index, render, list, labels) {
  const buttons = [];
  for (const [offset, icon, label] of [
    [-1, "fa-solid fa-arrow-up", labels.up],
    [1, "fa-solid fa-arrow-down", labels.down]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn";
    button.dataset.move = String(offset);
    setIconButton(button, icon, label);
    const next = index + offset;
    button.disabled = next < 0 || next >= rows.length;
    button.addEventListener("click", () => {
      moveItem(rows, index, next);
      render();
      const moved = list.children[next];
      const control =
        moved.querySelector(`[data-move="${offset}"]:not(:disabled)`) ||
        moved.querySelector("input");
      control.focus();
    });
    buttons.push(button);
  }
  return buttons;
}

// Records, one row each, that can be moved and removed.
function listField(box, prefs, spec, text) {
  if (!Array.isArray(prefs[spec.key])) prefs[spec.key] = [];
  const list = document.createElement("div");
  list.className = "directory-settings-list";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "action-btn";
  add.textContent = text(spec.add || "settingsListAdd");
  const labels = {
    up: text(spec.up || "settingsMoveUp"),
    down: text(spec.down || "settingsMoveDown")
  };
  function render() {
    const rows = prefs[spec.key];
    list.replaceChildren();
    for (const [index, entry] of rows.entries()) {
      const row = document.createElement("div");
      row.className = "directory-setting";
      for (const sub of spec.fields) {
        const control = textControl(
          sub.label || sub.key,
          entry[sub.key],
          sub.maxLength,
          "",
          value => {
            entry[sub.key] = value;
          }
        );
        if (sub.required) control.required = true;
        if (sub.type === "path") control.pattern = "/.*";
        field(row, { text: text(sub.label) }, control);
      }
      const actions = document.createElement("div");
      actions.className = "directory-setting-actions";
      actions.append(...moveButtons(rows, index, render, list, labels));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "action-btn delete-btn";
      setDeleteIcon(remove, t("deleteLabel"));
      remove.addEventListener("click", () => {
        prefs[spec.key] = prefs[spec.key].filter(item => item !== entry);
        render();
      });
      actions.append(remove);
      row.append(actions);
      list.append(row);
    }
    add.disabled = rows.length >= spec.max;
  }
  add.addEventListener("click", () => {
    prefs[spec.key].push(Object.fromEntries(spec.fields.map(sub => [sub.key, ""])));
    render();
    list.lastElementChild.querySelector("input").focus();
  });
  render();
  box.append(list, add);
}

// The plugin's settings object inside the host monitoring, every field
// present: its historical key for a former built-in card, plugins.<id>
// otherwise.
function pluginPrefs(monitoring, meta) {
  const key = meta.settings?.key;
  const schema = { id: meta.id, key, fields: meta.settings?.fields || [] };
  const prefs = workingPrefs(key ? monitoring[key] : monitoring.plugins?.[meta.id], schema);
  if (key) monitoring[key] = prefs;
  else monitoring.plugins = { ...monitoring.plugins, [meta.id]: prefs };
  return prefs;
}

function pluginSection(form, monitoring, meta, report) {
  const lang = state.language === "en" ? "en" : "fr";
  const settings = meta.settings || {};
  const text = key => (key ? pluginString(meta, key, lang, t) : "");
  const title = settings.title ? text(settings.title) : pluginLabel(meta, lang);
  const box = section(form, { text: title }, meta.icon || "fa-solid fa-puzzle-piece");
  const prefs = pluginPrefs(monitoring, meta);
  const show = document.createElement("input");
  show.type = "checkbox";
  // Named after the setting it stores: the historical key of a former
  // built-in card, the plugin id otherwise.
  show.name = settings.key || "plugin-" + meta.id;
  show.checked = prefs.enabled !== false;
  show.addEventListener("change", () => {
    prefs.enabled = show.checked;
  });
  field(box, { text: settings.show ? text(settings.show) : t("supervisionPluginShow") }, show);
  for (const spec of settings.fields || []) {
    if (spec.type === "choices") choicesField(box, prefs, spec, text, report);
    else if (spec.type === "list") listField(box, prefs, spec, text);
    else
      field(
        box,
        { text: text(spec.label) },
        textControl(
          spec.label || spec.key,
          prefs[spec.key],
          spec.maxLength,
          text(spec.placeholder),
          value => {
            prefs[spec.key] = value.trim();
          }
        )
      );
  }
  const description = meta.description?.[lang] || meta.description?.fr || "";
  const intro = settings.help ? text(settings.help) : description;
  if (intro || meta.guide || meta.script) help(box, { text: intro }, meta.guide, meta.script);
}

export function renderHostSettings(container, { config, metrics, onRename = () => {} }) {
  container.replaceChildren();
  const form = document.createElement("div");
  form.className = "host-settings";
  const monitoring = config.monitoring;
  form.appendChild(hint("hostSettingsSaveHint"));
  generalSection(form, config, onRename);
  scriptsSection(form);
  speedtestSection(form, monitoring);
  const reports = withPluginReports(metrics)?.plugins || {};
  for (const meta of listSupervisionPlugins())
    pluginSection(form, monitoring, meta, reports[meta.id]);
  container.appendChild(form);
}
