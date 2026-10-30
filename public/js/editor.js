// Éditeur de configuration : services, catégories, hôtes, liens web, import/export config.
import {
  state,
  clone,
  normalize,
  normalizeConfig,
  compareNames,
  LINK_COUNTER_TYPES
} from "./state.js";
import { t, applyLanguage } from "./i18n.js";
import { saveConfig, fetchConfig, configConflict } from "./api.js";
import { saveViewPrefs } from "./view-prefs.js";
import {
  render,
  updateViewButton,
  updateIconsButton,
  updateOpenModeMenu,
  updateGroupModeMenu,
  updateSortModeMenu
} from "./render.js";
import { renderPageSwitch } from "./pages.js";
import { renderSupervision } from "./supervision.js";
import { applyTheme } from "./themes.js";
import { openImageLibrary, renderImageManager } from "./images.js";
import {
  createIconPicker,
  createHostIconPicker,
  createWebLinkIconPicker,
  createDashboardIconPicker
} from "./icons.js";
import { createConfirmDialog } from "./confirm-dialog.js";
import { agentUrl, replicationEntries } from "./replication-draft.js";
import { blankMonitoring } from "./host-monitoring-draft.js";
import { moveItem, makeDraggable } from "./editor-drag.js";
import { createColorPicker } from "./color-picker.js";
import { renderPairingEditor } from "./pairing-editor.js";
import { prepareEditorDraft } from "./editor-draft.js";
import { renderAptUpdatesEditor } from "./apt-editor.js";
import { renderWireguardEditor, renderSmartEditor } from "./monitoring-editors.js";
import {
  getWidgetMeta,
  listWidgetMetas,
  widgetLabel,
  widgetString,
  fieldLabel,
  fieldPlaceholder,
  fieldTitle,
  visibleFields,
  inheritWidgetConfig,
  isEncryptedSecret,
  suggestedWidgetId
} from "./widget-registry.js";
import {
  serviceEditor,
  categoryEditor,
  dashboardEditor,
  hostEditor,
  webLinksEditor,
  widgetsEditor,
  editorSearch,
  editorCategoryFilter,
  editorHostFilter,
  modalBackdrop,
  editorTitle,
  closeBtn,
  cancelBtn,
  saveBtn,
  addServiceBtn,
  addCategoryBtn,
  addDashboardBtn,
  addWebLinkBtn,
  addHostBtn,
  exportConfigBtn,
  importConfigBtn,
  configImportInput,
  importExportStatus,
  widgetConfig,
  widgetConfigBody,
  widgetConfigCloseBtn,
  widgetConfigSaveBtn,
  replicationEditor
} from "./dom.js";

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

