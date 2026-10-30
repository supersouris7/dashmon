// Display formatting shared by the dashboard and the widgets.
//
// This module depends on nothing: it receives the language as a parameter
// instead of reading `state`. Two reasons:
//   1. the widget registry stays usable without the state (tests, workers);
//   2. no import cycle between state.js, render.js and widget-registry.js.
//
// The core passes these functions to a widget renderer through its `ctx`
// context (see widgets/*/client.mjs), so a third-party widget shows numbers
// and dates exactly like the rest of the dashboard.

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

// Compact, language-independent counter: k for thousands, M for millions, no
// space ("3k", "10.2k", "64.6M"). This is the format of the web link counters;
// Intl would produce "3 k" in French and "3K" in English.
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
  // 999,950 and above would round to "1000k": switch to millions to stay
  // readable.
  if (unit === "k" && Math.abs(shown) >= 1000) {
    shown = Math.round((value / 1e6) * 10) / 10;
    unit = "M";
  }
  return shown + unit;
}

// Helpers passed to the widget renderers' context.
export function formatters(lang) {
  return {
    formatDateTime: ms => formatDateTime(ms, lang),
    formatNumber: n => formatNumber(n, lang),
    formatCompactNumber: n => formatCompactNumber(n, lang),
    formatCompactCount: n => formatCompactCount(n)
  };
}
