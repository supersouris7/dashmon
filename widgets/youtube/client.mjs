// Rendu de la tuile YouTube (cote navigateur).
//
// Badge : YouTube (3 450). La tuile reste verte quand la page a repondu, meme
// si le compteur est introuvable ou que la lecture a ete bridee (l'info-bulle
// le dit). Ligne 2 : le temps de reponse, comme sur un lien classique.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  // null ne vaut pas zero : une page repondante sans compteur ne doit pas
  // afficher "0 abonnés".
  const hasCount = info.subscribers != null && Number.isFinite(Number(info.subscribers));
  // Le lien repond (state "up") mais la metrique manque : ni vert ni rouge.
  const missing = !info.ok && info.state === "up";

  const title = [hasCount
    ? `${t("name")} · ${ctx.formatNumber(info.subscribers)} ${t("subscribers")}`
    : `${t("name")} · ${t("unknownCount")}`];
  if (info.error) title.push(String(info.error).slice(0, 120));

  return {
    badge: hasCount ? `${t("name")} (${ctx.formatCompactNumber(info.subscribers)})` : `${t("name")} (—)`,
    badgeClass: info.ok ? "ok" : (missing ? "warn" : "nok"),
    time: info.ms ? `${info.ms} ms` : "",
    timeClass: "",
    title: title.join(" · ")
  };
}