function confirmDelete(message) {
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

function refreshEditorCategoryFilter() {
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

function getEditorHostNames() {
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

function refreshEditorHostFilter() {
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

    // Le menu des widgets est construit depuis le registre : ajouter un widget
    // ne demande aucune edition ici.
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
      // Changer de widget : on repart des defauts du manifest et on ne
      // conserve que les cles communes (inheritWidgetConfig).
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

let widgetConfigIndex = -1;
let widgetDraft = null;
// Un choix explicite, y compris "Standard", ne doit jamais etre ecrase par
// une suggestion issue du titre de l'application.
const manualWidgetChoices = new WeakSet();

// Un widget absent du registre est traite comme "standard" dans le menu : on ne
// propose jamais une option qui ne serait pas exploitable.
function hasWidgetType(widget) {
  return !!(widget && widget.type && getWidgetMeta(widget.type));
}

export function openWidgetConfig(index) {
  widgetConfigIndex = index;
  const svc = state.editServices[index];
  widgetDraft = svc && svc.widget ? Object.assign({}, svc.widget) : null;
  renderWidgetConfig();
  widgetConfig.classList.add("show");
  widgetConfig.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

export function closeWidgetConfig() {
  widgetConfig.classList.remove("show");
  widgetConfig.setAttribute("aria-hidden", "true");
  widgetConfigIndex = -1;
  widgetDraft = null;
  document.body.classList.remove("modal-open");
}

// Enregistrement du formulaire widget : regle generique, valable pour tout
// widget present ou a venir.
//   - un champ secret laisse vide conserve la valeur deja enregistree (le
//     serveur ne peut dechiffrer que cote serveur, on ne perd donc jamais un
//     mot de passe en ouvrantly l'editeur) ;
//   - sinon la valeur du brouillon est reprise, bornee par le schema.
function commitWidgetConfig() {
  const svc = state.editServices[widgetConfigIndex];
  if (!svc || !svc.widget || !widgetDraft) return;
  const meta = getWidgetMeta(svc.widget.type);
  if (!meta) return;

  const next = { type: meta.id };
  for (const field of meta.config || []) {
    const draftValue = widgetDraft[field.key];
    if (field.type === "secret") {
      next[field.key] =
        draftValue && !isEncryptedSecret(draftValue)
          ? String(draftValue).slice(0, 2000)
          : svc.widget[field.key] || "";
      continue;
    }
    if (field.type === "checkbox") {
      next[field.key] =
        draftValue === true || draftValue === "true" || draftValue === "on" || draftValue === 1;
      continue;
    }
    if (field.type === "number") {
      let n = Number(draftValue);
      if (!Number.isFinite(n)) n = Number(field.default) || 0;
      next[field.key] = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
      continue;
    }
    if (field.type === "select") {
      const wanted = String(draftValue == null ? "" : draftValue).trim();
      const known = (field.options || []).some(option => option.value === wanted);
      next[field.key] = known ? wanted : String(field.default == null ? "" : field.default);
      continue;
    }
    next[field.key] = String(draftValue == null ? "" : draftValue)
      .trim()
      .slice(0, field.maxLength);
  }
  svc.widget = next;
}

// Un champ du formulaire, construit depuis la declaration du manifest.
function buildWidgetField(meta, field, draft, onVisibilityChange) {
  const wrap = document.createElement("label");
  wrap.className = "widget-cfg-field";

  const label = document.createElement("span");
  label.textContent = fieldLabel(meta, field, state.language);
  wrap.appendChild(label);

  const placeholder = fieldPlaceholder(meta, field, state.language);
  let input;

  if (field.type === "select") {
    input = document.createElement("select");
    input.className = "edit-select";
    (field.options || []).forEach(option => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = widgetString(meta, option.label || option.value, state.language);
      input.appendChild(node);
    });
    const current = String(draft[field.key] == null ? "" : draft[field.key]);
    const known = (field.options || []).some(option => option.value === current);
    input.value = known ? current : String(field.default == null ? "" : field.default);
    input.addEventListener("change", () => {
      draft[field.key] = input.value;
      // Un select pilote l'affichage d'autres champs (regle "when").
      if (onVisibilityChange) onVisibilityChange();
    });
  } else {
    input = document.createElement("input");
    input.className = "edit-input";
    if (field.type === "checkbox") {
      input.type = "checkbox";
      input.checked = draft[field.key] === true;
      input.addEventListener("change", () => {
        draft[field.key] = input.checked;
      });
    } else if (field.type === "number") {
      input.type = "number";
      if (Number.isFinite(field.min)) input.min = String(field.min);
      if (Number.isFinite(field.max)) input.max = String(field.max);
      // Sans cette ligne, le champ s'affiche vide a chaque reouverture : la
      // valeur enregistree existe encore, mais si l'utilisateur valide sans
      // retaper, le formulaire renvoie le defaut et l'ecrase.
      const current = draft[field.key];
      input.value =
        current == null || current === ""
          ? String(field.default == null ? "" : field.default)
          : String(current);
      input.addEventListener("input", () => {
        draft[field.key] = input.value;
      });
    } else if (field.type === "secret") {
      input.type = "password";
      input.autocomplete = "new-password";
      // Jamais de secret en clair dans le formulaire : si la valeur est deja
      // chiffree, le champ reste vide et n'affiche qu'un libelle.
      const secured = isEncryptedSecret(draft[field.key]);
      input.placeholder = secured ? t("passwordConfigured") : placeholder || field.label || "";
      input.value = secured ? "" : draft[field.key] || "";
      input.addEventListener("input", () => {
        if (input.value) draft[field.key] = input.value;
      });
    } else {
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = placeholder;
      input.value = draft[field.key] == null ? "" : String(draft[field.key]);
      input.addEventListener("input", () => {
        draft[field.key] = input.value;
      });
    }
  }
  if (placeholder && field.type !== "secret") input.title = placeholder;
  const hint = fieldTitle(meta, field, state.language);
  if (hint) wrap.title = hint;
  wrap.appendChild(input);
  return wrap;
}

function renderWidgetConfig() {
  widgetConfigBody.innerHTML = "";
  const service = state.editServices[widgetConfigIndex];
  if (!service || !service.widget) return;
  const draft = widgetDraft;
  if (!draft) return;

  const meta = getWidgetMeta(service.widget.type);
  if (!meta) {
    // Widget non installe : on ne pretend pas pouvoir l'editer, mais on ne
    // perd pas ses reglages.
    const note = document.createElement("p");
    note.className = "widget-cfg-note";
    note.textContent = `Widget « ${service.widget.type} » non installé.`;
    widgetConfigBody.appendChild(note);
    return;
  }

  const fields = visibleFields(meta, draft);
  if (!fields.length) {
    const note = document.createElement("p");
    note.className = "widget-cfg-note";
    note.textContent = widgetLabel(meta, state.language);
    widgetConfigBody.appendChild(note);
    return;
  }
  // Rendu differe : un select peut masquer un champ, on reconstruit donc le
  // formulaire apres chaque changement de ce type.
  const rerender = () => {
    widgetConfigBody.innerHTML = "";
    for (const field of visibleFields(meta, widgetDraft)) {
      widgetConfigBody.appendChild(buildWidgetField(meta, field, widgetDraft, rerender));
    }
  };
  rerender();
}

export function renderWebLinksEditor() {
  webLinksEditor.innerHTML = "";
  state.editWebLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "web-link-row";
    row.draggable = true;

    const drag = document.createElement("div");
    drag.className = "drag-handle";
    drag.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("nameLabel");
    name.value = link.name || "";
    name.addEventListener("input", () => (state.editWebLinks[index].name = name.value));

    const url = document.createElement("input");
    url.className = "edit-input web-link-url";
    url.placeholder = "https://...";
    url.value = link.url || "";
    url.addEventListener("input", () => (state.editWebLinks[index].url = url.value));

    const iconPicker = createWebLinkIconPicker(link, index);

    const counterWrap = document.createElement("div");
    counterWrap.className = "web-link-counter-wrap";

    const currentCounter =
      link.counter && LINK_COUNTER_TYPES.includes(link.counter.type) ? link.counter : null;

    const counterType = document.createElement("select");
    counterType.className = "edit-select web-link-counter-type";
    counterType.title = t("linkCounterLabel");
    [
      ["", t("linkCounterNone")],
      ["github", t("linkCounterGitHub")],
      ["dockerhub", t("linkCounterDockerHub")],
      ["youtube", t("linkCounterYoutube")]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      counterType.appendChild(option);
    });
    counterType.value = currentCounter ? currentCounter.type : "";

    const counterTarget = document.createElement("input");
    counterTarget.className = "edit-input web-link-counter-target";
    counterTarget.value = currentCounter ? currentCounter.target : "";
    counterTarget.hidden = !currentCounter;
    const targetPlaceholder = type =>
      t(type === "youtube" ? "linkCounterChannelPlaceholder" : "linkCounterRepoPlaceholder");
    counterTarget.placeholder = targetPlaceholder(currentCounter ? currentCounter.type : "");

    counterType.addEventListener("change", () => {
      const type = counterType.value;
      if (!type) {
        state.editWebLinks[index].counter = null;
        counterTarget.hidden = true;
        counterTarget.value = "";
        return;
      }
      state.editWebLinks[index].counter = { type, target: counterTarget.value || "" };
      counterTarget.hidden = false;
      counterTarget.placeholder = targetPlaceholder(type);
    });
    counterTarget.addEventListener("input", () => {
      if (state.editWebLinks[index].counter) {
        state.editWebLinks[index].counter.target = counterTarget.value;
      }
    });

    counterWrap.append(counterType, counterTarget);

    const del = document.createElement("button");
    del.className = "small-icon-btn delete-btn";
    del.type = "button";
    del.title = t("deleteLabel");
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteWebLink")))) return;
      state.editWebLinks.splice(index, 1);
      renderWebLinksEditor();
    });

    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", e => e.preventDefault());
    row.addEventListener("drop", e => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(from) || from === index) return;
      moveItem(state.editWebLinks, from, index);
      renderWebLinksEditor();
    });

    row.append(drag, name, url, counterWrap, iconPicker, del);
    webLinksEditor.appendChild(row);
  });
}

