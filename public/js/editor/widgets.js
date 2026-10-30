// Widgets panel: the special tiles of the dashboard.
import { state } from "../state.js";
import { widgetsEditor } from "../dom.js";
import { t } from "../i18n.js";

// Special tiles (widgets) of the dashboard: only one active at a time. Each
// type is enabled by a checkbox, then carries its own options. Adding one
// means one entry in this array.
export const SPECIAL_TILES = [
  { type: "fortune", image: "images/fortunecookie.png", labelKey: "specialTileFortune" }
];

// Display category of a special tile: the requested one if it still exists,
// otherwise the first defined, otherwise "Autres". It is mandatory.
export function validSpecialCategory(preferred) {
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
      // One special tile per dashboard: enabling this one replaces any other
      // selection.
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
      // Options of the type: the only one so far is the display category.
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
