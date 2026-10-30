import { state } from "./state.js";
import { t } from "./i18n.js";

// Les options concernent uniquement l'affichage du rapport local. Le script
// et son intervalle restent configures sur l'hote, hors de l'application.
export function renderAptUpdatesEditor() {
  const list = document.getElementById("aptUpdatesEditor");
  if (!list) return;
  list.replaceChildren();
  const help = document.createElement("p");
  help.className = "wireguard-help-text";
  help.append(document.createTextNode(t("aptUpdatesHelp") + " "));
  const doc = document.createElement("a");
  doc.href = "https://github.com/supersouris7/dashmon/blob/main/docs/APT_UPDATES.md";
  doc.target = "_blank";
  doc.rel = "noopener";
  doc.textContent = t("aptUpdatesHelpDoc");
  help.appendChild(doc);
  list.appendChild(help);
  state.editHosts.forEach((host, index) => {
    if (!host.monitoring?.enabled || host.monitoring.type !== "local") return;
    const block = document.createElement("div");
    block.className = "host-monitor-panel wireguard-editor-item";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "monitor-toggle " + (host.monitoring.aptUpdates.enabled ? "active" : "");
    toggle.setAttribute("aria-pressed", String(host.monitoring.aptUpdates.enabled));
    toggle.innerHTML = '<i class="fa-solid fa-box"></i>';
    toggle.addEventListener("click", () => {
      state.editHosts[index].monitoring.aptUpdates.enabled =
        !state.editHosts[index].monitoring.aptUpdates.enabled;
      renderAptUpdatesEditor();
    });
    const field = document.createElement("label");
    field.className = "host-monitor-field";
    const label = document.createElement("span");
    label.textContent = (host.name || t("hostName")) + " · " + t("aptUpdatesShow");
    field.append(label, toggle);
    block.appendChild(field);
    const hint = document.createElement("p");
    hint.className = "host-monitor-hint";
    hint.textContent = t("aptUpdatesHint");
    block.appendChild(hint);
    list.appendChild(block);
  });
}
