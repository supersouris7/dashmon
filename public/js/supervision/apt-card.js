// APT updates card: last report written by deploy/apt-updates.sh (pending
// updates, security updates, reboot required).
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { t } from "../i18n.js";
import { state } from "../state.js";
import { smartNumberText, reportDateText } from "./format.js";

export function aptUpdatesCard(host, metrics) {
  const report = metrics?.aptUpdates;
  const card = document.createElement("article");
  const failed = report?.status === "failed";
  const updated = Number(report?.updated) || 0;
  const reboot = report?.rebootRequired === true;
  // Same presentation as the host health: an icon and an explicit label rather
  // than a coloured dot. A pending update or a required reboot is a warning,
  // not a failure.
  const health = !report
    ? { level: "unknown", label: "aptUpdatesNoReport", icon: "fa-solid fa-circle-question" }
    : failed
      ? { level: "critical", label: "aptUpdatesFailed", icon: "fa-solid fa-triangle-exclamation" }
      : updated > 0
        ? { level: "warning", label: "aptUpdatesOutdated", icon: "fa-solid fa-circle-exclamation" }
        : reboot
          ? {
              level: "warning",
              label: "aptUpdatesRebootRequired",
              icon: "fa-solid fa-circle-exclamation"
            }
          : { level: "healthy", label: "aptUpdatesUpToDate", icon: "fa-solid fa-circle-check" };
  card.className = "supervision-card supervision-card-apt is-" + health.level;
  applyHostColor(card, host);
  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-box";
  const name = document.createElement("span");
  name.className = "supervision-name";
  name.textContent = t("supervisionAptTitle");
  const badge = document.createElement("span");
  badge.className = "supervision-type";
  badge.textContent = t("supervisionAptUpdates");
  head.append(icon, name, badge);
  // The whole card expands: the summary stays visible, the details (error,
  // dates, reboot) are collapsed by default, like SMART and the host.
  const key = cardKey(host);
  card.dataset.aptKey = key;
  card.classList.add("has-details");
  const expanded = isExpanded("supervisionAptExpanded", key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const chevron = document.createElement("i");
  chevron.className = "fa-solid fa-chevron-down supervision-smart-chevron";
  chevron.setAttribute("aria-hidden", "true");
  head.appendChild(chevron);
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded("supervisionAptExpanded", key, open);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
  card.appendChild(head);

  const status = document.createElement("div");
  status.className = "supervision-health";
  const state = document.createElement("span");
  state.className = "supervision-health-state";
  const stateIcon = document.createElement("i");
  stateIcon.className = health.icon;
  stateIcon.setAttribute("aria-hidden", "true");
  const text = document.createElement("strong");
  text.textContent = t(health.label);
  state.append(stateIcon, text);
  status.appendChild(state);
  card.appendChild(status);
  if (failed) {
    const detail = document.createElement("div");
    detail.className = "supervision-apt-error";
    const summary = document.createElement("strong");
    summary.textContent = t("aptUpdatesErrorDetail");
    const message = document.createElement("pre");
    const step = report.failedStep ? "apt-get " + report.failedStep : "";
    const code = Number.isInteger(report.exitCode) ? " (exit " + report.exitCode + ")" : "";
    message.textContent = [step ? step + code : "", report.error || t("aptUpdatesErrorUnavailable")]
      .filter(Boolean)
      .join("\n");
    detail.append(summary, message);
    card.appendChild(detail);
  }

  if (report) {
    const summary = document.createElement("div");
    summary.className = "supervision-apt-summary";
    const count = document.createElement("strong");
    count.textContent = smartNumberText(updated);
    const label = document.createElement("span");
    label.textContent = t("aptUpdatesPackagesInstalled");
    summary.append(count, label);
    card.appendChild(summary);

    const details = document.createElement("div");
    details.className = "supervision-apt-details";
    const lastRun = document.createElement("div");
    const lastRunLabel = document.createElement("span");
    lastRunLabel.textContent = t("aptUpdatesLastRun");
    const lastRunValue = document.createElement("time");
    lastRunValue.textContent = reportDateText(report.finishedAt);
    lastRun.append(lastRunLabel, lastRunValue);
    const nextRun = document.createElement("div");
    const nextRunLabel = document.createElement("span");
    nextRunLabel.textContent = t("aptUpdatesNextRun");
    const nextRunValue = document.createElement("time");
    const next = Number(report.nextRunAt);
    if (Number.isFinite(next) && next > 0) {
      nextRunValue.textContent = reportDateText(next);
      if (next * 1000 < Date.now()) {
        nextRunValue.classList.add("warning");
        nextRunValue.textContent += " " + t("aptUpdatesOverdue");
      }
    } else {
      nextRunValue.textContent = t("aptUpdatesNextRunUnknown");
    }
    nextRun.append(nextRunLabel, nextRunValue);
    const rebootRow = document.createElement("div");
    const rebootLabel = document.createElement("span");
    rebootLabel.textContent = t("aptUpdatesReboot");
    const rebootValue = document.createElement("span");
    rebootValue.className = reboot ? "warning" : "ok";
    rebootValue.textContent = reboot
      ? report.rebootRequested
        ? t("aptUpdatesRebootRequested")
        : t("aptUpdatesRebootRequired")
      : t("aptUpdatesNoReboot");
    rebootRow.append(rebootLabel, rebootValue);
    details.append(lastRun, nextRun, rebootRow);
    card.appendChild(details);
  } else {
    const details = document.createElement("div");
    details.className = "supervision-apt-details";
    const hint = document.createElement("p");
    hint.className = "supervision-apt-hint";
    hint.textContent = t("aptUpdatesHint");
    details.appendChild(hint);
    card.appendChild(details);
  }
  return card;
}
