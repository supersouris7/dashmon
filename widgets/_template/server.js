"use strict";
// WIDGET TEMPLATE: copy this folder to widgets/<your-id>/ and set "id" in
// manifest.json to the folder name. A folder starting with "_" is never
// loaded. Full guide: docs/EXTENDING.md; check it with
// `npm run plugin:check -- widgets/<your-id>`.
//
// A widget is three files:
//   manifest.json  labels, check period, configuration schema
//   server.js      the check, run in the container (this file)
//   client.mjs     the tile renderer, run in the browser
// Nothing else changes: not server.js at the root, the editor, the CSS or i18n.

function createState() {
  // Memory kept between two checks (cached tokens, history...). Optional.
  return { calls: 0 };
}

// ctx = {
//   config  : the widget configuration, secrets DECRYPTED here only
//   service : the service as stored in config.json (name, url, ...)
//   state   : the object returned by createState()
//   api     : (baseUrl, path, options) => Promise<json>  shared HTTP client
//   probe   : (href) => { ok, code, ms, error }           link probe
//   storage : read(name, fallback) / write(name, value)   survives a restart
//   log     : (message) => one line in the Dashmon logs
//   resultError(code) : { errorCode, error } of a common failure (invalid_url,
//             token_missing...), shown in the viewer's language
//   sanitizeUrl, sanitizeText, t(key)
// Use what ctx provides rather than require("../../lib/..."): that path
// breaks once the widget is installed outside widgets/.
// }
//
// Returns a flat JSON object: the status entry your client.mjs displays.
// "ok", "ms", "lastCheck" and "state" are managed by the core; the rest is
// yours. Do not throw: return { ok: false, error } (an exception is caught
// and shown the same way, but an explicit result is clearer).
async function check(ctx) {
  const baseUrl = ctx.sanitizeUrl(ctx.config.url);
  if (!baseUrl) {
    // A common cause: a code translated in the viewer's language by the tile.
    return { ok: false, ...ctx.resultError("invalid_url") };
  }
  try {
    const data = await ctx.api(baseUrl, "/stats", { token: ctx.config.token });
    ctx.state.calls++;
    return {
      ok: true,
      value: Number(data && data.value) || 0,
      detail: String((data && data.detail) || "")
    };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || "Erreur").slice(0, 200) };
  }
}

// Optional: called after each cycle to forget what is no longer monitored
// (tokens of a removed server, history of a deleted service). The first
// argument is the set of URLs still monitored by this widget.
// function purge(activeUrls, state) { ... }

module.exports = { createState, check };
