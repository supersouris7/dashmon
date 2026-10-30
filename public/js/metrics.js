// Statut des services (boucle de rafraîchissement).
import { state } from "./state.js";
import { updateStatusIndicators } from "./render.js";
import { t } from "./i18n.js";
import { refreshBar, menuRefreshBtn } from "./dom.js";

let statusInflight = null;

async function refreshStatus() {
  if (statusInflight) return statusInflight;
  const refresh = (async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) return;
      state.serviceStatus = await response.json();
      updateStatusIndicators();
    } catch (_error) {}
  })();
  statusInflight = refresh;
  try {
    await refresh;
  } finally {
    if (statusInflight === refresh) statusInflight = null;
  }
}

// Duree minimale pendant laquelle le retour d'activite reste affiche. Sans elle,
// un hote local repond si vite que le repere clignote et passe inaperçu, ce qui
// est pire que ne rien afficher du tout.
const MIN_REFRESH_FEEDBACK = 700;
let statusRefreshPending = false;

function setRefreshPending(pending) {
  statusRefreshPending = pending;
  document.body.classList.toggle("is-refreshing", pending);
  if (menuRefreshBtn) {
    menuRefreshBtn.disabled = pending;
    menuRefreshBtn.setAttribute("aria-busy", pending ? "true" : "false");
  }
  if (refreshBar) refreshBar.textContent = pending ? t("refreshing") : "";
}

export async function manualRefresh() {
  // Un second clic pendant une sonde en cours empilerait un POST /api/refresh
  // sur le meme travail et ne renverrait aucun gain.
  if (statusRefreshPending) return false;

  const startedAt = Date.now();
  setRefreshPending(true);

  try {
    const response = await fetch("/api/refresh", { method: "POST", cache: "no-store" });
    if (!response.ok) return false;
    state.serviceStatus = await response.json();
    updateStatusIndicators();
    return true;
  } catch (_error) {
    return false;
  } finally {
    const remaining = MIN_REFRESH_FEEDBACK - (Date.now() - startedAt);
    if (remaining > 0) setTimeout(() => setRefreshPending(false), remaining);
    else setRefreshPending(false);
  }
}

function pageHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function startStatusLoop() {
  refreshStatus();
  state.statusTimer = setInterval(() => {
    if (!pageHidden()) refreshStatus();
  }, 60000);
}

export function setupVisibilityPause() {
  document.addEventListener("visibilitychange", () => {
    if (!pageHidden()) {
      refreshStatus();
    }
  });
}
