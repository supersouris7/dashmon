// Mosaic layout of the supervision grid: a card sits right under the one
// above it in its column instead of under the tallest card of the row.
//
// The grid is cut into thin rows (UNIT px, no row gap) and each card spans as
// many as its height needs, gap included. "dense" placement lets a later card
// fill a hole left beside a wide card. A ResizeObserver keeps the spans right
// when a card opens, its data changes or the window resizes. Without the
// "masonry" class (no ResizeObserver) the grid keeps plain rows.

export const UNIT = 4;
export const GAP = 16;

// Number of columns of the grid, read from its computed tracks.
export function trackCount(template) {
  return String(template || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// Number of rows a card of this height takes, the gap below it included.
export function masonrySpan(height, unit = UNIT, gap = GAP) {
  const value = Number(height);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.ceil((value + gap) / unit);
}

let observer = null;

export function layoutMasonry(grid) {
  // The previous grid is gone after each render: stop watching its cards.
  if (observer) observer.disconnect();
  observer = null;
  if (typeof ResizeObserver === "undefined") return;
  const place = card => {
    card.style.gridRowEnd = "span " + masonrySpan(card.getBoundingClientRect().height);
  };
  // The column count lets the CSS widen a card to the whole row when two
  // columns would leave the third one empty beside it.
  const count = () => {
    grid.dataset.tracks = String(trackCount(getComputedStyle(grid).gridTemplateColumns));
  };
  grid.classList.add("masonry");
  count();
  const cards = [...grid.children];
  cards.forEach(place);
  observer = new ResizeObserver(entries =>
    entries.forEach(entry => (entry.target === grid ? count() : place(entry.target)))
  );
  observer.observe(grid);
  cards.forEach(card => observer.observe(card));
}
