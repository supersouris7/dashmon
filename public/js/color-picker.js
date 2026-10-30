import { TILE_COLORS, sanitizeTileColor } from "./state.js";
import { t } from "./i18n.js";

function closeColorPalette() {
  for (const palette of document.querySelectorAll(".color-palette:not([hidden])"))
    palette.hidden = true;
  for (const button of document.querySelectorAll(".color-swatch-btn.open"))
    button.classList.remove("open");
}

document.addEventListener("click", closeColorPalette);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeColorPalette();
});

// La selection modifie l'objet de brouillon ; l'appelant choisit les panneaux
// a rafraichir. Aucune ecriture de configuration n'est declenchee ici.
export function createColorPicker(item, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "color-picker";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "color-swatch-btn";
  button.title = t("colorSwatch");
  button.setAttribute("aria-label", t("colorSwatch"));
  button.style.setProperty("--swatch", item.color || "transparent");
  const palette = document.createElement("div");
  palette.className = "color-palette";
  palette.hidden = true;
  if (!item.color) {
    item.color = TILE_COLORS.find(Boolean) || "";
    button.style.setProperty("--swatch", item.color);
  }
  TILE_COLORS.filter(Boolean).forEach(color => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-chip";
    swatch.style.setProperty("--chip", color);
    swatch.title = t("colorSwatch");
    swatch.setAttribute("aria-label", color);
    if (color === item.color) swatch.classList.add("current");
    swatch.addEventListener("click", event => {
      event.stopPropagation();
      item.color = sanitizeTileColor(color);
      closeColorPalette();
      onChange();
    });
    palette.appendChild(swatch);
  });
  button.addEventListener("click", event => {
    event.stopPropagation();
    const open = palette.hidden;
    closeColorPalette();
    palette.hidden = !open;
    button.classList.toggle("open", open);
  });
  wrap.append(button, palette);
  return wrap;
}