// Tuiles speciales (widgets) du tableau de bord : une seule active a la fois.
// Chaque type s'active par une case a cocher, puis porte ses propres options.
// Ajouter un widget = une entree dans ce tableau.
const SPECIAL_TILES = [
  { type: "fortune", image: "images/fortunecookie.png", labelKey: "specialTileFortune" }
];

// Categorie d'affichage d'une tuile speciale : celle demandee si elle existe
// encore, sinon la premiere definie, sinon "Autres". Elle est obligatoire.
function validSpecialCategory(preferred) {
  const names = [...new Set(state.editCategories.map(c => c.name).filter(Boolean))];
  return names.includes(preferred) ? preferred : names[0] || "Autres";
}

export function renderWidgetsEditor() {
  widgetsEditor.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "widget-hint";
  hint.textContent = t("specialTileHint");
  widgetsEditor.appendChild(hint);

  SPECIAL_TILES.forEach(def => {
    const active = !!(state.editSpecialTile && state.editSpecialTile.type === def.type);

    const row = document.createElement("div");
    row.className = "widget-row";

    const label = document.createElement("label");
    label.className = "widget-toggle";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = active;
    check.addEventListener("change", () => {
      // Une seule tuile speciale par tableau de bord : activer celle-ci
      // remplace toute autre selection.
      state.editSpecialTile = check.checked
        ? {
            type: def.type,
            category: validSpecialCategory(state.editSpecialTile && state.editSpecialTile.category)
          }
        : null;
      renderWidgetsEditor();
    });

    const icon = document.createElement("img");
    icon.className = "special-tile-icon";
    icon.src = def.image;
    icon.alt = "";

    const text = document.createElement("span");
    text.textContent = t(def.labelKey);

    label.append(check, icon, text);
    row.appendChild(label);

    if (active) {
      // Options du type : ici la seule reglable, la categorie d'affichage.
      const category = document.createElement("select");
      category.className = "edit-select special-tile-category";
      category.title = t("specialTileCategory");

      const names = [...new Set(state.editCategories.map(c => c.name).filter(Boolean))];
      if (!names.length) names.push("Autres");
      names.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        category.appendChild(option);
      });
      category.value = validSpecialCategory(state.editSpecialTile.category);
      state.editSpecialTile.category = category.value;
      category.addEventListener("change", () => {
        state.editSpecialTile.category = category.value;
      });

      row.appendChild(category);
    }

    widgetsEditor.appendChild(row);
  });
}

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

    // Une categorie appartient a un seul dashboard : le selecteur rend ce lien
    // explicite, et l'editeur des dashboards le revalide a l'enregistrement.
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

