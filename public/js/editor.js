// Settings dialog: opening and closing, tabs, save (with conflict and
// missing-host checks), configuration import / export. Each panel lives in
// editor/.
import { state } from "./state.js";
import { normalizeConfig } from "./config/normalize.js";
import { clone } from "./util.js";
import { t, applyLanguage } from "./i18n.js";
import { saveConfig, fetchConfig, configConflict } from "./api.js";
import { saveViewPrefs } from "./view-prefs.js";
import { render } from "./render.js";
import {
  updateViewButton,
  updateIconsButton,
  updateOpenModeMenu,
  updateGroupModeMenu,
  updateSortModeMenu
} from "./dashboard/view-controls.js";
import { renderPageSwitch } from "./pages.js";
import { renderSupervision } from "./supervision.js";
import { applyTheme } from "./themes.js";
import { renderImageManager } from "./images.js";
import { createConfirmDialog } from "./editor/confirm-dialog.js";
import { agentUrl, replicationEntries } from "./editor/replication-draft.js";
import { renderPairingEditor } from "./editor/pairing.js";
import { prepareEditorDraft } from "./editor/draft.js";
import { renderAptUpdatesEditor } from "./editor/apt.js";
import { renderWireguardEditor, renderSmartEditor } from "./editor/monitoring.js";
import {
  editorSearch,
  editorCategoryFilter,
  editorHostFilter,
  modalBackdrop,
  editorTitle,
  closeBtn,
  cancelBtn,
  saveBtn,
  exportConfigBtn,
  importConfigBtn,
  configImportInput,
  importExportStatus,
  replicationEditor
} from "./dom.js";
import { closeWidgetConfig } from "./editor/widget-config.js";
import { renderServiceEditor } from "./editor/services.js";
import { renderWebLinksEditor } from "./editor/web-links.js";
import { renderWidgetsEditor } from "./editor/widgets.js";
import { renderCategoryEditor } from "./editor/categories.js";
import { renderDashboardEditor } from "./editor/dashboards.js";
import { monitoringField, renderHostEditor, createHostDraft } from "./editor/hosts.js";

const saveStatus = document.getElementById("saveStatus");
const confirmBackdrop = document.getElementById("confirmBackdrop");
const confirmDialog = createConfirmDialog({
  backdrop: confirmBackdrop,
  icon: document.getElementById("confirmIcon"),
  title: document.getElementById("confirmTitle"),
  message: document.getElementById("confirmMessage"),
  actions: document.getElementById("confirmActions")
});
const openConfirm = confirmDialog.open;
let editorBaseline = "";
let replicationAtOpen = null;
let pairingDraft = null;
let editorSaving = false;

function editorSnapshot() {
  return JSON.stringify({
    services: state.editServices,
    categories: state.editCategories,
    dashboards: state.editDashboards,
    hosts: state.editHosts,
    webLinks: state.editWebLinks,
    specialTile: state.editSpecialTile,
    replication: state.replication,
    pairingDraft
  });
}

export function confirmDelete(message) {
  return openConfirm({
    title: t("confirmDeleteTitle"),
    message,
    actions: [
      { id: "cancel", label: t("cancelBtn") },
      { id: "confirm", label: t("deleteLabel"), className: "action-btn danger" }
    ]
  }).then(result => result === "confirm");
}

function showSaveStatus() {
  saveStatus.replaceChildren();
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-circle-check";
  icon.setAttribute("aria-hidden", "true");
  saveStatus.append(icon, document.createTextNode(t("settingsSaved")));
}

function clearSaveStatus() {
  saveStatus.replaceChildren();
}

const SUPERVISION_PANELS = [
  "hostsPanel",
  "replicationPanel",
  "wireguardPanel",
  "smartPanel",
  "aptUpdatesPanel"
];

