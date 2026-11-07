import { applyHostColor } from "./cards.js";
import { bytesText, reportDateText } from "./format.js";
import { t } from "../i18n.js";

export function directoryCard(host, report) {
  const card = document.createElement("article");
  card.className = "supervision-card";
  applyHostColor(card, host);
  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-folder-open";
  icon.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "supervision-name";
  title.textContent = t("directorySizesTitle");
  head.append(icon, title);
  card.append(head);
  for (const directory of report.directories.slice(0, 50)) {
    const row = document.createElement("div");
    row.className = "supervision-host-detail-row";
    const name = document.createElement("span");
    name.textContent = directory.path;
    name.style.overflowWrap = "anywhere";
    const size = document.createElement("span");
    size.textContent =
      Number.isSafeInteger(directory.bytes) && directory.bytes >= 0
        ? bytesText(directory.bytes)
        : t("directorySizesError");
    row.append(name, size);
    card.append(row);
  }
  if (report.updatedAt) {
    const date = document.createElement("p");
    date.className = "supervision-smart-updated";
    date.textContent = reportDateText(report.updatedAt);
    card.append(date);
  }
  return card;
}