// Editeur des dashboards : nom + icone, dans l'ordre d'affichage des onglets.
// Supprimer un dashboard ne supprime aucune categorie : celles qui y etaient
// rattachees rejoignent le premier dashboard restant, pour ne jamais perdre de
// service. Le retrait du dernier dashboard est refuse (il en faut toujours un).
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
    remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
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

function refreshColorEditors() {
  renderCategoryEditor();
  renderHostEditor();
}

function monitoringField(labelText, control) {
  const field = document.createElement("label");
  field.className = "host-monitor-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  field.append(span, control);
  return field;
}

function monitoringInput(placeholderKey, value, onInput) {
  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = value || "";
  input.placeholder = t(placeholderKey);
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

// Panneau de l'hote local : seul le chemin du disque est configurable ici.
function renderMonitoringPanel(host, index) {
  const m = host.monitoring;
  const panel = document.createElement("div");
  panel.className = "host-monitor-panel";

  if (m.type === "local") {
    panel.appendChild(
      monitoringField(
        t("hostDiskPath"),
        monitoringInput("phDiskPath", m.path, v => (state.editHosts[index].monitoring.path = v))
      )
    );
    const hint = document.createElement("p");
    hint.className = "host-monitor-hint";
    hint.textContent = t("hostLocalHint");
    panel.appendChild(hint);
    return panel;
  }

  return panel;
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
    remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
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
    if (host.monitoring.enabled) item.appendChild(renderMonitoringPanel(host, index));

    makeDraggable(row, state.editHosts, index, () => {
      renderHostEditor();
      renderServiceEditor();
    });
    hostEditor.appendChild(item);
  });
  renderWireguardEditor();
  renderSmartEditor();
  renderAptUpdatesEditor();
}

const SUPERVISION_PANELS = [
  "hostsPanel",
  "replicationPanel",
  "wireguardPanel",
  "smartPanel",
  "aptUpdatesPanel"
];

