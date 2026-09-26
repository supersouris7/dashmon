// Rendu de la tuile Docker Hub (cote navigateur).
//
// Badge : Docker Hub (12,4 M). Le detail (pulls, etoiles, derniere mise a
// jour) est dans l'info-bulle, la ligne du dessous garde le temps de reponse.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  const hasCount = Number.isFinite(Number(info.pulls));
  // Le widget mesure un compteur qu'il n'a pas pu lire (repo sans compteur,
  // API throttle) : le lien repond, la tuile est donc neutre et non rouge.
  const missing = !info.ok && info.state === "up";
  const badgeClass = info.ok ? "ok" : (missing ? "warn" : "nok");

  const title = [hasCount
    ? `${t("name")} · ${ctx.formatNumber(info.pulls)} ${t("pulls")}`
    : `${t("name")} · ${t("unknownCount")}`];
  if (Number.isFinite(Number(info.stars))) {
    title.push(`${ctx.formatNumber(info.stars)} ${t("stars")}`);
  }
  if (info.lastPush) title.push(ctx.formatDateTime(info.lastPush));
  if (info.error) title.push(String(info.error).slice(0, 120));

  return {
    badge: hasCount ? `${t("name")} (${ctx.formatCompactNumber(info.pulls)})` : `${t("name")} (—)`,
    badgeClass,
    time: info.ms ? `${info.ms} ms` : "",
    timeClass: "",
    title: title.join(" · ")
  };
}