// The same dialog serves two purposes: "Edit Dashmon" (every tab) and "Edit
// supervision" (hosts, pairing and local probes). Unused tabs are hidden
// rather than duplicating the form and its save.
function applyEditorMode(mode) {
  const supervision = mode === "supervision";
  modalBackdrop.dataset.mode = supervision ? "supervision" : "all";
  // WireGuard and SMART only belong to the supervision editor; the "Edit
  // Dashmon" dialog never shows them.
  const visible = panel =>
    supervision
      ? SUPERVISION_PANELS.includes(panel)
      : panel !== "replicationPanel" &&
        panel !== "wireguardPanel" &&
        panel !== "smartPanel" &&
        panel !== "aptUpdatesPanel";
  const tabs = [...document.querySelectorAll(".edit-tab")];
  tabs.forEach(tab => {
    tab.hidden = !visible(tab.dataset.panel);
    tab.classList.remove("active");
  });
  document.querySelectorAll(".edit-panel").forEach(panel => {
    panel.hidden = !visible(panel.id);
    panel.classList.remove("active");
  });
  const target = supervision ? "hostsPanel" : "servicesPanel";
  tabs.forEach(tab => {
    if (tab.dataset.panel === target && !tab.hidden) tab.classList.add("active");
  });
  document.getElementById(target).classList.add("active");
  editorTitle.textContent = t(supervision ? "editSupervisionTitle" : "editDashboardTitle");
}

export function openEditor(mode = "all") {
  const rect = document.querySelector(".toolbar").getBoundingClientRect();
  document.documentElement.style.setProperty("--toolbar-h", Math.max(0, rect.bottom) + "px");
  state.editServices = clone(state.services);
  state.editCategories = clone(state.categories);
  state.editDashboards = clone(state.dashboards);
  state.editHosts = clone(state.hosts);
  state.editWebLinks = clone(state.webLinks);
  state.editSpecialTile = clone(state.specialTile);
  state.replication = normalizeConfig({ replication: state.replication }).replication;
  replicationAtOpen = clone(state.replication);
  editorSearch.value = "";
  editorCategoryFilter.value = "";
  editorHostFilter.value = "";
  renderServiceEditor();
  renderCategoryEditor();
  renderDashboardEditor();
  renderHostEditor();
  renderWebLinksEditor();
  renderWidgetsEditor();
  renderReplicationEditor();
  applyEditorMode(mode);
  clearSaveStatus();
  editorBaseline = editorSnapshot();
  modalBackdrop.classList.add("show");
  modalBackdrop.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

export function closeEditor() {
  clearSaveStatus();
  modalBackdrop.classList.remove("show");
  modalBackdrop.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  closeWidgetConfig();
  document.querySelectorAll(".icon-picker.open").forEach(p => p.classList.remove("open"));
}

function discardEditor() {
  if (replicationAtOpen) state.replication = clone(replicationAtOpen);
  closeEditor();
}

export function dismissConfirm() {
  confirmDialog.cancel();
}

export function requestCloseEditor() {
  if (!modalBackdrop.classList.contains("show")) return;
  if (confirmDialog.isOpen()) {
    confirmDialog.cancel();
    return;
  }
  if (editorSnapshot() === editorBaseline) {
    closeEditor();
    return;
  }
  openConfirm({
    title: t("unsavedTitle"),
    message: t("unsavedMessage"),
    actions: [
      { id: "cancel", label: t("cancelBtn") },
      { id: "discard", label: t("discardBtn"), className: "action-btn danger" },
      { id: "save", label: t("saveBtn"), className: "action-btn primary" }
    ]
  }).then(async result => {
    if (result === "discard") discardEditor();
    else if (result === "save") {
      const saved = await applyEditorChanges();
      if (saved) closeEditor();
    }
  });
}

function renderReplicationEditor() {
  if (!pairingDraft) pairingDraft = replicationEntries(state.replication || {});
  renderPairingEditor({
    container: replicationEditor,
    entries: pairingDraft,
    createHostDraft,
    activateEditorPanel,
    confirmDelete,
    monitoringField
  });
}

// Applies the right rendering without leaving the settings: the dashboard
// and the supervision page have different renderers.
function renderLive() {
  if (state.page === "supervision") renderSupervision();
  else render();
  renderPageSwitch();
}

function refreshEditorDrafts() {
  state.editServices = clone(state.services);
  state.editCategories = clone(state.categories);
  state.editDashboards = clone(state.dashboards);
  state.editHosts = clone(state.hosts);
  state.editWebLinks = clone(state.webLinks);
  state.editSpecialTile = clone(state.specialTile);
  pairingDraft = replicationEntries(state.replication);
  renderServiceEditor();
  renderCategoryEditor();
  renderDashboardEditor();
  renderHostEditor();
  renderWireguardEditor();
  renderSmartEditor();
  renderAptUpdatesEditor();
  renderWebLinksEditor();
  renderWidgetsEditor();
  renderReplicationEditor();
}

let importedConfigDraft = null;

importConfigBtn.addEventListener("click", () => configImportInput.click());

configImportInput.addEventListener("change", async () => {
  const file = configImportInput.files && configImportInput.files[0];
  configImportInput.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const imported = normalizeConfig(raw);

    if (!Array.isArray(raw.services) || !Array.isArray(raw.categories)) {
      throw new Error("Structure invalide");
    }

    // The import stays a draft until the user clicks "Apply": nothing is
    // overwritten on the server and nothing visible changes before.
    importedConfigDraft = imported;
    state.editServices = clone(imported.services);
    state.editCategories = clone(imported.categories);
    state.editDashboards = clone(imported.dashboards);
    state.editHosts = clone(imported.hosts);
    state.editWebLinks = clone(imported.webLinks);
    state.editSpecialTile = clone(imported.specialTile);
    renderServiceEditor();
    renderCategoryEditor();
    renderDashboardEditor();
    renderHostEditor();
    renderWebLinksEditor();
    renderWidgetsEditor();
    importExportStatus.textContent = t("importReady");
  } catch (error) {
    console.error("Import de configuration impossible", error);
    alert("Fichier de configuration invalide.");
  }
});

