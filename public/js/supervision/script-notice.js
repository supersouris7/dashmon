// Notice at the bottom of a card whose report comes from an older host
// script (lib/host/script-versions.js): the command that replaces it, to copy,
// and the guide. Clicks inside never fold the card.
import { t } from "../i18n.js";

const RAW = "https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/";
const GUIDE = "https://github.com/supersouris7/dashmon/blob/main/docs/SCRIPTS.md";

// Same command for every script (docs/SCRIPTS.md).
export function scriptCommand(name) {
  const target = `/usr/local/bin/dashmon-${name}.sh`;
  return `sudo curl -fsSL ${RAW}${name}.sh -o ${target} && sudo chmod 755 ${target}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// metrics.scriptUpdates: { aptUpdates: "apt-updates", ... }. null when the
// script of this card is up to date.
export function scriptNotice(metrics, field) {
  const name = metrics?.scriptUpdates?.[field];
  if (typeof name !== "string" || !/^[a-z][a-z-]{0,40}$/.test(name)) return null;
  const box = element("div", "script-notice");
  for (const type of ["click", "keydown"])
    box.addEventListener(type, event => event.stopPropagation());

  const title = element("p", "script-notice-title");
  const icon = element("i", "fa-solid fa-circle-exclamation");
  icon.setAttribute("aria-hidden", "true");
  const guide = element("a", "", t("scriptGuide"));
  guide.href = GUIDE;
  guide.target = "_blank";
  guide.rel = "noopener noreferrer";
  title.append(icon, element("strong", "", t("scriptOutdated")), guide);

  const command = scriptCommand(name);
  const line = element("div", "script-notice-command");
  const code = element("code", "", command);
  const copy = element("button", "small-icon-btn", "");
  copy.type = "button";
  copy.title = t("scriptCopy");
  copy.setAttribute("aria-label", t("scriptCopy"));
  const copyIcon = element("i", "fa-regular fa-copy");
  copyIcon.setAttribute("aria-hidden", "true");
  copy.append(copyIcon);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(command);
      copyIcon.className = "fa-solid fa-check";
    } catch (_error) {
      // No clipboard (plain HTTP): select the command for a manual copy.
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
  line.append(code, copy);
  box.append(title, line);
  return box;
}
