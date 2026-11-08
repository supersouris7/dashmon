// Directories card: size of the directories chosen in the host settings,
// measured by deploy/directory-sizes.sh (lib/host/directory-report.js). Each
// bar is the share of its disk the directory takes, coloured like the Disk
// bar of the Resources card. Folded: name, bar and size; opened: the path,
// the share of the disk and the date of the report.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { bytesText, metricSeverity, relativeAge, reportDateText } from "./format.js";
import { t } from "../i18n.js";
import {
  directoryErrorKey,
  directoryHealth,
  measured,
  sharePercentText
} from "./directory-health.js";
import { element } from "../element.js";

const directoryError = directory => t(directoryErrorKey(directory));

// Status line text and icon from the state computed in directory-health.js.
function verdictOf(report) {
  const health = directoryHealth(report);
  const label =
    health.key === "directorySizesStale"
      ? t(health.key) + " · " + relativeAge(health.age)
      : t(health.key)
          .replace("{count}", String(health.count))
          .replace("{total}", bytesText(health.total));
  return {
    level: health.level,
    icon:
      health.level === "healthy" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation",
    label
  };
}

function head() {
  const box = element("div", "supervision-head");
  const icon = element("i", "fa-solid fa-folder-open");
  icon.setAttribute("aria-hidden", "true");
  const chevron = element("i", "fa-solid fa-chevron-down supervision-smart-chevron");
  chevron.setAttribute("aria-hidden", "true");
  box.append(
    icon,
    element("span", "supervision-name", t("directorySizesTitle")),
    element("span", "supervision-type", t("directorySizesBadge")),
    chevron
  );
  return box;
}

function healthLine(verdict) {
  const status = element("div", "supervision-health");
  const box = element("span", "supervision-health-state");
  const icon = element("i", verdict.icon);
  icon.setAttribute("aria-hidden", "true");
  box.append(icon, element("strong", "", verdict.label));
  status.appendChild(box);
  return status;
}

function directoryItem(directory) {
  const item = element("div", "directory-usage");
  const row = element("div", "directory-summary");
  const name = element("span", "directory-name", directory.name || directory.path);
  name.title = directory.path;
  const size = element(
    "span",
    "directory-size",
    measured(directory) ? bytesText(directory.bytes) : "—"
  );
  const track = element("div", "supervision-track");
  const fill = element("span", "supervision-fill");
  let share = "";
  if (measured(directory) && Number.isSafeInteger(directory.capacity) && directory.capacity > 0) {
    const percent = Math.min(100, (100 * directory.bytes) / directory.capacity);
    const severity = metricSeverity(percent);
    if (severity === 1) fill.classList.add("warn");
    if (severity === 2) fill.classList.add("high");
    fill.style.width = percent + "%";
    share = `${sharePercentText(percent)} · ${t("directorySizesCapacity")} ${bytesText(directory.capacity)}`;
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", name.textContent);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(percent)));
    track.setAttribute("aria-valuetext", share);
    track.title = share;
  } else {
    track.classList.add("unknown");
    track.setAttribute(
      "aria-label",
      measured(directory) ? name.textContent : directoryError(directory)
    );
    if (!measured(directory)) size.title = directoryError(directory);
  }
  track.append(fill);
  row.append(name, track, size);
  const details = element("div", "directory-details");
  details.append(
    element("div", "", directory.path),
    element("div", "", measured(directory) ? share || "—" : directoryError(directory))
  );
  item.append(row, details);
  return item;
}

export function directoryCard(host, report) {
  const verdict = verdictOf(report);
  const card = element(
    "article",
    "supervision-card supervision-card-directories is-" + verdict.level
  );
  applyHostColor(card, host);
  const key = cardKey(host);
  card.dataset.directoryKey = key;
  card.classList.toggle("expanded", isExpanded("supervisionDirectoryExpanded", key));
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(card.classList.contains("expanded")));
  card.tabIndex = 0;
  const toggle = () => {
    const expanded = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(expanded));
    setExpanded("supervisionDirectoryExpanded", key, expanded);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });

  card.append(head(), healthLine(verdict));
  const list = element("div", "directory-list");
  for (const directory of report.directories.slice(0, 50)) list.append(directoryItem(directory));
  card.append(list);
  if (report.updatedAt) {
    card.append(element("p", "directory-details directory-date", reportDateText(report.updatedAt)));
  }
  return card;
}