exportConfigBtn.addEventListener("click", async () => {
  try {
    const config = await fetchConfig();
    const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dashmon-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export de la configuration impossible", error);
    alert("Export de la configuration impossible.");
  }
});

// Activates an editor tab. Pairing rereads the host list each time it opens:
// a host created meanwhile must appear without reopening the dialog.
function activateEditorPanel(panelId) {
  const tabs = [...document.querySelectorAll(".edit-tab")];
  const tab = tabs.find(elm => elm.dataset.panel === panelId);
  if (!tab) return;
  tabs.forEach(elm => elm.classList.remove("active"));
  document.querySelectorAll(".edit-panel").forEach(panel => panel.classList.remove("active"));
  tab.classList.add("active");
  document.getElementById(panelId)?.classList.add("active");
  if (panelId === "imagesPanel") renderImageManager();
  if (panelId === "replicationPanel") renderReplicationEditor();
}

document.querySelectorAll(".edit-tab").forEach(tab => {
  tab.addEventListener("click", () => activateEditorPanel(tab.dataset.panel));
});

closeBtn.addEventListener("click", requestCloseEditor);
cancelBtn.addEventListener("click", requestCloseEditor);
modalBackdrop.addEventListener("click", e => {
  if (e.target === modalBackdrop) requestCloseEditor();
});

