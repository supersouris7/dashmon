// Rendu de la tuile Gotify : dernier message et priorite.

export function render(ctx) {
  const { info, t } = ctx;
  if (!info)
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("pending") };
  if (info.error)
    return {
      badge: t("error") + " —",
      badgeClass: "nok",
      time: "—",
      timeClass: "",
      title: t("error") + " : " + String(info.error).slice(0, 120)
    };
  if (!info.latest)
    return {
      badge: t("empty"),
      badgeClass: "ok",
      time: "",
      timeClass: "",
      title: t("name") + " · " + t("empty")
    };

  const latest = info.latest;
  const priority = Number(latest.priority) || 0;
  const badge = String(latest.title || latest.message || t("name")).slice(0, 80);
  const detail = latest.message ? " · " + String(latest.message).slice(0, 120) : "";
  const date = latest.receivedAt == null ? "" : " · " + ctx.formatDateTime(latest.receivedAt);
  return {
    badge,
    badgeClass: priority >= 8 ? "nok" : priority >= 5 ? "warn" : "ok",
    time: t("priority") + " " + priority,
    timeClass: "",
    title: `${t("name")} · ${t("priority")} ${priority}${date}${detail}`
  };
}
