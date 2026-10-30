// Dashboard host inventory: names, icons and colours; monitoring has its own form.
import { renderCategoryEditor } from "./categories.js";
import { t } from "../i18n.js";
import { state } from "../state.js";
import { hostEditor, editorHostFilter, addHostBtn } from "../dom.js";
import { blankMonitoring } from "./host-monitoring-draft.js";
import { renderServiceEditor } from "./services.js";
import { createHostIconPicker } from "./icon-picker.js";
import { confirmDelete } from "../editor.js";
import { createColorPicker } from "./color-picker.js";
import { makeDraggable } from "./drag.js";
import { setIconLabel } from "./labelled-button.js";

export function refreshColorEditors() {
  renderCategoryEditor();
  renderHostEditor();
}

export function monitoringField(labelText, control) {
  const field = document.createElement("label");
  field.className = "host-monitor-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  field.append(span, control);
  return field;
}

export function renderHostEditor() {
  hostEditor.innerHTML = "";

  state.editHosts.forEach((host, index) => {
    if (!host.monitoring || typeof host.monitoring !== "object")
      host.monitoring = blankMonitoring();
    if (!host.monitoring.wireguard || typeof host.monitoring.wireguard !== "object") {
      host.monitoring.wireguard = { enabled: true, interface: "" };
    }
    if (!host.monitoring.smart || typeof host.monitoring.smart !== "object") {
      host.monitoring.smart = { enabled: true, disks: [] };
    }
    if (!host.monitoring.aptUpdates || typeof host.monitoring.aptUpdates !== "object") {
      host.monitoring.aptUpdates = { enabled: true };
    }

    const item = document.createElement("div");
    item.className = "host-item";

    const row = document.createElement("div");
    row.className = "host-row";

    const drag = document.createElement("div");
    drag.className = "drag-handle";
    drag.title = t("move");
    drag.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("hostName");
    name.value = host.name || "";
    name.addEventListener("input", () => {
      const previous = state.editHosts[index].name;
      const next = name.value;
      state.editHosts[index].name = next;
      state.editServices.forEach(service => {
        if (service.host === previous) service.host = next;
      });
      renderServiceEditor();
    });

    const picker = createHostIconPicker(host, index);

    const remove = document.createElement("button");
    remove.className = "small-icon-btn delete-btn";
    remove.type = "button";
    remove.title = t("deleteLabel");
    setIconLabel(remove, "fa-solid fa-trash", t("deleteLabel"));
    remove.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteHost")))) return;
      const removedName = state.editHosts[index].name;
      state.editHosts.splice(index, 1);
      state.editServices.forEach(service => {
        if (service.host === removedName) service.host = "";
      });
      if (editorHostFilter.value === removedName) editorHostFilter.value = "";
      renderHostEditor();
      renderServiceEditor();
    });

    if (host.monitoring.enabled && host.monitoring.type === "local") {
      remove.disabled = true;
      remove.title = t("localHostRequired");
    }
    row.append(drag, name, picker, createColorPicker(host, refreshColorEditors), remove);
    item.appendChild(row);

    makeDraggable(row, state.editHosts, index, () => {
      renderHostEditor();
      renderServiceEditor();
    });
    hostEditor.appendChild(item);
  });
}

// Creates a host draft, renders it and puts the cursor on its name. Used by
// the "Add host" button and by pairing when no host exists.
export function createHostDraft() {
  // Monitoring disabled by default: several "local" hosts would monitor the
  // same machine, and a new host must measure nothing until the user asks for
  // it.
  const newHost = {
    id: "host-" + Math.random().toString(36).slice(2, 12),
    name: t("newHost"),
    icon: "fa-solid fa-server",
    monitoring: blankMonitoring()
  };
  state.editHosts.push(newHost);
  renderHostEditor();
  renderServiceEditor();

  requestAnimationFrame(() => {
    const rows = [...hostEditor.querySelectorAll(".host-row")];
    const row = rows[rows.length - 1];
    const input = row?.querySelector(".edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  });
  return newHost;
}

addHostBtn.addEventListener("click", createHostDraft);
