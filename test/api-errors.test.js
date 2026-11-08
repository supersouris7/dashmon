"use strict";
// API errors: stable codes on the server, a translation for each in both
// interface languages, and the interface falls back to the text it received.
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { API_ERRORS, apiError, resultError } = require("../lib/http/api-errors");
const fr = require("../public/js/i18n/fr.json");
const en = require("../public/js/i18n/en.json");

async function main() {
  for (const code of Object.keys(API_ERRORS)) {
    assert.match(code, /^[a-z_]{1,40}$/, code);
    assert.ok(fr["apiError_" + code], "fr: " + code);
    assert.ok(en["apiError_" + code], "en: " + code);
  }
  assert.deepEqual(apiError("route_not_found"), {
    code: "route_not_found",
    error: "Unknown route"
  });
  // In a check result "code" is the HTTP status: the error code goes apart.
  assert.deepEqual(resultError("invalid_url"), { errorCode: "invalid_url", error: "Invalid URL" });
  assert.throws(() => apiError("no_such_code"), /Unknown API error code/);

  const { errorText } = await import(
    pathToFileURL(path.join(__dirname, "..", "public", "js", "api-error.js")).href
  );
  const { state } = await import(
    pathToFileURL(path.join(__dirname, "..", "public", "js", "state.js")).href
  );
  state.language = "fr";
  assert.equal(errorText(apiError("auth_required")), "Authentification requise");
  assert.equal(errorText({ ...resultError("invalid_url"), code: 404 }), "URL invalide");
  // An older agent: text only, shown as it is; nothing at all: the fallback.
  assert.equal(errorText({ error: "Instance inaccessible" }), "Instance inaccessible");
  assert.equal(errorText({ code: "unknown_one", error: "Raw" }), "Raw");
  assert.equal(errorText(null, "statusNoResponse"), fr.statusNoResponse);
  state.language = "en";
  assert.equal(errorText(apiError("auth_required")), "Authentication required");
  console.log("PASS erreurs API : codes stables, traduits en francais et en anglais");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
