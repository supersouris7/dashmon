// Descriptor of a supervision plugin card (supervisions/<id>/client.mjs),
// checked and bounded before drawing. No DOM: tested under Node
// (test/supervisions.test.js); plugin-card.js draws the result.

export const LEVELS = {
  ok: { level: "healthy", icon: "fa-solid fa-circle-check" },
  warning: { level: "warning", icon: "fa-solid fa-circle-exclamation" },
  critical: { level: "critical", icon: "fa-solid fa-triangle-exclamation" },
  unknown: { level: "unknown", icon: "fa-solid fa-circle-question" }
};
const TONES = new Set(["ok", "warning", "critical"]);
const MAX_ROWS = 30;

function text(value, max = 200) {
  return value == null ? "" : String(value).slice(0, max);
}

function rows(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_ROWS)
    .filter(row => row && typeof row === "object")
    .map(row => ({
      label: text(row.label, 100),
      value: text(row.value, 200),
      tone: TONES.has(row.tone) ? row.tone : ""
    }))
    .filter(row => row.label || row.value);
}

// Descriptor returned by card(ctx), bounded and typed. null when it is not
// an object: the card is then not drawn.
export function cardView(view) {
  if (!view || typeof view !== "object" || Array.isArray(view)) return null;
  return {
    status: Object.hasOwn(LEVELS, view.status) ? view.status : "",
    summary: text(view.summary, 200),
    value: text(view.value, 40),
    unit: text(view.unit, 60),
    rows: rows(view.rows),
    details: rows(view.details),
    note: text(view.note, 1000)
  };
}
