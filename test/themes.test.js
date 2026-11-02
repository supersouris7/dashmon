"use strict";
const assert = require("assert");
const path = require("path");
const {
  normalizeTheme,
  sanitizeThemeId,
  readThemes,
  REQUIRED_VARIABLES
} = require("../lib/themes");

assert.deepEqual(
  readThemes(path.join(__dirname, "../public/themes")).map(theme => theme.id),
  ["dark", "light", "matrix"]
);

const variables = Object.fromEntries(REQUIRED_VARIABLES.map(key => [key, "#123456"]));

// The id is reduced to [a-z0-9_-]; every required variable must be present.
assert.equal(sanitizeThemeId(" My Theme! "), "my-theme");
assert.equal(normalizeTheme({ id: "x", variables: { bg: "#000" } }), null);
assert.equal(normalizeTheme({ variables }), null);

// A value cannot break out of the [data-theme] rule, and the extra CSS cannot
// load remote content or script.
const theme = normalizeTheme({
  id: "Evil",
  variables: { ...variables, accent: "red} body{display:none" },
  css: "a{background:url(https://x)} @import 'y'; b{behavior:url(z)} </style><script>"
});
assert.equal(theme.id, "evil");
assert.equal(theme.variables.accent, "red body{display:none".replace(/[{}]/g, ""));
assert.ok(!/url\(|@import|behavior:|<\/?style/i.test(theme.css));

// Native themes stay readable (WCAG contrast): text 4.5:1, status colours
// 3:1 on the surfaces, borders visible. Every status colour is defined, so no
// theme falls back on a default meant for another background.
const channels = color => {
  const hex = color.replace("#", "");
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
};
const luminance = color => {
  const [r, g, b] = channels(color).map(v =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
for (const native of readThemes(path.join(__dirname, "../public/themes"))) {
  const v = native.variables;
  for (const key of ["success", "error", "warning"]) assert.ok(v[key], `${native.id} ${key}`);
  const checks = [
    ["text", ["bg", "surface", "surface-2"], 4.5],
    ["muted", ["bg", "surface", "surface-2"], 4.5],
    ["accent", ["bg", "surface"], 4.5],
    ["success", ["bg", "surface"], 3],
    ["error", ["bg", "surface"], 3],
    ["warning", ["bg", "surface"], 3],
    ["border", ["bg"], 1.5]
  ];
  for (const [fore, backs, min] of checks)
    for (const back of backs) {
      const ratio = contrast(v[fore], v[back]);
      assert.ok(ratio >= min, `${native.id} ${fore}/${back} ${ratio.toFixed(2)} < ${min}`);
    }
}

console.log("PASS themes : identifiant, variables, CSS nettoyes et contrastes natifs");
