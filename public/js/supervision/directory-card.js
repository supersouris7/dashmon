import { applyHostColor } from "./cards.js";
import { bytesText, reportDateText } from "./format.js";
import { t } from "../i18n.js";

export function directoryCard(host, report) {
  const card = document.createElement("article");
  card.className = "supervision-card supervision-card-directories";
  applyHostColor(card, host);
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
    item.append(track);
    card.append(item);
  }
  return card;
}
