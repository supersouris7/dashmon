// fr/en UI translations. No DOM here: any module that only needs t() stays
// testable under Node. Applying the language to the page lives in
// language-ui.js.
import { state } from "./state.js";
import fr from "./i18n/fr.json" with { type: "json" };
import en from "./i18n/en.json" with { type: "json" };

// Interface texts, one JSON file per language: easy to read, complete or
// translate without touching code. Both files must have the same keys
// (checked by test/frontend.test.js); a missing text falls back to English,
// the default language, then to the key itself.
const UI_TEXT = { fr, en };

export function t(key) {
  return UI_TEXT[state.language]?.[key] || UI_TEXT.en[key] || key;
}

export { resolveLanguage } from "./config/language.js";
