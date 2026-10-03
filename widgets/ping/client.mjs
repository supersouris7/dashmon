// Rendu de la tuile Ping (cote navigateur).
//
// Badge : "Ping", sans nombre et sans ligne de temps — la tuile ne sert qu'a
// montrer si l'hote repond, la pastille etant le vrai signal. La ligne 2 reste
// vide (time: "") pour ne pas afficher de temps de reponse, conformement a la
// demande. L'info-bulle porte l'etat et l'erreur, comme sur un lien classique.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: t("name"), badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  // Le lien repond (state "up") mais le test a echoue : ni vert ni rouge.
  const missing = !info.ok && info.state === "up";

  const parts = [t("name")];
  if (info.error) parts.push(String(info.error).slice(0, 120));

  return {
    badge: t("name"),
    badgeClass: info.ok ? "ok" : (missing ? "warn" : "nok"),
    time: "",
    timeClass: "",
    title: parts.join(" · ")
  };
}