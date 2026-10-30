// SMART card: disk health from the report written by deploy/smart-dump.sh,
// with a diagnosis per value.
import { smartNumberText, handshakeAge, relativeAge } from "./format.js";
import { t } from "../i18n.js";
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { state } from "../state.js";

function smartFact(label, value, warning = false) {
  const fact = document.createElement("span");
  const n = Number(value);
  fact.className = "supervision-smart-fact";
  if (warning && Number.isFinite(n) && n > 0) fact.classList.add("warn");
  fact.textContent = label + " " + smartNumberText(value);
  return fact;
}

function smartDiagnosis(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { text: "—", className: "" };
  if (key === "hours")
    return n >= 50000
      ? { text: t("smartHigh"), className: "warn" }
      : { text: t("smartGood"), className: "up" };
  if (key === "temperature")
    return n < 40
      ? { text: t("smartVeryGood"), className: "up" }
      : n < 50
        ? { text: t("smartGood"), className: "up" }
        : { text: t("smartHot"), className: "warn" };
  if (key === "load")
    return n >= 100000
      ? { text: t("smartWatch"), className: "warn" }
      : { text: t("smartGood"), className: "up" };
  return n === 0
    ? { text: t("smartGood"), className: "up" }
    : { text: t("smartWatch"), className: "warn" };
}

function smartDetailRow(label, value, key) {
  const row = document.createElement("div");
  row.className = "supervision-smart-detail-row";
  const name = document.createElement("span");
  name.textContent = label;
  const amount = document.createElement("span");
  amount.textContent = smartNumberText(value);
  const diagnosis = smartDiagnosis(key, value);
  const diagnostic = document.createElement("span");
  diagnostic.className = "supervision-smart-detail-diagnostic " + diagnosis.className;
  diagnostic.textContent = diagnosis.text;
  row.append(name, amount, diagnostic);
  return row;
}

export function visibleSmartDisks(host, metrics) {
  if (!metrics || !metrics.ok || !Array.isArray(metrics.smart) || !metrics.smart.length) return [];
  const prefs = host.monitoring && host.monitoring.smart;
  if (prefs && prefs.enabled === false) return [];
  const wanted = prefs && Array.isArray(prefs.disks) ? prefs.disks : [];
  return wanted.length ? metrics.smart.filter(disk => wanted.includes(disk.device)) : metrics.smart;
}

export function smartCard(host, metrics, disks) {
  const card = document.createElement("article");
  card.className = "supervision-card supervision-card-smart";
  applyHostColor(card, host);
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  const key = cardKey(host);
  card.dataset.smartKey = key;
  const expanded = isExpanded("supervisionSmartExpanded", key);
  card.setAttribute("aria-expanded", String(expanded));
  if (expanded) card.classList.add("expanded");
  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-database";
  icon.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "supervision-name";
  name.textContent = t("supervisionSmartTitle");
  const badge = document.createElement("span");
  badge.className = "supervision-type";
  badge.textContent = t("supervisionSmart");
  const chevron = document.createElement("i");
  chevron.className = "fa-solid fa-chevron-down supervision-smart-chevron";
  chevron.setAttribute("aria-hidden", "true");
  head.append(icon, name, badge, chevron);
  card.appendChild(head);

  const age = handshakeAge(metrics.smartFetchedAt);
  if (age !== null) {
    const updated = document.createElement("p");
    updated.className = "supervision-smart-updated";
    updated.textContent = t("supervisionSmartUpdated").replace("{ago}", relativeAge(age));
    card.appendChild(updated);
  }

  // The whole card toggles: the chevron is a visual cue, not a tiny target.
  // Enter and Space cover the keyboard too.
  const toggleDetails = () => {
    const expanded = card.classList.toggle("expanded");
    setExpanded("supervisionSmartExpanded", key, expanded);
    card.setAttribute("aria-expanded", String(expanded));
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggleDetails);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleDetails();
  });

  disks.forEach(disk => {
    const section = document.createElement("section");
    section.className = "supervision-smart-disk";
    const title = document.createElement("div");
    title.className = "supervision-smart-title";
    const label = document.createElement("span");
    label.textContent = disk.device;
    const passed = disk.passed === true ? "passed" : disk.passed === false ? "failed" : "unknown";
    const status = document.createElement("span");
    status.className = "supervision-smart-status " + passed;
    status.setAttribute("role", "img");
    status.setAttribute(
      "aria-label",
      passed === "passed"
        ? t("supervisionSmartPassed")
        : passed === "failed"
          ? t("supervisionSmartFailed")
          : t("supervisionSmartUnknown")
    );
    status.title = status.getAttribute("aria-label");
    title.append(status, label);
    section.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "supervision-smart-summary";
    const uptime = document.createElement("span");
    uptime.className = "supervision-smart-uptime";
    uptime.textContent = smartNumberText(disk.powerOnHours) + " h";
    const years = document.createElement("small");
    years.textContent = Number.isFinite(Number(disk.powerOnHours))
      ? (Number(disk.powerOnHours) / 8766)
          .toFixed(1)
          .replace(".", state.language === "fr" ? "," : ".") +
        (state.language === "fr" ? " ans" : " years")
      : "—";
    const temperature = document.createElement("span");
    temperature.className = "supervision-smart-temperature";
    temperature.textContent = Number.isFinite(Number(disk.temperature))
      ? Math.round(Number(disk.temperature)) + " °C"
      : "—";
    summary.append(uptime, years, temperature);
    section.appendChild(summary);

    const facts = document.createElement("div");
    facts.className = "supervision-smart-facts";
    facts.append(
      smartFact(t("smartReallocatedShort"), disk.reallocated, true),
      smartFact(t("smartPendingShort"), disk.pending, true),
      smartFact(t("smartUncorrectableShort"), disk.uncorrectable, true),
      smartFact(t("smartSataCrcShort"), disk.sataCrc, true),
      smartFact(t("smartErrorsShort"), disk.smartErrors, true),
      smartFact(t("smartLoadCycleShort"), disk.loadCycle)
    );
    section.appendChild(facts);

    const details = document.createElement("div");
    details.className = "supervision-smart-details";
    if (disk.model) {
      const model = document.createElement("p");
      model.className = "supervision-smart-model";
      model.textContent = disk.model;
      details.appendChild(model);
    }
    const statusText = document.createElement("p");
    statusText.className = "supervision-smart-full-status " + passed;
    statusText.textContent =
      passed === "passed"
        ? t("supervisionSmartPassed")
        : passed === "failed"
          ? t("supervisionSmartFailed")
          : t("supervisionSmartUnknown");
    details.append(
      statusText,
      smartDetailRow(t("smartReallocated"), disk.reallocated, "error"),
      smartDetailRow(t("smartPending"), disk.pending, "error"),
      smartDetailRow(t("smartUncorrectable"), disk.uncorrectable, "error"),
      smartDetailRow(t("smartSataCrc"), disk.sataCrc, "error"),
      smartDetailRow(t("smartErrors"), disk.smartErrors, "error"),
      smartDetailRow(t("smartLoadCycle"), disk.loadCycle, "load"),
      smartDetailRow(t("smartPowerHours"), disk.powerOnHours, "hours"),
      smartDetailRow(t("smartTemperature"), disk.temperature, "temperature")
    );
    section.appendChild(details);
    card.appendChild(section);
  });
  return card;
}
