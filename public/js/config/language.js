// Interface language. Depends on nothing, so the tests can load it.

// Language shown for a setting: "fr" or "en" when the user picked one,
// otherwise ("" = automatic) the browser's, French or English.
export function resolveLanguage(setting, languages = browserLanguages()) {
  if (setting === "fr" || setting === "en") return setting;
  return String(languages[0] || "")
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";
}

function browserLanguages() {
  const browser = globalThis.navigator;
  if (Array.isArray(browser?.languages) && browser.languages.length) return browser.languages;
  return [browser?.language || ""];
}
