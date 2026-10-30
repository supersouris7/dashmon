"use strict";
// Colour themes: validation and reading of the JSON theme files.
//
// Native themes ship in public/themes/; custom themes are imported by the
// user into the data folder. A theme is a set of CSS variables plus optional
// extra CSS, applied to every visitor: everything is sanitised here.

const fs = require("fs");
const path = require("path");

const REQUIRED_VARIABLES = [
  "bg",
  "surface",
  "surface-2",
  "surface-3",
  "border",
  "text",
  "muted",
  "accent",
  "danger",
  "shadow"
];
// Optional semantic colours (status): without them the theme inherits the CSS
// defaults (--success / --error).
const OPTIONAL_VARIABLES = ["success", "error"];
const MAX_CSS_LENGTH = 65536;

function sanitizeThemeId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Must stay identical to sanitizeVarValue in public/js/themes.js: without the
// same filtering, a value such as `red} body{display:none` would break out of
// the injected [data-theme] rule and apply to every visitor.
function sanitizeVarValue(value) {
  return String(value || "")
    .trim()
    .replace(/[\{\}\;\n\r\"\'\<\>\\]/g, "")
    .slice(0, 200);
}

function sanitizeThemeCss(css) {
  const s = String(css || "").slice(0, MAX_CSS_LENGTH);
  let out = s.replace(/<\s*\/?style/gi, "");
  out = out.replace(/@(import|charset|font-face)\b/gi, "");
  out = out.replace(/url\s*\(/gi, "none");
  out = out.replace(
    /(expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:)/gi,
    ""
  );
  return out;
}

const text = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

// Returns a clean theme, or null when the id or a required variable is missing.
function normalizeTheme(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const id = sanitizeThemeId(input.id || input.name);
  if (!id) return null;

  const variables = input.variables || {};
  const clean = {};
  for (const key of REQUIRED_VARIABLES) {
    const value = variables[key];
    if (typeof value === "string" && value.trim()) clean[key] = sanitizeVarValue(value);
  }
  if (Object.keys(clean).length !== REQUIRED_VARIABLES.length) return null;

  for (const key of OPTIONAL_VARIABLES) {
    const value = variables[key];
    if (typeof value === "string" && value.trim())
      clean[key] = sanitizeVarValue(value).slice(0, 40);
  }

  return {
    id,
    name: text(input.name || id, 80),
    author: text(input.author, 80),
    description: text(input.description, 300),
    version: text(input.version || "1.0.0", 20),
    variables: clean,
    css: sanitizeThemeCss(typeof input.css === "string" ? input.css : "")
  };
}

function themeFile(dir, id) {
  return path.join(dir, id + ".json");
}

// The file name is the theme id. An unreadable or invalid file is skipped.
function readTheme(dir, id) {
  try {
    const target = themeFile(dir, id);
    if (!fs.existsSync(target)) return null;
    const theme = JSON.parse(fs.readFileSync(target, "utf8"));
    return normalizeTheme({ ...theme, id });
  } catch (_error) {
    return null;
  }
}

function listThemeIds(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map(entry => path.parse(entry.name).name)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

function readThemes(dir) {
  return listThemeIds(dir)
    .map(id => readTheme(dir, id))
    .filter(Boolean);
}

module.exports = {
  normalizeTheme,
  sanitizeThemeId,
  readTheme,
  readThemes,
  themeFile,
  REQUIRED_VARIABLES,
  MAX_CSS_LENGTH
};
