// Host card: health summary, CPU / RAM / disk bars, temperature, and system
// details when expanded.
import {
  isMissing,
  percentText,
  temperatureText,
  metricSeverity,
  temperatureSeverity,
  bytesText
} from "./format.js";
import { t } from "../i18n.js";
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { state } from "../state.js";

// A metric bar: a label, a track filled to the value, a number. The severity
// class does not depend on the theme (the fill stays readable).
function metricRow(label, value) {
  const row = document.createElement("div");
  row.className = "supervision-metric";

  const key = document.createElement("span");
  key.className = "supervision-metric-label";
  key.textContent = label;

  const track = document.createElement("span");
  track.className = "supervision-track";
  const fill = document.createElement("span");
  fill.className = "supervision-fill";
  const n = isMissing(value) ? NaN : Number(value);
  if (Number.isFinite(n)) {
    fill.style.width = Math.max(0, Math.min(100, n)) + "%";
    fill.classList.add(n >= 90 ? "high" : n >= 70 ? "warn" : "ok");
  } else {
    track.classList.add("unknown");
  }
  track.appendChild(fill);

  const amount = document.createElement("span");
  amount.className = "supervision-metric-value";
  amount.textContent = percentText(value);

  row.append(key, track, amount);
  return row;
}

function temperatureRow(value) {
  const row = document.createElement("div");
  row.className = "supervision-row";
  const n = isMissing(value) ? NaN : Number(value);
  if (Number.isFinite(n)) row.classList.add(n >= 75 ? "high" : n >= 60 ? "warn" : "ok");
  const key = document.createElement("span");
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-temperature-half";
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = t("supervisionTemperature");
  key.append(icon, text);
  const content = document.createElement("span");
  content.textContent = temperatureText(value);
  row.append(key, content);
  return row;
}

function hostHealth(metrics) {
  const core = Math.max(
    metricSeverity(metrics.cpu),
    metricSeverity(metrics.ram),
    metricSeverity(metrics.disk)
  );
  // Temperature is not provided by every source, so its absence does not make
  // an otherwise complete card look vague.
  const highest = Math.max(core, temperatureSeverity(metrics.temperature));
  if (core < 0)
    return {
      level: "unknown",
      label: "supervisionHealthUnknown",
      icon: "fa-solid fa-circle-question"
    };
  if (highest === 2)
    return {
      level: "critical",
      label: "supervisionHealthCritical",
      icon: "fa-solid fa-triangle-exclamation"
    };
  if (highest === 1)
    return {
      level: "warning",
      label: "supervisionHealthWarning",
      icon: "fa-solid fa-circle-exclamation"
    };
  return { level: "healthy", label: "supervisionHealthHealthy", icon: "fa-solid fa-circle-check" };
}

function hostDetailRow(label, value) {
  const row = document.createElement("div");
  row.className = "supervision-host-detail-row";
  const key = document.createElement("span");
  key.textContent = label;
  const content = document.createElement("span");
  content.textContent = value;
  row.append(key, content);
  return row;
}

export function hostCard(host, metrics) {
  const card = document.createElement("article");
  card.className = "supervision-card supervision-card-host";
  applyHostColor(card, host);

  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  icon.className = host.icon || "fa-solid fa-server";
  icon.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "supervision-name";
  // The title names the card; the host name stays visible as a badge to tell
  // several hosts apart in the grid.
  name.textContent = t("supervisionHostTitle");
  const badge = document.createElement("span");
  badge.className = "supervision-type";
  badge.textContent = host.name || t("hostName");
  const details =
    metrics &&
    metrics.ok &&
    [metrics.os, metrics.cpuModel, metrics.cpuCores, metrics.ramTotal].some(
      value => !isMissing(value)
    );
  let chevron = null;
  if (details) {
    card.classList.add("has-details");
    const key = cardKey(host);
    card.dataset.hostKey = key;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    const expanded = isExpanded("supervisionHostExpanded", key);
    card.classList.toggle("expanded", expanded);
    card.setAttribute("aria-expanded", String(expanded));
    chevron = document.createElement("i");
    chevron.className = "fa-solid fa-chevron-down supervision-host-chevron";
    chevron.setAttribute("aria-hidden", "true");
  }
  head.append(icon, name, badge);
  if (chevron) head.appendChild(chevron);
  card.appendChild(head);

  if (metrics && metrics.ok) {
    const health = hostHealth(metrics);
    card.classList.add("is-" + health.level);
    const overview = document.createElement("div");
    overview.className = "supervision-health";
    const state = document.createElement("span");
    state.className = "supervision-health-state";
    const stateIcon = document.createElement("i");
    stateIcon.className = health.icon;
    stateIcon.setAttribute("aria-hidden", "true");
    const stateText = document.createElement("strong");
    stateText.textContent = t(health.label);
    state.append(stateIcon, stateText);
    overview.append(state);
    card.appendChild(overview);

    const rows = document.createElement("div");
    rows.className = "supervision-rows";
    rows.append(
      metricRow(t("supervisionCpu"), metrics.cpu),
      metricRow(t("supervisionRam"), metrics.ram),
      metricRow(t("supervisionDisk"), metrics.disk),
      temperatureRow(metrics.temperature)
    );
    card.appendChild(rows);
    if (details) {
      const detailRows = document.createElement("div");
      detailRows.className = "supervision-host-details";
      if (metrics.os) detailRows.appendChild(hostDetailRow(t("supervisionOs"), metrics.os));
      if (metrics.cpuModel) {
        const cores = Number(metrics.cpuCores);
        const suffix =
          Number.isFinite(cores) && cores > 0
            ? " · " +
              t(cores === 1 ? "supervisionCpuCore" : "supervisionCpuCores").replace(
                "{count}",
                String(cores)
              )
            : "";
        detailRows.appendChild(hostDetailRow(t("supervisionCpuModel"), metrics.cpuModel + suffix));
      } else if (metrics.cpuCores) {
        detailRows.appendChild(hostDetailRow(t("supervisionCpuCores"), String(metrics.cpuCores)));
      }
      if (metrics.ramTotal)
        detailRows.appendChild(
          hostDetailRow(t("supervisionRamTotal"), bytesText(metrics.ramTotal))
        );
      card.appendChild(detailRows);
      const toggleDetails = () => {
        const expanded = card.classList.toggle("expanded");
        setExpanded("supervisionHostExpanded", key, expanded);
        card.setAttribute("aria-expanded", String(expanded));
        updateSmartCollapseButton();
      };
      card.addEventListener("click", toggleDetails);
      card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleDetails();
      });
    }
  } else {
    card.classList.add("is-unreachable");
    const error = document.createElement("p");
    error.className = "supervision-error";
    error.textContent = metrics && metrics.error ? metrics.error : t("supervisionUnreachable");
    card.appendChild(error);
  }
  return card;
}
