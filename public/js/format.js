// Formatage d'affichage partage entre le dashboard et les widgets.
//
// Ce module ne depend d'aucun autre : il recoit la langue en parametre au lieu
// de lire `state`. Deux raisons :
//   1. le registre des widgets reste utilisable sans le state (tests, worker) ;
//   2. aucun cycle d'import entre state.js, render.js et widget-registry.js.
//
// Le core passe ces fonctions au renderer d'un widget via le contexte `ctx`
// (cf. widgets/*/client.js), donc un widget tiers affiche ses nombres et ses
// dates exactement comme le reste du dashboard.

function localeOf(lang) {
  return lang === "en" ? "en-GB" : "fr-FR";
}

export function formatDateTime(ms, lang) {
  try {
    return new Intl.DateTimeFormat(localeOf(lang), {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(ms));
  } catch (_error) {
    return "";
  }
}

export function formatNumber(n, lang) {
  try {
    return new Intl.NumberFormat(localeOf(lang)).format(Number(n) || 0);
  } catch (_error) {
    return String(n);
  }
}

export function formatCompactNumber(n, lang) {
  try {
    const value = Number(n) || 0;
    if (value >= 100000) {
      return new Intl.NumberFormat(localeOf(lang), { notation: "compact", maximumFractionDigits: 1 }).format(value);
    }
    return new Intl.NumberFormat(localeOf(lang)).format(value);
  } catch (_error) {
    return String(n);
  }
}

// Utilitaires passes au contexte des renderers de widgets.
export function formatters(lang) {
  return {
    formatDateTime: ms => formatDateTime(ms, lang),
    formatNumber: n => formatNumber(n, lang),
    formatCompactNumber: n => formatCompactNumber(n, lang)
  };
}
