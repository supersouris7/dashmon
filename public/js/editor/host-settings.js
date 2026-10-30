// Same monitoring form for the primary and agents; only their save differs.
import { t } from "../i18n.js";

export function renderHostSettings(container, { config, metrics, onRename = () => {} }) {
  container.replaceChildren();
  const form = document.createElement("div");
  form.className = "host-settings";
  const monitoring = config.monitoring;
  const saveHint = document.createElement("p");
  saveHint.className = "host-monitor-hint";
  saveHint.textContent = t("hostSettingsSaveHint");
  form.appendChild(saveHint);
  function section(key, icon) {
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
    control.maxLength = key === "agentHostName" ? 100 : key === "smartDisks" ? 2000 : 200;
    if (placeholder) control.placeholder = t(placeholder);
    control.addEventListener("input", () => change(control.value));
    field(box, key, control);
    return control;
  }
  function toggle(box, key, label) {
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
    const text = document.createElement("p");
    text.className = "host-monitor-hint";
    text.textContent = t(key);
    const doc = document.createElement("a");
    doc.href = "https://github.com/supersouris7/dashmon/blob/main/docs/" + file;
    doc.target = "_blank";
    doc.rel = "noopener noreferrer";
    doc.textContent = t("agentDocumentation");
    details.append(summary, text, doc);
    box.appendChild(details);
  }
  const general = section("hostGeneral", "fa-solid fa-server");
  input(general, "agentHostName", config.name, value => {
    config.name = value;
    onRename(value);
  });
  input(
    general,
    "hostDiskPath",
    monitoring.path,
    value => {
      monitoring.path = value;
    },
    "phDiskPath"
  );
  const diskHint = document.createElement("p");
  diskHint.className = "host-monitor-hint";
  diskHint.textContent = t("hostLocalHint");
  general.appendChild(diskHint);

  const wg = section("tabWireguard", "fa-solid fa-dragon");
  toggle(wg, "wireguard", "wireguardShowPeers");
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

  const smart = section("tabSmart", "fa-solid fa-database");
  toggle(smart, "smart", "smartShowDisks");
  const disks = input(
    smart,
    "smartDisks",
    (monitoring.smart?.disks || []).join(", "),
    value => {
      monitoring.smart = {
        ...monitoring.smart,
        disks: [
          ...new Set(
            value
              .split(/[,\n]/)
              .map(item => item.trim())
              .filter(Boolean)
          )
        ].slice(0, 20)
      };
      renderChoices();
    },
    "phSmartDisks"
  );
  const choices = document.createElement("div");
  choices.className = "smart-disk-choices";
  const detected = [
    ...new Set(
      (Array.isArray(metrics?.smart) ? metrics.smart : []).map(item => item?.device).filter(Boolean)
    )
  ];
  function renderChoices() {
    choices.replaceChildren();
    if (!detected.length) return;
    const label = document.createElement("span");
    label.textContent = t("smartDetectedDisks");
    choices.appendChild(label);
    for (const device of detected) {
      const selectedDisks = monitoring.smart?.disks || [];
      const selected = !selectedDisks.length || selectedDisks.includes(device);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "smart-disk-choice" + (selected ? " active" : "");
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = device;
      button.addEventListener("click", () => {
        monitoring.smart = {
          ...monitoring.smart,
          disks: !selectedDisks.length
            ? detected.filter(value => value !== device)
            : selected
              ? selectedDisks.filter(value => value !== device)
              : [...selectedDisks, device].slice(0, 20)
        };
        disks.value = monitoring.smart.disks.join(", ");
        renderChoices();
      });
      choices.appendChild(button);
    }
  }
  renderChoices();
  smart.appendChild(choices);
  help(smart, "smartHelpIntro", "SMART.md");

  const apt = section("tabAptUpdates", "fa-solid fa-box");
  toggle(apt, "aptUpdates", "aptUpdatesShow");
  help(apt, "aptUpdatesHelp", "APT_UPDATES.md");
  container.appendChild(form);
}
