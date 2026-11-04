// Dashboard sections (one per category or host). Folding one keeps it in
// place (columns-layout.js).
import { state, getCategory, compareServices } from "../state.js";
import { sanitizeTileColor, sanitizeIconClass } from "../config/sanitize.js";
import { groupLabel, searchQuery } from "./query.js";
import { saveViewPrefs } from "../view-prefs.js";
import { createCard } from "./cards.js";
import { toggleSectionInPlace } from "./columns-layout.js";

export function createSection(
  categoryName,
  categoryServices,
  groupType = "category",
  // Called when the section is folded or unfolded by a click on its header.
  onToggle = () => {}
) {
  const category =
    groupType === "host"
      ? state.hosts.find(host => host.name === categoryName) || {
          name: categoryName,
          icon: "fa-solid fa-server"
        }
      : getCategory(categoryName);
  const collapseKey = `${groupType}:${categoryName}`;
  const section = document.createElement("section");
  section.className = "section";
  // The colour goes on the section, not on each tile: services inherit it.
  // createSection already resolves the category OR the host for the active mode.
  // The two "coloured" themes use it as background, the others only as border.
  const tileColor = sanitizeTileColor(category.color);
  // The "tinted" class is what marks a coloured section: without it
  // --tile-color would be transparent and the border would vanish instead of
  // keeping the theme's.
  if (tileColor) {
    section.classList.add("tinted");
    section.style.setProperty("--tile-color", tileColor);
  }
  // A search opens every section: a collapsed one would hide its results.
  if (!searchQuery() && (state.collapsed[collapseKey] ?? state.collapsed[categoryName]))
    section.classList.add("collapsed");

  const header = document.createElement("button");
  header.className = "section-header";
  header.type = "button";
  header.innerHTML = `
    <i class="${sanitizeIconClass(category.icon)} category-icon"></i>
    <span class="category-name"></span>
    <i class="fa-solid fa-chevron-down chevron"></i>
  `;
  header.querySelector(".category-name").textContent = groupLabel(categoryName);

  header.addEventListener("click", () => {
    const collapsing = !section.classList.contains("collapsed");
    state.collapsed[collapseKey] = collapsing;
    delete state.collapsed[categoryName];
    onToggle();
    saveViewPrefs({ collapsed: state.collapsed });

    // In place: the category keeps its position, the ones below move up.
    toggleSectionInPlace(section, collapsing);
  });

  const body = document.createElement("div");
  body.className = "section-body";

  const cards = document.createElement("div");
  cards.className = "cards";

  [...categoryServices].sort(compareServices).forEach(s => cards.appendChild(createCard(s)));

  body.appendChild(cards);
  section.append(header, body);
  return section;
}
