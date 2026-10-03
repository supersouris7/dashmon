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
    line(t("down"), down, "var(--error)")
  );

  box.title = known
    ? t("name") + " · " + info.total + " " + (info.total === 1 ? t("monitor") : t("monitors"))
    : t("name") + " · " + ((info && info.error) || t("missingConfig"));

  return box;
}