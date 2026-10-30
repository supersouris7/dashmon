// Validation of single values (text, URL, icon class, colour, image path).
// Mirrors lib/sanitize.js on the server: both sides must accept the same values.

export function sanitizeText(value, max = 100) {
  return String(value || "")
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F<>]/g, "")
    .slice(0, max);
}

export function sanitizeUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return "";
}

export const ICON_SAFE_RE = /^[a-z0-9][a-z0-9-]*( [a-z0-9][a-z0-9-]*)*$/;

export function sanitizeIconClass(icon) {
  const s = String(icon || "")
    .trim()
    .toLowerCase();
  if (ICON_SAFE_RE.test(s) && s.length <= 80) return s;
  return "fa-solid fa-folder";
}

// Tile colour palette: ten hues spread around the colour wheel, so two
// neighbouring categories never get two close hues. The first entry, empty,
// means "no colour": the category stays on the theme background.
export const TILE_COLORS = [
  "",
  "#7eaaee",
  "#06d6a0",
  "#ffd166",
  "#ef476f",
  "#a78bfa",
  "#f78c6b",
  "#06b6d4",
  "#c3e88d",
  "#ff6b9d",
  "#94a3b8"
];

export const COLOR_RE = /^#[0-9a-f]{6}$/;

// Same rule as the server: the value ends up in a style attribute, so only
// the 6-digit hex form passes. "#abc" is refused so that the palette shown and
// the value stored always have the same form.
export function sanitizeTileColor(value) {
  const s = String(value == null ? "" : value)
    .trim()
    .toLowerCase();
  return COLOR_RE.test(s) ? s : "";
}

// Every category and host gets a colour, even if the user picked none: a tile
// without colour looked like an unconfigured section. The colour is assigned
// here, at normalisation, not in the editor: otherwise the border would stay
// missing until the settings were opened, and the value might never be saved.
//
// The first free hue is taken, in order. Once the palette is exhausted (more
// than ten coloured items), used hues are reused: a shared colour is better
// than a section without any.
export function assignTileColors(items, used) {
  const taken = used instanceof Set ? used : new Set(used || []);
  for (const item of Array.isArray(items) ? items : []) {
    const current = sanitizeTileColor(item && item.color);
    if (current && !taken.has(current)) {
      item.color = current;
      taken.add(current);
      continue;
    }
    // Either no colour, or a colour already used elsewhere: look for the next
    // free one.
    const free = TILE_COLORS.filter(color => color && !taken.has(color))[0];
    const assigned = free || TILE_COLORS.find(color => color) || "";
    if (item) item.color = assigned;
    if (assigned) taken.add(assigned);
  }
  return taken;
}

export function sanitizeImagePath(p) {
  const s = String(p || "").trim();
  const m = s.match(/^icons\/([a-zA-Z0-9._-]+)\.png$/);
  return m ? `icons/${m[1]}.png` : "";
}
