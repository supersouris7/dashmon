// Categories panel: name, icon, colour and dashboard of each category.
import { categoryEditor, addCategoryBtn } from "../dom.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { createIconPicker } from "./icon-picker.js";
import { confirmDelete } from "../editor.js";
import { refreshColorEditors } from "./hosts.js";
import { renderServiceEditor } from "./services.js";
import { renderWidgetsEditor } from "./widgets.js";
import { createColorPicker } from "./color-picker.js";
import { makeDraggable } from "./drag.js";

export function renderCategoryEditor() {
  categoryEditor.innerHTML = "";

  state.editCategories.forEach((category, index) => {
    const row = document.createElement("div");
    row.className = "category-row";

    const drag = document.createElement("div");
    drag.className = "drag-handle";
    drag.title = t("move");
    drag.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("categoryName");
    name.value = category.name || "";

    const originalName = category.name || "";
    name.addEventListener("input", () => {
      const previous = state.editCategories[index].name;
      const next = name.value;
      state.editCategories[index].name = next;
      state.editServices.forEach(service => {
        if (
          service.category === previous ||
          (previous === originalName && service.category === originalName)
        ) {
          service.category = next;
        }
      });
      if (state.editSpecialTile && state.editSpecialTile.category === previous) {
        state.editSpecialTile.category = next;
      }
    });

    const picker = createIconPicker(category, index);

    // A category belongs to one dashboard: the selector makes that link explicit,
    // and the dashboards editor validates it again on save.
    const dashboardSelect = document.createElement("select");
    dashboardSelect.className = "edit-select";
    dashboardSelect.title = t("categoryDashboard");
    dashboardSelect.setAttribute("aria-label", t("categoryDashboard"));
    state.editDashboards.forEach(dashboard => {
      const option = document.createElement("option");
      option.value = dashboard.id || "main";
      option.textContent = dashboard.name || t("dashboardLabel");
      dashboardSelect.appendChild(option);
    });
    dashboardSelect.value = state.editDashboards.some(d => d.id === category.dashboardId)
      ? category.dashboardId
      : state.editDashboards[0]?.id || "";
    dashboardSelect.addEventListener("change", () => {
      state.editCategories[index].dashboardId = dashboardSelect.value;
    });

    const remove = document.createElement("button");
    remove.className = "small-icon-btn delete-btn";
    remove.type = "button";
    remove.title = t("deleteLabel");
    remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
    remove.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteCategory")))) return;
      const removedName = state.editCategories[index].name;
      state.editCategories.splice(index, 1);
      state.editServices.forEach(service => {
        if (service.category === removedName) service.category = "Autres";
      });
      if (state.editSpecialTile && state.editSpecialTile.category === removedName) {
        state.editSpecialTile.category = state.editCategories[0]?.name || "Autres";
      }
      renderCategoryEditor();
      renderServiceEditor();
      renderWidgetsEditor();
    });

    row.append(
      drag,
      name,
      dashboardSelect,
      picker,
      createColorPicker(category, refreshColorEditors),
      remove
    );
    makeDraggable(row, state.editCategories, index, renderCategoryEditor);
    categoryEditor.appendChild(row);
  });
}

addCategoryBtn.addEventListener("click", () => {
  const newCategory = {
    name: "",
    icon: "fa-solid fa-folder",
    dashboardId: state.editDashboards[0]?.id || "main"
  };
  state.editCategories.push(newCategory);
  renderCategoryEditor();
  renderServiceEditor();

  requestAnimationFrame(() => {
    const rows = [...categoryEditor.querySelectorAll(".category-row")];
    const row = rows[rows.length - 1];
    const input = row?.querySelector(".edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  });
});
