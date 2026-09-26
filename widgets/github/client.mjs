// Rendu de la tuile GitHub (cote navigateur).
//
// Badge : GitHub (302). La statistique choisie est dans l'info-bulle, avec les
// autres compteurs du depot et la date de derniere poussee.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  const metric = info.metric || "stars";
  const hasValue = Number.isFinite(Number(info.value));
  // Compteur non lu alors que le depot repond (API GitHub throttle) : neutre.
  const missing = !info.ok && info.state === "up";
  const badgeClass = info.ok ? "ok" : (missing ? "warn" : "nok");

  const label = t(shortKey(metric));
  const title = [hasValue
    ? `${t("name")} · ${ctx.formatNumber(info.value)} ${label}`
    : `${t("name")} · ${t("unknownCount")}`];
  // Les autres compteurs utiles du meme appel API, pour ne pas repartir en
  // requete quand l'utilisateur passe la souris sur la tuile.
  const others = [[shortKey("stars"), info.stars], [shortKey("forks"), info.forks], [shortKey("issues"), info.openIssues]];
  for (const [key, count] of others) {
    if (key !== shortKey(metric) && Number.isFinite(Number(count))) {
      title.push(`${ctx.formatNumber(count)} ${t(key)}`);
    }
  }
  if (info.pushedAt) title.push(`${t("pushed")} ${ctx.formatDateTime(info.pushedAt)}`);
  if (info.error) title.push(String(info.error).slice(0, 120));

  return {
    badge: hasValue ? `${t("name")} (${ctx.formatCompactNumber(info.value)})` : `${t("name")} (—)`,
    badgeClass,
    time: info.ms ? `${info.ms} ms` : "",
    timeClass: "",
    title: title.join(" · ")
  };
}

// Les libelles courts ont le meme nom de cle que les longs, prefixe "metric"
// et suffixe "Short" : stars -> metricStarsShort.
function shortKey(metric) {
  return "metric" + String(metric).charAt(0).toUpperCase() + String(metric).slice(1) + "Short";
}
