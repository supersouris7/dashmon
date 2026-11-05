// OpenCode tile: today's tokens, then the last 30 days and the main model. An
// old report keeps its figures, greyed, with its date in the tooltip.

function costText(value, lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function render(ctx) {
  const { info, t, lang, formatCompactNumber, formatDateTime } = ctx;
  if (!info)
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };

  const origin = info.source === "agent" && info.hostName ? ` · ${t("via")} ${info.hostName}` : "";
  if (!info.found) {
    return {
      badge: t("noReport"),
      badgeClass: "pending",
      time: "",
      timeClass: "",
      title: `${t("name")}${origin} · ${t("noReport")} · ${t("noReportHint")}`
    };
  }

  const today = info.today || {};
  const month = info.month || {};
  const monthLine = `${t("days30")} ${formatCompactNumber(month.tokens || 0)}`;
  const time = info.model ? `${monthLine} · ${info.model}` : monthLine;
  const details = [
    `${t("name")}${origin}`,
    `${t("today")} ${formatCompactNumber(today.tokens || 0)} ${t("tokens")}, ${today.sessions || 0} ${t("sessions")}`,
    `${monthLine} ${t("tokens")}, ${month.sessions || 0} ${t("sessions")}` +
      (month.cost > 0 ? `, ${t("cost")} ${costText(month.cost, lang)}` : "")
  ];
  if (info.fetchedAt) {
    details.push(
      `${info.stale ? t("stale") + " · " : ""}${t("reportOf")} ${formatDateTime(info.fetchedAt)}`
    );
  }
  return {
    badge: `${formatCompactNumber(today.tokens || 0)} ${t("tokens")}`,
    badgeClass: info.stale ? "pending" : today.tokens > 0 ? "ok" : "",
    time,
    timeClass: info.stale ? "pending" : "",
    title: details.join("\n")
  };
}
