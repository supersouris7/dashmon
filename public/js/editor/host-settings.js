// Same monitoring form for the primary and agents; only their save differs.
import { t } from "../i18n.js";
import { SPEEDTEST_DEFAULT_INTERVAL, SPEEDTEST_INTERVALS } from "../config/normalize.js";
import { moveItem } from "./drag.js";
import { setIconButton, setDeleteIcon } from "./icon-button.js";

function hint(key) {
  const text = document.createElement("p");
  text.className = "host-monitor-hint";
  text.textContent = t(key);
  return text;
}

function section(form, key, icon) {
  const box = document.createElement("fieldset");
  box.className = "host-settings-section";
  const legend = document.createElement("legend");
  const symbol = document.createElement("i");
  symbol.className = icon;
  symbol.setAttribute("aria-hidden", "true");
  legend.append(symbol, document.createTextNode(" " + t(key)));
  box.appendChild(legend);
  form.appendChild(box);
  return box;
}

function field(box, key, control) {
  const label = document.createElement("label");
  label.className = "host-monitor-field";
  const text = document.createElement("span");
  text.textContent = t(key);
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

function help(box, key, file) {
  const details = document.createElement("details");
  details.className = "host-settings-help";
  const summary = document.createElement("summary");
  summary.textContent = t("hostSetupGuide");
  const doc = document.createElement("a");
  doc.href = "https://github.com/supersouris7/dashmon/blob/main/docs/" + file;
  doc.target = "_blank";
  doc.rel = "noopener noreferrer";
  doc.textContent = t("agentDocumentation");
  details.append(summary, hint(key), doc);
  box.appendChild(details);
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

function wireguardSection(form, monitoring) {
  const wg = section(form, "tabWireguard", "fa-solid fa-dragon");
  toggle(wg, monitoring, "wireguard", "wireguardShowPeers");
  input(
    wg,
    "wireguardInterface",
    monitoring.wireguard?.interface,
    value => {
      monitoring.wireguard = { ...monitoring.wireguard, interface: value };
    },
    "phWireguardInterface"
  );
  help(wg, "wireguardHelpIntro", "WIREGUARD.md");
}

// List filter (SMART disks): typed by hand, or picked
// among the names the host reported. An empty list means the default set.
function filterSection(form, monitoring, spec) {
  const box = section(form, spec.title, spec.icon);
  toggle(box, monitoring, spec.key, spec.show);
  const choices = document.createElement("div");
  choices.className = "smart-disk-choices";
  const detected = [...new Set(spec.detected.filter(Boolean))];
  const selection = () => monitoring[spec.key]?.[spec.field] || [];
  const update = list => {
    monitoring[spec.key] = { ...monitoring[spec.key], [spec.field]: list.slice(0, spec.max) };
  };
  const text = input(
    box,
    spec.input,
    selection().join(", "),
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
    },
    spec.placeholder
  );
  function renderChoices() {
    choices.replaceChildren();
    if (!detected.length) return;
    const label = document.createElement("span");
    label.textContent = t(spec.detectedLabel);
    choices.appendChild(label);
    for (const name of detected) {
      const current = selection();
      const selected = spec.isDefault
        ? current.length
          ? current.includes(name)
          : spec.isDefault(name)
        : !current.length || current.includes(name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "smart-disk-choice" + (selected ? " active" : "");
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = name;
      button.addEventListener("click", () => {
        // From the default set, the first click turns it into an explicit list.
        const base = current.length
          ? current
          : detected.filter(value => (spec.isDefault ? spec.isDefault(value) : true));
        update(selected ? base.filter(value => value !== name) : [...base, name]);
        text.value = selection().join(", ");
        renderChoices();
      });
      choices.appendChild(button);
    }
  }
  renderChoices();
  box.appendChild(choices);
  help(box, spec.helpKey, spec.file);
}

function smartSection(form, monitoring, metrics) {
  filterSection(form, monitoring, {
    title: "tabSmart",
    icon: "fa-solid fa-database",
    key: "smart",
    field: "disks",
    show: "smartShowDisks",
    input: "smartDisks",
    placeholder: "phSmartDisks",
    detectedLabel: "smartDetectedDisks",
    detected: (Array.isArray(metrics?.smart) ? metrics.smart : []).map(item => item?.device),
    max: 20,
    helpKey: "smartHelpIntro",
    file: "SMART.md"
  });
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

// Reports with only an on/off switch and a setup guide.
const REPORT_SECTIONS = [
  [
    "tabAptUpdates",
    "fa-solid fa-box",
    "aptUpdates",
    "aptUpdatesShow",
    "aptUpdatesHelp",
    "APT_UPDATES.md"
  ],
  [
    "tabOpencode",
    "fa-solid fa-terminal",
    "opencode",
    "opencodeShow",
    "opencodeHelp",
    "OPENCODE.md"
  ],
  ["tabClaude", "fa-solid fa-code", "claude", "claudeShow", "claudeHelp", "CLAUDE_CODE.md"]
];

export function renderHostSettings(container, { config, metrics, onRename = () => {} }) {
  container.replaceChildren();
  const form = document.createElement("div");
  form.className = "host-settings";
  const monitoring = config.monitoring;
  form.appendChild(hint("hostSettingsSaveHint"));
  generalSection(form, config, onRename);
  wireguardSection(form, monitoring);
  speedtestSection(form, monitoring);
  smartSection(form, monitoring, metrics);
  directorySection(form, monitoring);
  for (const [title, icon, key, label, helpKey, file] of REPORT_SECTIONS) {
    const box = section(form, title, icon);
    toggle(box, monitoring, key, label);
    help(box, helpKey, file);
  }
  container.appendChild(form);
}

function directorySection(form, monitoring) {
  const box = section(form, "directorySizesTitle", "fa-solid fa-folder-open");
  monitoring.directorySizes = {
    enabled: monitoring.directorySizes?.enabled !== false,
    entries: monitoring.directorySizes?.entries || []
  };
  toggle(box, monitoring, "directorySizes", "directorySizesShow");
  const list = document.createElement("div");
  list.className = "directory-settings-list";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "action-btn";
  add.textContent = t("directorySizesAdd");
  function render() {
    list.replaceChildren();
    for (const [index, entry] of monitoring.directorySizes.entries.entries()) {
      const row = document.createElement("div");
      row.className = "directory-setting";
      input(row, "directorySizesName", entry.name, value => {
        entry.name = value;
      });
      const path = input(row, "directorySizesPath", entry.path, value => {
        entry.path = value;
      });
      path.maxLength = 4096;
      path.required = true;
      path.pattern = "/.*";
      const actions = document.createElement("div");
      actions.className = "directory-setting-actions";
      for (const [offset, icon, label] of [
        [-1, "fa-solid fa-arrow-up", "directorySizesUp"],
        [1, "fa-solid fa-arrow-down", "directorySizesDown"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-btn";
        button.dataset.move = String(offset);
        setIconButton(button, icon, t(label));
        const next = index + offset;
        button.disabled = next < 0 || next >= monitoring.directorySizes.entries.length;
        button.addEventListener("click", () => {
          moveItem(monitoring.directorySizes.entries, index, next);
          render();
          const moved = list.children[next];
          const control =
            moved.querySelector(`[data-move="${offset}"]:not(:disabled)`) ||
            moved.querySelector("input");
          control.focus();
        });
        actions.append(button);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "action-btn delete-btn";
      setDeleteIcon(remove, t("deleteLabel"));
      remove.addEventListener("click", () => {
        monitoring.directorySizes.entries = monitoring.directorySizes.entries.filter(
          item => item !== entry
        );
        render();
      });
      actions.append(remove);
      row.append(actions);
      list.append(row);
    }
    add.disabled = monitoring.directorySizes.entries.length >= 50;
  }
  add.addEventListener("click", () => {
    monitoring.directorySizes.entries.push({ name: "", path: "" });
    render();
    list.lastElementChild.querySelector("input").focus();
  });
  render();
  box.append(list, add);
  help(box, "directorySizesHelp", "DIRECTORIES.md");
}
