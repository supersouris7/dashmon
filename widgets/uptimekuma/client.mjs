// Rendu de la tuile Uptime Kuma (cote navigateur).
//
// Une ligne par page de statut configuree : le nom de la page et son nombre de
// moniteurs en ligne. La ligne est verte quand tout est en ligne, rouge des
// qu'un moniteur tombe ou que la page n'a pas pu etre lue. Aucun seuil : deux
// etats, pas trois.
//
// En mode petites icones, les lignes se suivent sur une seule ligne.
//
// Les styles sont poses en ligne plutot que dans une feuille client.css : ne pas
// dependre d'une feuille injectee evite qu'un cache navigateur fige la mise en
// page. Le centre de la tuile pose la classe small-icons avant de construire les
// cartes, donc le mode se lit ici directement.

function isSmallIcons() {
  const board = document.getElementById("dashboard");
  return !!board && board.classList.contains("small-icons");
}

// "up" n'est pas traduit, volontairement : c'est le mot que tout le monde lit
// dans un outil de supervision, et "en ligne" doublerait la largeur de la tuile
// pour dire la meme chose. Le manifeste ne declare donc aucune chaine "up" —
// si on la reintroduisait, elle serait traduite par erreur.
const UP = "up";

export function pageColor(healthy) {
  return healthy ? "var(--success)" : "var(--error)";
}

// null ne vaut pas zero : Number(null) vaut 0, qui est "fini", et une page
// illisible s'afficherait "infra 0 up" au lieu d'un tiret. Le test exclut donc
// null explicitement avant de regarder le nombre.
export function countText(up, label) {
  if (up == null || !Number.isFinite(Number(up))) return "—";
  return Number(up) + " " + label;
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

  const line = (text, color, title) => {
    const span = document.createElement("span");
    span.style.fontSize = "11px";
    span.style.fontWeight = "700";
    span.style.lineHeight = "1.4";
    span.style.whiteSpace = "nowrap";
    span.style.color = color;
    span.textContent = text;
    if (title) span.title = title;
    return span;
  };

  const pages = info && Array.isArray(info.pages) ? info.pages : [];
  if (!pages.length) {
    box.append(line("—", "var(--muted)", (info && info.error) || t("missingConfig")));
    box.title = t("name") + " · " + ((info && info.error) || t("missingConfig"));
    return box;
  }

  for (const page of pages) {
    // Le nom vient de la page de statut, pas du slug : l'utilisateur reconnait
    // "Services" tout de suite, "services" dans une tuile de 60 px beaucoup
    // moins.
    const count = countText(page.up, UP);
    const detail = page.error
      ? page.error
      : t("name") + " · " + page.up + "/" + page.total + " " + UP;
    box.append(line(page.name + " " + count, pageColor(page.healthy), detail));
  }

  box.title = pages
    .map(page => page.name + " · " + (page.error || (page.up + "/" + page.total + " " + UP)))
    .join(" · ");
  return box;
}