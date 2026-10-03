// Rendu de la tuile Uptime Kuma (cote navigateur).
//
// Deux lignes : les moniteurs en ligne en vert, les moniteurs hors ligne en
// rouge, toutes deux en gras. En mode petites icones, les deux compteurs se
// suivent sur une seule ligne, avec un espace entre eux.
//
// Les styles sont poses en ligne plutot que dans une feuille client.css : le
// centre de la tuile (une colonne) et sa version sur une ligne sont les seuls
// points qui doivent tenir, et ne pas dependre d'une feuille injectee evite
// qu'un cache Navigateur Perpille les deux lignes. Le centre de la tuile pose
// la classe small-icons avant de construire les cartes, donc le mode se lit ici
// directement.

function isSmallIcons() {
  const board = document.getElementById("dashboard");
  return !!board && board.classList.contains("small-icons");
}

// Seuil d'alerte : nombre de moniteurs hors ligne au-dela duquel la ligne passe
// au rouge. En dessous, elle reste grise — un moniteur tombe par fois n'est pas
// une panne, et une tuile rouge en permanence n'apprend plus rien. 0 par defaut
// des que la couleur reste neutre tant que le seuil n'est pasfranchi.
export const DEFAULT_THRESHOLD = 1;

export function thresholdOf(config) {
  const raw = config ? config.threshold : null;
  if (raw == null || raw === "") return DEFAULT_THRESHOLD;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : DEFAULT_THRESHOLD;
}

// La couleur porte le sens : rouge quand la panne est au-dela du seuil, gris en
// dessous. Le nombre reste affiche dans les deux cas, on ne cache jamais une
// information — seule la couleur se calme.
export function downColor(down, threshold) {
  const value = Number(down);
  const limit = Number(threshold);
  if (!Number.isFinite(value)) return "var(--muted)";
  return value > limit ? "var(--error)" : "var(--muted)";
}

export function element(ctx) {
  const { info, t } = ctx;
  const small = isSmallIcons();

  const box = document.createElement("div");
  box.style.display = "flex";
  box.style.flexDirection = small ? "row" : "column";
  box.style.alignItems = "flex-end";
  box.style.justifyContent = "flex-end";
  box.style.gap = small ? "8px" : "2px";
  box.style.minWidth = "0";

  const known = !!info
    && Number.isFinite(Number(info.up))
    && Number.isFinite(Number(info.down));

  const up = known ? Number(info.up) : null;
  const down = known ? Number(info.down) : null;

  // L'intitule d'abord, le chiffre ensuite : "en ligne 8", "hors ligne 2".
  const line = (label, value, color) => {
    const span = document.createElement("span");
    span.style.fontSize = "11px";
    span.style.fontWeight = "700";
    span.style.lineHeight = "1.4";
    span.style.whiteSpace = "nowrap";
    span.style.color = color;
    span.textContent = value == null ? "—" : label + " " + value;
    return span;
  };

  box.append(
    line(t("up"), up, "var(--success)"),
    line(t("down"), down, downColor(down == null ? NaN : down, thresholdOf(ctx.config)))
  );

  const parts = [t("name")];
  if (known) {
    parts.push(up + " " + t("up") + " · " + down + " " + t("down"));
    const names = Array.isArray(info.downNames) ? info.downNames.filter(Boolean) : [];
    if (names.length) parts.push(names.join(", "));
  } else {
    parts.push((info && info.error) || t("missingConfig"));
  }
  box.title = parts.join(" · ");

  return box;
}