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
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
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
      return new Intl.NumberFormat(localeOf(lang), {
        notation: "compact",
        maximumFractionDigits: 1
      }).format(value);
    }
    return new Intl.NumberFormat(localeOf(lang)).format(value);
  } catch (_error) {
    return String(n);
  }
}

// Compteur compact, independant de la langue : k pour les milliers, M pour les
// millions, sans espace ("3k", "10.2k", "64.6M"). C'est le format des compteurs
// du bandeau de liens ; Intl produirait "3 k" en francais et "3K" en anglais.
export function formatCompactCount(n) {
  const value = Math.round(Number(n));
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  let div = 1,
    unit = "";
  if (abs >= 1e6) {
    div = 1e6;
    unit = "M";
  } else if (abs >= 1e3) {
    div = 1e3;
    unit = "k";
  }
  let shown = Math.round((value / div) * 10) / 10;
  // 999 950+ arrondirait a "1000k" : on monte au million pour rester lisible.
  if (unit === "k" && Math.abs(shown) >= 1000) {
    shown = Math.round((value / 1e6) * 10) / 10;
    unit = "M";
  }
  return shown + unit;
}

// Utilitaires passes au contexte des renderers de widgets.
export function formatters(lang) {
  return {
    formatDateTime: ms => formatDateTime(ms, lang),
    formatNumber: n => formatNumber(n, lang),
    formatCompactNumber: n => formatCompactNumber(n, lang),
    formatCompactCount: n => formatCompactCount(n)
  };
}
