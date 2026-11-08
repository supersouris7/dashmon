// Notice at the bottom of a card whose report comes from an older host
// script (lib/host/script-versions.js): the short command that updates every
// script of the machine, to copy, the setup tool install in case it is
// missing, and the guide. Clicks inside never fold
// the card. commandLine() is also used by the settings help.
import { t } from "../i18n.js";
import { SETUP_INSTALL_COMMAND, UPDATE_COMMAND } from "./script-commands.js";

const GUIDE = "https://github.com/supersouris7/dashmon/blob/main/docs/SCRIPTS.md";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A command in a code block with a copy button.
export function commandLine(command) {
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
  return line;
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
  // Hosts installed before the setup tool: install it first.
  const missing = element("details", "script-notice-setup");
  missing.append(
    element("summary", "", t("scriptSetupMissing")),
    commandLine(SETUP_INSTALL_COMMAND)
  );
  box.append(
    title,
    element("p", "script-notice-hint", t("scriptUpdateAllHint")),
    commandLine(UPDATE_COMMAND),
    missing
  );
  return box;
}
