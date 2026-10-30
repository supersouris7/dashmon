import { state } from "./state.js";
import { t } from "./i18n.js";
import { agentUrl, serializeReplicationEntries } from "./replication-draft.js";
import { createPairingList } from "./pairing-list.js";

// Le panneau gere uniquement les connexions ; les hotes restent dans leur
// propre inventaire et le brouillon appartient a l'editeur principal.
export function renderPairingEditor({
  container,
  entries,
  createHostDraft,
  activateEditorPanel,
  confirmDelete,
  monitoringField
}) {
  container.replaceChildren();
  for (const key of ["agentIntro", "agentHint"]) {
    const paragraph = document.createElement("p");
    paragraph.className = "host-monitor-hint";
    paragraph.textContent = t(key);
    container.appendChild(paragraph);
  }
  const docs = document.createElement("a");
  docs.href =
    "https://github.com/supersouris7/dashmon/blob/main/docs/DEMARRAGE.md#3-install-an-agent";
  docs.target = "_blank";
  docs.rel = "noopener noreferrer";
  docs.textContent = t("agentDocumentation");
  container.appendChild(docs);
  const integrations = document.createElement("nav");
  integrations.className = "agent-doc-links";
  integrations.setAttribute("aria-label", t("agentIntegrationDocs"));
  const docsLabel = document.createElement("span");
  docsLabel.textContent = t("agentIntegrationDocs") + " :";
  integrations.appendChild(docsLabel);
  for (const [file, label] of [
    ["WIREGUARD.md", "WireGuard"],
    ["SMART.md", "SMART"],
    ["APT_UPDATES.md", "APT"]
  ]) {
    const link = document.createElement("a");
    link.href = "https://github.com/supersouris7/dashmon/blob/main/docs/" + file;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    integrations.appendChild(link);
  }
  container.appendChild(integrations);
  if (!state.replication)
    state.replication = {
      role: "primary",
      instanceName: "Dashmon",
      secondaries: [],
      agentNames: {},
      agentHosts: {}
    };
  if (!state.replication.agentHosts || typeof state.replication.agentHosts !== "object")
    state.replication.agentHosts = {};
  const name = document.createElement("input");
  name.className = "edit-input";
  name.placeholder = t("agentInstanceName");
  name.setAttribute("aria-label", t("agentInstanceName"));
  name.value = state.replication.instanceName || "";
  name.addEventListener("input", () => {
    state.replication.instanceName = name.value;
  });
  container.appendChild(monitoringField(t("agentInstanceName"), name));
  for (const key of ["agentInstanceNameHint", "agentUrlHint"]) {
    const paragraph = document.createElement("p");
    paragraph.className = "host-monitor-hint";
    paragraph.textContent = t(key);
    container.appendChild(paragraph);
  }
  const hostChoices = () => state.editHosts.filter(host => String(host.name || "").trim());
  const validHostIds = new Set(state.editHosts.map(host => String(host.id || "")).filter(Boolean));
  const syncPairs = () =>
    Object.assign(state.replication, serializeReplicationEntries(entries, validHostIds));
  if (entries.length && !hostChoices().length) {
    const empty = document.createElement("p");
    empty.className = "host-monitor-hint";
    empty.append(document.createTextNode(t("agentHostEmpty") + " "));
    const create = document.createElement("button");
    create.type = "button";
    create.className = "action-btn";
    create.textContent = t("agentHostCreate");
    create.addEventListener("click", () => {
      const host = createHostDraft();
      validHostIds.add(host.id);
      const target = entries.find(entry => agentUrl(entry.url) && !entry.host);
      if (target) target.host = host.id;
      syncPairs();
      activateEditorPanel("hostsPanel");
    });
    empty.appendChild(create);
    container.appendChild(empty);
  }
  const list = document.createElement("div");
  list.className = "agent-editor-list";
  const renderPairs = createPairingList({
    list,
    entries,
    hostChoices,
    syncPairs,
    confirmDelete,
    monitoringField,
    setAddDisabled: value => {
      add.disabled = value;
    }
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "action-btn";
  add.innerHTML = '<i class="fa-solid fa-plus"></i>&nbsp; ';
  add.append(document.createTextNode(t("agentAddPair")));
  add.disabled = entries.length >= 20;
  add.addEventListener("click", () => {
    if (entries.length >= 20) return;
    entries.push({ url: "", name: "", host: "" });
    syncPairs();
    renderPairs();
    add.disabled = entries.length >= 20;
    list.lastElementChild?.querySelector("input")?.focus();
  });
  const addRow = document.createElement("div");
  addRow.className = "agent-editor-actions";
  addRow.appendChild(add);
  container.append(list, addRow);
  renderPairs();
}
