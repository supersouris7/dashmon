// Dashboard sections (one per category or host) and their animated
// reordering when a section is collapsed or expanded.
import { state, getCategory, compareServices } from "../state.js";
import { sanitizeTileColor, sanitizeIconClass } from "../config/sanitize.js";
import { groupLabel, updateCollapseAllButton } from "../render.js";
import { saveViewPrefs } from "../view-prefs.js";
import { createCard } from "./cards.js";
import { dashboard } from "../dom.js";

export function createSection(
  categoryName,
  categoryServices,
  groupType = "category",
  specialCard = null
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
  if (state.collapsed[collapseKey] ?? state.collapsed[categoryName])
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
    updateCollapseAllButton();
    saveViewPrefs({ collapsed: state.collapsed });

    if (collapsing) {
      reorderDashboardSections(
        true,
        null,
        () => {
          section.classList.add("collapsed");
        },
        section
      );
    } else {
      reorderDashboardSections(true, section, () => {
        section.classList.remove("collapsed");
      });
    }
  });

  const body = document.createElement("div");
  body.className = "section-body";

  const cards = document.createElement("div");
  cards.className = "cards";

  // The special tile opens its section: it comes before the services, even
  // when no service fills the group.
  if (specialCard) cards.appendChild(specialCard);

  [...categoryServices].sort(compareServices).forEach(s => cards.appendChild(createCard(s)));

  body.appendChild(cards);
  section.append(header, body);
  return section;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sectionHomeRank(section) {
  const rank = Number(section.dataset.rank);
  return Number.isFinite(rank) ? rank : 0;
}

function getDashboardSections() {
  return [...dashboard.children].filter(
    node => node && node.classList && node.classList.contains("section")
  );
}

export function reorderDashboardSections(
  animate = false,
  forceExpand = null,
  onDone = null,
  forceCollapse = null
) {
  const sections = getDashboardSections();
  if (sections.length < 2) {
    if (onDone) onDone();
    return;
  }

  const ordered = [...sections].sort((a, b) => {
    const ac = (a.classList.contains("collapsed") || a === forceCollapse) && a !== forceExpand;
    const bc = (b.classList.contains("collapsed") || b === forceCollapse) && b !== forceExpand;
    if (ac !== bc) return ac ? 1 : -1;
    return sectionHomeRank(a) - sectionHomeRank(b);
  });

  const alreadyOrdered = ordered.every((s, i) => s === sections[i]);
  if (alreadyOrdered) {
    if (onDone) onDone();
    return;
  }

  if (!animate || prefersReducedMotion()) {
    sections.forEach(s => s.remove());
    ordered.forEach(s => dashboard.appendChild(s));
    if (onDone) onDone();
    return;
  }

  const first = new Map(ordered.map(s => [s, s.getBoundingClientRect()]));
  sections.forEach(s => s.remove());
  ordered.forEach(s => dashboard.appendChild(s));
  const last = new Map(ordered.map(s => [s, s.getBoundingClientRect()]));

  ordered.forEach(s => {
    const f = first.get(s);
    const l = last.get(s);
    s.style.transition = "none";
    s.style.transform = `translate(${f.left - l.left}px, ${f.top - l.top}px)`;
  });

  void dashboard.offsetHeight;

  requestAnimationFrame(() => {
    ordered.forEach(s => {
      s.style.transition = "transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      s.style.transform = "";
    });
    setTimeout(() => {
      ordered.forEach(s => {
        s.style.transition = "";
        s.style.transform = "";
      });
      if (onDone) onDone();
    }, 400);
  });
}
