// Dashboards panel.
import { dashboardEditor, addDashboardBtn } from "../dom.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { renderCategoryEditor } from "./categories.js";
import { createDashboardIconPicker } from "./icon-picker.js";
import { confirmDelete } from "../editor.js";
import { makeDraggable } from "./drag.js";
import { setIconLabel } from "./labelled-button.js";

// Dashboards editor: name and icon, in tab order. Deleting a dashboard
// deletes no category: its categories join the first remaining dashboard, so
// no service is ever lost. Removing the last dashboard is refused (there is
// always one).
export function renderDashboardEditor() {
  dashboardEditor.innerHTML = "";

  state.editDashboards.forEach((dashboard, index) => {
    const row = document.createElement("div");
    row.className = "dashboard-row";

    const drag = document.createElement("div");
    drag.className = "drag-handle";
    drag.title = t("move");
    drag.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("dashboardName");
    name.value = dashboard.name || "";
    name.addEventListener("input", () => {
      state.editDashboards[index].name = name.value;
      renderCategoryEditor();
    });

    const picker = createDashboardIconPicker(dashboard, index);

    const remove = document.createElement("button");
    remove.className = "small-icon-btn delete-btn";
    remove.type = "button";
    remove.title = t("deleteLabel");
    setIconLabel(remove, "fa-solid fa-trash", t("deleteLabel"));
    remove.addEventListener("click", async () => {
      if (state.editDashboards.length <= 1) return;
      if (!(await confirmDelete(t("deleteDashboardConfirm")))) return;
      const removedId = state.editDashboards[index].id;
      state.editDashboards.splice(index, 1);
      const fallbackId = state.editDashboards[0].id;
      state.editCategories.forEach(category => {
        if (category.dashboardId === removedId) category.dashboardId = fallbackId;
      });
      renderDashboardEditor();
      renderCategoryEditor();
    });

    row.append(drag, name, picker, remove);
    makeDraggable(row, state.editDashboards, index, () => {
      renderDashboardEditor();
      renderCategoryEditor();
    });
    dashboardEditor.appendChild(row);
  });
}

addDashboardBtn.addEventListener("click", () => {
  const newDashboard = {
    id: "dashboard-" + Math.random().toString(36).slice(2, 12),
    name: t("newDashboard"),
    icon: "fa-solid fa-grip"
  };
  state.editDashboards.push(newDashboard);
  renderDashboardEditor();
  renderCategoryEditor();

  requestAnimationFrame(() => {
    const rows = [...dashboardEditor.querySelectorAll(".dashboard-row")];
    const row = rows[rows.length - 1];
    const input = row?.querySelector(".edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  });
});
