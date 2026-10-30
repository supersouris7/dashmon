// Services panel: one row per service (name, URL, icon, category, host,
// monitoring, widget), with search and filters.
import {
  editorCategoryFilter,
  editorHostFilter,
  serviceEditor,
  editorSearch,
  addServiceBtn
} from "../dom.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { normalize, compareNames } from "../util.js";
import { manualWidgetChoices, hasWidgetType, openWidgetConfig } from "./widget-config.js";
import {
  suggestedWidgetId,
  inheritWidgetConfig,
  listWidgetMetas,
  widgetLabel
} from "../widget-registry.js";
import { openImageLibrary } from "../images.js";
import { confirmDelete } from "../editor.js";

export function refreshEditorCategoryFilter() {
  const current = editorCategoryFilter.value;
  const names = [...new Set(state.editCategories.map(c => c.name).filter(Boolean))];
  editorCategoryFilter.innerHTML = `<option value="">${t("allCategories")}</option>`;
  names.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    editorCategoryFilter.appendChild(option);
  });
  editorCategoryFilter.value = names.includes(current) ? current : "";
}

export function getEditorHostNames() {
  const names = [];
  const seen = new Set();

  const addName = value => {
    const name = (value || "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  state.editHosts.forEach(host => addName(host.name));
  state.editServices.forEach(service => addName(service.host));
  return names;
}

export function refreshEditorHostFilter() {
  const current = editorHostFilter.value;
  editorHostFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = t("allHosts");
  editorHostFilter.appendChild(allOption);

  getEditorHostNames().forEach(hostName => {
    const option = document.createElement("option");
    option.value = hostName;
    option.textContent = hostName;
    editorHostFilter.appendChild(option);
  });

  editorHostFilter.value = [...editorHostFilter.options].some(option => option.value === current)
    ? current
    : "";
}

export function renderServiceEditor() {
  serviceEditor.innerHTML = "";
  refreshEditorCategoryFilter();
  refreshEditorHostFilter();
  const search = normalize(editorSearch.value);
  const categoryFilter = editorCategoryFilter.value;
  const hostFilter = editorHostFilter.value;

  const hostNames = getEditorHostNames();

  const sortedServices = state.editServices
    .map((service, index) => ({ service, index }))
    .sort((a, b) => compareNames(a.service.name, b.service.name));

  sortedServices.forEach(({ service, index }) => {
    if (search && !normalize(service.name).includes(search)) return;
    if (categoryFilter && (service.category || "Autres") !== categoryFilter) return;
    if (hostFilter && (service.host || "") !== hostFilter) return;
    const row = document.createElement("div");
    row.className = "service-row";
    row._serviceRef = service;

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("nameLabel");
    name.value = service.name || "";
    name.addEventListener("input", () => {
      const edited = state.editServices[index];
      edited.name = name.value;
      if (manualWidgetChoices.has(edited) || edited.widget) return;
      const suggested = suggestedWidgetId(name.value);
      if (!suggested) return;
      edited.widget = inheritWidgetConfig(suggested, null);
      widgetType.value = suggested;
      widgetConfigBtn.classList.remove("disabled");
      widgetConfigBtn.title = t("widgetConfigTitle");
    });

    const host = document.createElement("select");
    host.className = "edit-select";
    host.title = t("hostLabel");

    const currentHost = (service.host || "").trim();

    const noHostOption = document.createElement("option");
    noHostOption.value = "";
    noHostOption.textContent = t("noHost");
    host.appendChild(noHostOption);

    hostNames.forEach(hostName => {
      const option = document.createElement("option");
      option.value = hostName;
      option.textContent = hostName;
      host.appendChild(option);
    });

    host.value = currentHost;
    if (host.value !== currentHost) {
      const fallback = document.createElement("option");
      fallback.value = currentHost;
      fallback.textContent = currentHost;
      host.appendChild(fallback);
      host.value = currentHost;
    }

    host.addEventListener("change", () => {
      state.editServices[index].host = host.value;
    });

    const category = document.createElement("select");
    category.className = "edit-select";
    const categoryNames = [
      ...new Set([
        ...state.editCategories.map(c => c.name).filter(Boolean),
        service.category || "Autres"
      ])
    ];
    categoryNames.forEach(categoryName => {
      const option = document.createElement("option");
      option.value = categoryName;
      option.textContent = categoryName;
      if (categoryName === (service.category || "Autres")) option.selected = true;
      category.appendChild(option);
    });
    category.addEventListener(
      "change",
      () => (state.editServices[index].category = category.value)
    );

    const url = document.createElement("input");
    url.className = "edit-input";
    url.placeholder = t("urlLabel");
    url.value = service.url || "";
    url.addEventListener("input", () => (state.editServices[index].url = url.value));

    const iconField = document.createElement("div");
    iconField.className = "image-field icon-only-field";

    const chooseIcon = document.createElement("button");
    chooseIcon.className = "image-library-btn";
    chooseIcon.type = "button";
    chooseIcon.title = t("choosePng");

    if (service.icon) {
      const preview = document.createElement("img");
      preview.src = service.icon;
      preview.alt = "";
      preview.className = "editor-icon-preview";
      preview.onerror = () => {
        chooseIcon.innerHTML = '<i class="fa-solid fa-image"></i>';
      };
      chooseIcon.appendChild(preview);
    } else {
      chooseIcon.innerHTML = '<i class="fa-solid fa-image"></i>';
    }

    chooseIcon.addEventListener("click", () =>
      openImageLibrary(value => {
        state.editServices[index].icon = value;
        renderServiceEditor();
      })
    );

    iconField.append(chooseIcon);

    const monitor = document.createElement("button");
    monitor.className = `monitor-toggle ${service.monitor !== false ? "active" : ""} ${service.monitor === "soft" ? "soft" : ""}`;
    monitor.type = "button";
    monitor.title =
      service.monitor === false
        ? t("monitorDisabled")
        : service.monitor === "soft"
          ? t("monitorSoft")
          : t("monitorEnabled");
    monitor.innerHTML =
      service.monitor === "soft"
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-heart-pulse"></i>';
    monitor.addEventListener("click", () => {
      const current = state.editServices[index].monitor;
      state.editServices[index].monitor =
        current === false ? true : current === "soft" ? false : "soft";
      renderServiceEditor();
    });

    const remove = document.createElement("button");
    remove.className = "small-icon-btn delete-btn";
    remove.type = "button";
    remove.title = t("deleteLabel");
    remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
    remove.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteService")))) return;
      state.editServices.splice(index, 1);
      renderServiceEditor();
    });

    const actions = document.createElement("div");
    actions.className = "service-actions";
    actions.append(iconField, monitor, remove);

    const widgetWrap = document.createElement("div");
    widgetWrap.className = "service-widget";

    // The widget menu is built from the registry: adding a widget needs no edit
    // here.
    const widgetType = document.createElement("select");
    widgetType.className = "edit-select widget-type";
    widgetType.title = t("widgetLabel");
    [
      ["", t("widgetStandard")],
      ...listWidgetMetas().map(meta => [meta.id, widgetLabel(meta, state.language)])
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      widgetType.appendChild(option);
    });
    widgetType.value = hasWidgetType(service.widget) ? service.widget.type : "";
    widgetType.addEventListener("change", () => {
      // Changing widget: start again from the manifest defaults and keep only the
      // keys both share (inheritWidgetConfig).
      const edited = state.editServices[index];
      manualWidgetChoices.add(edited);
      edited.widget = widgetType.value
        ? inheritWidgetConfig(widgetType.value, service.widget)
        : null;
      renderServiceEditor();
    });
    widgetWrap.appendChild(widgetType);

    const widgetConfigBtn = document.createElement("button");
    widgetConfigBtn.type = "button";
    widgetConfigBtn.className =
      "small-icon-btn widget-config-btn" + (service.widget ? "" : " disabled");
    widgetConfigBtn.title = service.widget ? t("widgetConfigTitle") : "";
    widgetConfigBtn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
    widgetConfigBtn.addEventListener("click", () => {
      if (service.widget) {
        openWidgetConfig(index);
      }
    });
    widgetWrap.appendChild(widgetConfigBtn);

    row.append(name, host, category, url, actions, widgetWrap);
    serviceEditor.appendChild(row);
  });
}

addServiceBtn.addEventListener("click", () => {
  const newService = {
    name: "",
    host: "",
    category: state.editCategories[0]?.name || "Autres",
    url: "",
    icon: "",
    monitor: true,
    widget: null
  };
  state.editServices.push(newService);
  renderServiceEditor();

  requestAnimationFrame(() => {
    const rows = [...serviceEditor.querySelectorAll(".service-row")];
    const row = rows.find(item => item._serviceRef === newService);
    const input = row?.querySelector(".edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  });
});

editorCategoryFilter.addEventListener("change", renderServiceEditor);

editorHostFilter.addEventListener("change", renderServiceEditor);
