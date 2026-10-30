// Widget settings dialog of a service, built from the widget manifest.
import {
  getWidgetMeta,
  isEncryptedSecret,
  fieldLabel,
  fieldPlaceholder,
  widgetString,
  fieldTitle,
  visibleFields,
  widgetLabel
} from "../widget-registry.js";
import { state } from "../state.js";
import {
  widgetConfig,
  widgetConfigBody,
  widgetConfigCloseBtn,
  widgetConfigSaveBtn
} from "../dom.js";
import { t } from "../i18n.js";

export let widgetConfigIndex = -1;

let widgetDraft = null;

// An explicit choice, including "Standard", must never be overwritten by a
// suggestion derived from the application title.
export const manualWidgetChoices = new WeakSet();

// A widget missing from the registry shows as "standard" in the menu: an
// option that could not work is never offered.
export function hasWidgetType(widget) {
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

// Saving the widget form, a generic rule valid for any present or future
// widget:
//   - a secret field left empty keeps the stored value (only the server can
//     decrypt it, so opening the editor never loses a password);
//   - otherwise the draft value is taken, bounded by the schema.
export function commitWidgetConfig() {
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

// A form field, built from the manifest declaration.
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
      // A select controls whether other fields are shown ("when" rule).
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
      // Without this line the field would show empty on every reopening: the
      // stored value still exists, but saving without retyping would send the
      // default and overwrite it.
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
      // Never a secret in clear in the form: when the value is already stored
      // (encrypted or masked), the field stays empty and only shows a label.
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
    // Widget not installed: do not pretend it can be edited, but keep its
    // settings.
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
  // Deferred rendering: a select may hide a field, so the form is rebuilt after
  // each such change.
  const rerender = () => {
    widgetConfigBody.innerHTML = "";
    for (const field of visibleFields(meta, widgetDraft)) {
      widgetConfigBody.appendChild(buildWidgetField(meta, field, widgetDraft, rerender));
    }
  };
  rerender();
}

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
