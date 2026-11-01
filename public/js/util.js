// Small generic helpers with no dependency, safe to import from anywhere.

export function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function normalize(v) {
  return (v || "").toString().trim().toLowerCase();
}

// Search comparison: case and accents ignored, so "securite" finds "Sécurité".
export function foldText(v) {
  return normalize(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function compareNames(a, b) {
  return (a || "").localeCompare(b || "", "fr", { sensitivity: "base" });
}

export function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}
