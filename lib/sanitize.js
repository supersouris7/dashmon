"use strict";

// Shared validation of the values entering the server configuration.
function sanitizeText(value, max = 100) {
  return String(value || "")
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F<>]/g, "")
    .slice(0, max);
}
function sanitizeColor(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return /^#[0-9a-f]{6}$/.test(text) ? text : "";
}
function sanitizeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch (_error) {}
  return "";
}
function sanitizeIconClass(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9-]*( [a-z0-9][a-z0-9-]*)*$/.test(text) && text.length <= 80
    ? text
    : "fa-solid fa-folder";
}
function sanitizeImagePath(value) {
  const match = String(value || "")
    .trim()
    .match(/^icons\/([a-zA-Z0-9._-]+)\.png$/);
  return match ? `icons/${match[1]}.png` : "";
}
module.exports = { sanitizeText, sanitizeColor, sanitizeUrl, sanitizeIconClass, sanitizeImagePath };
