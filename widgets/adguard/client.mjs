// Rendu de la tuile AdGuard Home (cote navigateur).

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }
  if (info.error) {
    return {
      badge: t("name") + " —",
      badgeClass: "nok",
      time: "—",
      timeClass: "",
      title: `${t("error")} : ${String(info.error).slice(0, 120)}`
    };
  }
  const queries = Number(info.queries) || 0;
  const pct = Math.round(Number(info.ratio) || 0);
  const avg = info.avgMs != null ? ` · ${info.avgMs} ms` : "";
  return {
    badge: `${t("blocked")} ${pct} %`,
    badgeClass: "ok",
    time: `${t("queries")} ${ctx.formatNumber(queries)}`,
    timeClass: "",
    title: `${t("name")} · ${ctx.formatCompactNumber(queries)} ${t("queries")} · ${pct} % ${t("blocked")}${avg}`
  };
}
