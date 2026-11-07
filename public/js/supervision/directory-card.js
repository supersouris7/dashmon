import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { bytesText, reportDateText } from "./format.js";
import { t } from "../i18n.js";

export function directoryCard(host, report) {
  const card = document.createElement("article");
  card.className = "supervision-card supervision-card-directories";
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
  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-folder-open";
  icon.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "supervision-name";
  title.textContent = t("directorySizesTitle");
  if (report.updatedAt) title.title = reportDateText(report.updatedAt);
  head.append(icon, title);
  const chevron = document.createElement("i");
  chevron.className = "fa-solid fa-chevron-down directory-chevron";
  chevron.setAttribute("aria-hidden", "true");
  head.append(chevron);
  card.append(head);
  for (const directory of report.directories.slice(0, 50)) {
    const item = document.createElement("div");
    item.className = "directory-usage";
    const row = document.createElement("div");
    row.className = "directory-summary";
    const name = document.createElement("span");
    name.textContent = directory.name || directory.path;
    name.title = directory.path;
    const size = document.createElement("span");
    size.textContent =
      Number.isSafeInteger(directory.bytes) && directory.bytes >= 0
        ? bytesText(directory.bytes)
        : "—";
    if (size.textContent === "—") size.title = t("directorySizesError");
    row.append(name, size);
    item.append(row);
    const track = document.createElement("div");
    track.className = "supervision-track";
    const fill = document.createElement("span");
    fill.className = "supervision-fill";
    if (
      Number.isSafeInteger(directory.bytes) &&
      directory.bytes >= 0 &&
      Number.isSafeInteger(directory.capacity) &&
      directory.capacity > 0
    ) {
      const percent = Math.min(100, (100 * directory.bytes) / directory.capacity);
      fill.style.width = percent + "%";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", name.textContent);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(Math.round(percent)));
      const detail =
        percent.toFixed(1) +
        "% · " +
        t("directorySizesCapacity") +
        " " +
        bytesText(directory.capacity);
      track.setAttribute("aria-valuetext", detail);
      track.title = detail;
    } else {
      track.classList.add("unknown");
      track.setAttribute("aria-label", t("directorySizesError"));
    }
    track.append(fill);
    row.insertBefore(track, size);
    const details = document.createElement("div");
    details.className = "directory-details";
    const path = document.createElement("div");
    path.textContent = directory.path;
    const capacity = document.createElement("div");
    capacity.textContent = track.title || t("directorySizesError");
    details.append(path, capacity);
    item.append(details);
    card.append(item);
  }
  if (report.updatedAt) {
    const date = document.createElement("p");
    date.className = "directory-details directory-date";
    date.textContent = reportDateText(report.updatedAt);
    card.append(date);
  }
  return card;
}
