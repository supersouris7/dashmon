// Module resolution hook for Node: "/js/..." is the URL of a browser module
// (public/js/...). The bundled supervision cards import the interface modules
// that way, which only the browser understands; the tests and
// scripts/check-plugin.js register this hook to import them under Node.
//   require("node:module").register("./browser-paths.mjs", pathToFileURL(__filename))
const PUBLIC = new URL("../public/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("/js/")) return next(new URL("." + specifier, PUBLIC).href, context);
  return next(specifier, context);
}
