// "Columns" view of the dashboard as a mosaic: each category goes under the
// previous one of its column instead of under the tallest category of the
// row, and the order stays the one of the settings.
//
// The categories are placed in their order, each into the column that is the
// least tall so far (leftmost on a tie). That choice of column is made when
// the dashboard is drawn or when the number of columns changes; folding or
// unfolding a category only moves the categories below it in its column, it
// never sends a category to another column.
//
// The grid is cut into thin rows (UNIT px, no row gap): each category spans
// the rows its height needs, with explicit grid-column and grid-row values. A
// ResizeObserver keeps the rows right when tiles fill in or the window
// resizes. Without ResizeObserver the plain grid of base.css applies.
import { trackCount } from "../supervision/masonry.js";

export const UNIT = 4;
// Vertical gap between two categories of a column.
export const GAP = 10;

export function rowSpan(height, unit = UNIT, gap = GAP) {
  const value = Number(height);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.ceil((value + gap) / unit);
}

// Pure placement. heights: one per category, in order. columns: the column of
// each category when already chosen (kept), otherwise chosen here. Returns
// { column, start, span } per category, columns and rows counted from 0.
export function placeColumns(heights, count, columns = []) {
  const tops = new Array(Math.max(1, count)).fill(0);
  return heights.map((height, index) => {
    const span = rowSpan(height);
    let column = columns[index];
    if (!Number.isInteger(column) || column < 0 || column >= tops.length) {
      column = tops.indexOf(Math.min(...tops));
    }
    const start = tops[column];
    tops[column] += span;
    return { column, start, span };
  });
}

// Looked up when used: the placement above stays importable without a page
// (tests).
const board = () => document.getElementById("dashboard");

let observer = null;
let assignedCount = 0;
let frame = 0;

function sections() {
  return [...board().children].filter(node => node.classList?.contains("section"));
}

function clear() {
  board().classList.remove("mosaic");
  for (const section of sections()) {
    section.style.gridColumn = "";
    section.style.gridRow = "";
    delete section.dataset.column;
  }
}

// keepColumns: false re-chooses the column of every category.
function place(keepColumns) {
  const list = sections();
  const count = trackCount(getComputedStyle(board()).gridTemplateColumns);
  const keep = keepColumns && count === assignedCount;
  const heights = list.map(section => section.getBoundingClientRect().height);
  const layout = placeColumns(
    heights,
    count,
    keep ? list.map(section => Number(section.dataset.column)) : []
  );
  assignedCount = count;
  layout.forEach(({ column, start, span }, index) => {
    const section = list[index];
    section.dataset.column = String(column);
    section.style.gridColumn = String(column + 1);
    section.style.gridRow = `${start + 1} / span ${span}`;
  });
}

function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (board().classList.contains("mosaic")) place(true);
  });
}

// Called after each drawing of the dashboard.
export function layoutColumns() {
  if (observer) observer.disconnect();
  observer = null;
  if (
    board().dataset.view !== "columns" ||
    typeof ResizeObserver === "undefined" ||
    !sections().length
  ) {
    clear();
    return;
  }
  board().classList.add("mosaic");
  place(false);
  observer = new ResizeObserver(schedule);
  observer.observe(board());
  sections().forEach(section => observer.observe(section));
}

// Folds or unfolds one category in place. The categories that move (those
// below it in its column, or below it in the other views) slide to their new
// position instead of jumping.
export function toggleSectionInPlace(section, collapse) {
  const list = sections();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const before = reduced ? null : new Map(list.map(item => [item, item.getBoundingClientRect()]));
  section.classList.toggle("collapsed", collapse);
  if (board().classList.contains("mosaic")) place(true);
  if (!before) return;
  const moved = [];
  for (const item of list) {
    if (item === section) continue;
    const from = before.get(item);
    const to = item.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy) continue;
    item.style.transition = "none";
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    moved.push(item);
  }
  if (!moved.length) return;
  // Start from the old positions, then slide to the new ones.
  void board().offsetHeight;
  requestAnimationFrame(() => {
    for (const item of moved) {
      item.style.transition = "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      item.style.transform = "";
      item.addEventListener(
        "transitionend",
        () => {
          item.style.transition = "";
        },
        { once: true }
      );
    }
  });
}
