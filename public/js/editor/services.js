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
import { confirmDelete } from "./confirm.js";
import { setDeleteIcon, setIconButton } from "./icon-button.js";

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

// A field with its label above it. A single input or select goes inside a
// <label>, so the label names it for screen readers too.
function serviceField(text, control, area) {
  const single = control.matches("input, select");
  const field = document.createElement(single ? "label" : "div");
  field.className = "service-field service-field-" + area;
  const caption = document.createElement("span");
  caption.className = "service-field-label";
  caption.textContent = text;
  field.append(caption, control);
  return field;
}

function iconElement(className) {
  const icon = document.createElement("i");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

// A select whose options are the given [value, label] pairs.
function optionsSelect(choices, current) {
  const select = document.createElement("select");
  select.className = "edit-select";
  choices.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = current;
  return select;
}

// Host of the service. A host name that no longer exists stays selectable,
// so opening the settings never changes a service by itself.
function hostSelect(service, index, hostNames) {
  const current = (service.host || "").trim();
  const choices = [["", t("noHost")], ...hostNames.map(name => [name, name])];
  if (current && !hostNames.includes(current)) choices.push([current, current]);
  const host = optionsSelect(choices, current);
  host.title = t("hostLabel");
  host.addEventListener("change", () => {
    state.editServices[index].host = host.value;
  });
  return host;
}

function categorySelect(service, index) {
  const current = service.category || "Autres";
  const names = [...new Set([...state.editCategories.map(c => c.name).filter(Boolean), current])];
  const category = optionsSelect(
    names.map(name => [name, name]),
    current
  );
  category.addEventListener("change", () => {
    state.editServices[index].category = category.value;
  });
  return category;
}

function textInput(value, placeholder, onInput) {
  const input = document.createElement("input");
  input.className = "edit-input";
  input.placeholder = placeholder;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

// Square tile at the start of the card, same format as the Images panel.
function imageButton(service, index) {
  const button = document.createElement("button");
  button.className = "service-image-btn";
  button.type = "button";
  button.title = t("choosePng");
  button.setAttribute("aria-label", t("choosePng"));
  if (service.icon) {
    const preview = document.createElement("img");
    preview.src = service.icon;
    preview.alt = "";
    preview.onerror = () => preview.replaceWith(iconElement("fa-solid fa-image"));
    button.append(preview);
  } else {
    button.append(iconElement("fa-solid fa-image"));
  }
  button.addEventListener("click", () =>
    openImageLibrary(value => {
      state.editServices[index].icon = value;
      renderServiceEditor();
    })
  );
  return button;
}

// Monitoring: a coloured dot (green monitored, orange non-critical, grey
// off), cycled on click; the info bubble next to it explains the colours.
function monitorControls(service, index) {
  const monitorState =
    service.monitor === false ? "off" : service.monitor === "soft" ? "soft" : "on";
  const monitor = document.createElement("button");
  monitor.className = `monitor-toggle monitor-${monitorState}`;
  monitor.type = "button";
  const dot = document.createElement("span");
  dot.className = "monitor-dot";
  setIconButton(
    monitor,
    dot,
    t({ on: "monitorEnabled", soft: "monitorSoft", off: "monitorDisabled" }[monitorState])
  );
  monitor.setAttribute("aria-pressed", String(monitorState !== "off"));
  monitor.addEventListener("click", () => {
    const current = state.editServices[index].monitor;
    state.editServices[index].monitor =
      current === false ? true : current === "soft" ? false : "soft";
    renderServiceEditor();
  });
  const help = document.createElement("span");
  help.className = "monitor-help";
  help.tabIndex = 0;
  help.setAttribute("role", "img");
  help.title = t("monitorHelp");
  help.setAttribute("aria-label", t("monitorHelp"));
  help.append(iconElement("fa-solid fa-circle-info"));
  return [help, monitor];
}

function deleteButton(index) {
  const remove = document.createElement("button");
  remove.className = "small-icon-btn delete-btn";
  remove.type = "button";
  setDeleteIcon(remove, t("deleteLabel"));
  remove.addEventListener("click", async () => {
    if (!(await confirmDelete(t("confirmDeleteService")))) return;
    state.editServices.splice(index, 1);
    renderServiceEditor();
  });
  return remove;
}

// The widget menu is built from the registry: adding a widget needs no edit
// here. Returns the block and a function that shows a widget picked from
// the name of the service.
function widgetControls(service, index) {
  const wrap = document.createElement("div");
  wrap.className = "service-widget";
  const type = optionsSelect(
    [
      ["", t("widgetStandard")],
      ...listWidgetMetas().map(meta => [meta.id, widgetLabel(meta, state.language)])
    ],
    hasWidgetType(service.widget) ? service.widget.type : ""
  );
  type.classList.add("widget-type");
  type.title = t("widgetLabel");
  type.setAttribute("aria-label", t("widgetLabel"));
  type.addEventListener("change", () => {
    // Changing widget: start again from the manifest defaults and keep only the
    // keys both share (inheritWidgetConfig).
    const edited = state.editServices[index];
    manualWidgetChoices.add(edited);
    edited.widget = type.value ? inheritWidgetConfig(type.value, service.widget) : null;
    renderServiceEditor();
  });

  const configure = document.createElement("button");
  configure.type = "button";
  configure.className = "small-icon-btn widget-config-btn" + (service.widget ? "" : " disabled");
  configure.title = service.widget ? t("widgetConfigTitle") : t("widgetConfigNone");
  setIconButton(configure, "fa-solid fa-sliders", configure.title);
  configure.addEventListener("click", () => {
    if (service.widget) openWidgetConfig(index);
  });
  wrap.append(type, configure);

  const showSuggested = widgetId => {
    type.value = widgetId;
    configure.classList.remove("disabled");
    configure.title = t("widgetConfigTitle");
  };
  return { wrap, showSuggested };
}

function serviceRow(service, index, hostNames) {
  const row = document.createElement("div");
  row.className = "service-row";
  row._serviceRef = service;

  const widget = widgetControls(service, index);
  // Typing a known application name proposes its widget, unless the user
  // already chose one by hand.
  const name = textInput(service.name, t("nameLabel"), value => {
    const edited = state.editServices[index];
    edited.name = value;
    if (manualWidgetChoices.has(edited) || edited.widget) return;
    const suggested = suggestedWidgetId(value);
    if (!suggested) return;
    edited.widget = inheritWidgetConfig(suggested, null);
    widget.showSuggested(suggested);
  });
  const url = textInput(service.url, t("urlLabel"), value => {
    state.editServices[index].url = value;
  });

  const actions = document.createElement("div");
  actions.className = "service-actions";
  actions.append(...monitorControls(service, index), deleteButton(index));

  row.append(
    imageButton(service, index),
    serviceField(t("nameLabel"), name, "name"),
    serviceField(t("urlLabel"), url, "url"),
    serviceField(t("categoryLabel"), categorySelect(service, index), "category"),
    serviceField(t("hostLabel"), hostSelect(service, index, hostNames), "host"),
    serviceField(t("widgetLabel"), widget.wrap, "widget"),
    actions
  );
  return row;
}

export function renderServiceEditor() {
  serviceEditor.innerHTML = "";
  refreshEditorCategoryFilter();
  refreshEditorHostFilter();
  const search = normalize(editorSearch.value);
  const categoryFilter = editorCategoryFilter.value;
  const hostFilter = editorHostFilter.value;
  const hostNames = getEditorHostNames();

  state.editServices
    .map((service, index) => ({ service, index }))
    .sort((a, b) => compareNames(a.service.name, b.service.name))
    .filter(
      ({ service }) =>
        (!search || normalize(service.name).includes(search)) &&
        (!categoryFilter || (service.category || "Autres") === categoryFilter) &&
        (!hostFilter || (service.host || "") === hostFilter)
    )
    .forEach(({ service, index }) =>
      serviceEditor.appendChild(serviceRow(service, index, hostNames))
    );
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