// Le meme dialogue sert a deux usages : "Modifier Dashmon" (tous les onglets)
// et "Modifier la supervision" (hotes, replication et sondes locales). On masque les
// onglets inutiles plutot que de dupliquer le formulaire et son enregistrement.
function applyEditorMode(mode) {
  const supervision = mode === "supervision";
  modalBackdrop.dataset.mode = supervision ? "supervision" : "all";
  // WireGuard et SMART n'appartiennent qu'a l'editeur de supervision ; le
  // dialogue "Modifier Dashmon" ne les montre donc jamais.
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

// Applique le bon rendu sans quitter les parametres : le tableau de bord et la
// page supervision n'ont pas le meme renderer.
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

widgetConfigCloseBtn.addEventListener("click", closeWidgetConfig);
widgetConfigSaveBtn.addEventListener("click", () => {
  if (widgetConfigIndex >= 0) {
    commitWidgetConfig();
    closeWidgetConfig();
  }
});
widgetConfig.addEventListener("click", e => {
  if (e.target === widgetConfig) closeWidgetConfig();
});

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

addWebLinkBtn.addEventListener("click", () => {
  state.editWebLinks.push({ name: "", url: "", icon: "fa-solid fa-globe", counter: null });
  renderWebLinksEditor();
  requestAnimationFrame(() => {
    const rows = [...webLinksEditor.querySelectorAll(".web-link-row")];
    rows[rows.length - 1]?.querySelector(".edit-input")?.focus();
  });
});

// Cree un brouillon d'hote, le rend et place le curseur sur son nom. Utilise
// par le bouton "Ajouter un hote" et par le pairage quand aucun hote n'existe.
function createHostDraft() {
  // Supervision desactivee par defaut : plusieurs hotes "local" surveilleraient
  // la meme machine, et un nouvel hote ne doit rien mesurer tant que l'utilisateur
  // ne l'a pas demande explicitement.
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

    // L'import reste un brouillon tant que l'utilisateur ne clique pas sur
    // "Appliquer" : aucun ecrasement du serveur ni changement visible avant.
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

// Active un onglet de l'editeur. Le pairage relit la liste des hotes a chaque
// ouverture : un hote cree entre-temps doit apparaitre sans rouvrir le dialogue.
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

    // Un pairage sans hote ne peut pas reprendre de couleur ni d'icone. On le
    // signale avant d'ecrire, en proposant de creer l'hote manquant sans perdre
    // l'adresse et le nom deja saisis.
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
        // Le premier pairage incomplet reprend l'hote cree : il ne reste qu'a
        // le nommer, puis a enregistrer.
        state.replication.agentHosts = state.replication.agentHosts || {};
        state.replication.agentHosts[pairsMissingHost[0]] = host.id;
        const draft = pairingDraft?.find(entry => agentUrl(entry.url) === pairsMissingHost[0]);
        if (draft) draft.host = host.id;
        activateEditorPanel("hostsPanel");
        return false;
      }
    }
    // Les references vers un hote supprime ne sont pas conservees.
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

    // Les champs qui ne possedent pas de formulaire dans l'editeur viennent du
    // fichier importe. Les preferences de vue restent propres au navigateur.
    if (importedConfigDraft) {
      state.webLinksColor = importedConfigDraft.webLinksColor;
      state.theme = importedConfigDraft.theme;
      state.language = importedConfigDraft.language;
      state.usageCounts = { ...importedConfigDraft.usageCounts };
    }

    // Le dashboard actif peut avoir ete supprime ou renomme : on le ramene sur
    // un dashboard existant avant de redessiner.
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
    // Les sections repliées sont une préférence d'affichage : elles vivent dans
    // le navigateur, pas dans config.json.
    saveViewPrefs({ collapsed: state.collapsed });

    const saved = await saveConfig(true, { replaceUsage: !!importedConfigDraft });
    if (!saved) {
      // Ne pas fermer l'editeur en silence : sans ce garde, l'interface montrait
      // la suppression alors que le fichier n'avait pas ete ecrit.
      alert(t(configConflict ? "configConflict" : "saveError"));
      return false;
    }
    // Utiliser immediatement les URL canoniques, comme au prochain chargement.
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
    // Relecture de la configuration telle que la voit un rechargement de page. Si
    // une application supprimee est encore la, c'est que l'ecriture n'a pas
    // abouti cote serveur (autre onglet, seconde instance, proxy). On le dit tout
    // de suite au lieu de laisser la tuile reapparaitre apres un refresh.
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
editorCategoryFilter.addEventListener("change", renderServiceEditor);
editorHostFilter.addEventListener("change", renderServiceEditor);
