// Rendu de la tuile Uptime Kuma (cote navigateur).
//
// Deux lignes : les moniteurs en ligne en vert, les moniteurs hors ligne en
// rouge, toutes deux en gras. En mode petites icones, le conteneur passe sur
// une seule ligne — c'est le CSS du widget (client.css) qui le fait, via la
// classe .small-icons du tableau de bord, donc le renderer n'a pas a connaitre
// le mode d'affichage.

export function element(ctx) {
  const { info, t } = ctx;

  const box = document.createElement("div");
  box.className = "uptimekuma-stats";

  const known = !!info && Number.isFinite(Number(info.up)) && Number.isFinite(Number(info.down));

  const line = (state, label, value) => {
    const span = document.createElement("span");
    span.className = "uptimekuma-line uptimekuma-" + state;
    // Le nombre passe devant le libelle : "8 en ligne" se lit mieux ainsi.
    span.textContent = known ? value + " " + label : "—";
    return span;
  };

  const up = info && Number.isFinite(Number(info.up)) ? Number(info.up) : 0;
  const down = info && Number.isFinite(Number(info.down)) ? Number(info.down) : 0;

  box.append(
    line("up", t("up"), up),
    line("down", t("down"), down)
  );
  box.title = known
    ? t("name") + " · " + info.total + " " + (info.total === 1 ? t("monitor") : t("monitors"))
    : t("name") + " · " + ((info && info.error) || t("missingConfig"));

  return box;
}