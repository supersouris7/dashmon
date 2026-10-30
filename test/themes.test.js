"use strict";
const assert = require("assert");
const { normalizeTheme, sanitizeThemeId, REQUIRED_VARIABLES } = require("../lib/themes");

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

console.log("PASS themes : identifiant, variables et CSS nettoyes");