async function applyEditorChanges() {
  if (editorSaving) return false;
  editorSaving = true;
  clearSaveStatus();
  try {
    const {
      dashboards: cleanedDashboards,
      categories: cleanedCategories,
      hosts: cleanedHosts,
      services: cleanedServices,
      webLinks: cleanedWebLinks,
      specialTile: cleanedSpecialTile,
      removedNames
    } = prepareEditorDraft(state);

    // A pairing without host cannot take a colour or icon. Warn before writing,
    // and offer to create the missing host without losing the address and name
    // already typed.
    const cleanedHostIds = new Set(cleanedHosts.map(h => h.id));
    const pairsMissingHost = (state.replication?.secondaries || []).filter(url => {
      const hostId = state.replication?.agentHosts?.[url];
      return !hostId || !cleanedHostIds.has(hostId);
    });
    if (modalBackdrop.dataset.mode === "supervision" && pairsMissingHost.length) {
      const choice = await openConfirm({
        title: t("agentHostRequiredTitle"),
        message: t("agentHostRequiredMessage"),
        icon: "fa-triangle-exclamation",
        actions: [
          { id: "create", label: t("agentHostCreate"), className: "action-btn primary" },
          { id: "save", label: t("agentHostSaveAnyway") },
          { id: "cancel", label: t("cancelBtn") }
        ]
      });
      if (choice === "cancel") return false;
      if (choice === "create") {
        const host = createHostDraft();
        // The first incomplete pairing takes the created host: it only remains to
        // name it, then save.
        state.replication.agentHosts = state.replication.agentHosts || {};
        state.replication.agentHosts[pairsMissingHost[0]] = host.id;
        const draft = pairingDraft?.find(entry => agentUrl(entry.url) === pairsMissingHost[0]);
        if (draft) draft.host = host.id;
        activateEditorPanel("hostsPanel");
        return false;
      }
    }
    // References to a deleted host are not kept.
    if (state.replication) {
      const agentHosts = {};
      for (const [url, hostId] of Object.entries(state.replication.agentHosts || {})) {
        if (cleanedHostIds.has(hostId)) agentHosts[url] = hostId;
      }
      state.replication.agentHosts = agentHosts;
    }
    state.services = cleanedServices;
    state.categories = cleanedCategories;
    state.dashboards = cleanedDashboards;
    state.hosts = cleanedHosts;
    state.webLinks = cleanedWebLinks;
    state.specialTile = cleanedSpecialTile;

    // Fields without a form in the editor come from the imported file. View
    // preferences stay specific to the browser.
    if (importedConfigDraft) {
      state.webLinksColor = importedConfigDraft.webLinksColor;
      state.theme = importedConfigDraft.theme;
      state.language = importedConfigDraft.language;
      state.usageCounts = { ...importedConfigDraft.usageCounts };
    }

    // The active dashboard may have been deleted or renamed: bring it back to an
    // existing dashboard before redrawing.
    if (!state.dashboards.some(d => d.id === state.dashboardId)) {
      state.dashboardId = state.dashboards[0].id;
      saveViewPrefs({ dashboardId: state.dashboardId });
    }

    const validCollapsedKeys = new Set([
      ...state.categories.map(c => `category:${c.name}`),
      ...state.hosts.map(h => `host:${h.name}`),
      ...state.categories.map(c => c.name)
    ]);
    state.collapsed = Object.fromEntries(
      Object.entries(state.collapsed).filter(([name]) => validCollapsedKeys.has(name))
    );
    // Collapsed sections are a view preference: they live in the browser, not in
    // config.json.
    saveViewPrefs({ collapsed: state.collapsed });

    const saved = await saveConfig(true, { replaceUsage: !!importedConfigDraft });
    if (!saved) {
      // Never close the editor silently: without this guard, the interface showed
      // the deletion although the file had not been written.
      alert(t(configConflict ? "configConflict" : "saveError"));
      return false;
    }
    // Use the canonical URLs at once, as the next page load would.
    state.replication = normalizeConfig({ replication: state.replication }).replication;
    pairingDraft = replicationEntries(state.replication);
    replicationAtOpen = clone(state.replication);
    if (importedConfigDraft) {
      applyTheme();
      applyLanguage();
      updateViewButton();
      updateIconsButton();
      updateOpenModeMenu();
      updateGroupModeMenu();
      updateSortModeMenu();
      importedConfigDraft = null;
    }
    renderLive();
    // Read the config back as a page reload would. If a deleted application is
    // still there, the write did not reach the server (another tab, a second
    // instance, a proxy). Say so at once instead of letting the tile reappear
    // after a refresh.
    if (removedNames.length) {
      try {
        const persisted = normalizeConfig(await fetchConfig());
        const persistedNames = new Set(persisted.services.map(service => service.name));
        const stuck = removedNames.filter(name => persistedNames.has(name));
        if (stuck.length) {
          alert(t("saveNotPersisted").replace("{names}", stuck.join(", ")));
        }
      } catch (_error) {}
    }
    refreshEditorDrafts();
    editorBaseline = editorSnapshot();
    showSaveStatus();
    return true;
  } finally {
    editorSaving = false;
  }
}

saveBtn.addEventListener("click", applyEditorChanges);

let editorSearchTimer = null;
editorSearch.addEventListener("input", () => {
  clearTimeout(editorSearchTimer);
  editorSearchTimer = setTimeout(renderServiceEditor, 150);
});
