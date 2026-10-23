// Rendu du rapport APT local. Le script de l'hote decide quand faire les mises
// a jour ; le widget ne demande jamais a Dashmon de lancer apt.

export function render(ctx) {
  const { info, t, formatDateTime } = ctx;
  const report = info && info.report;
  if (!report) {
    return { badge: "—", badgeClass: "warn", time: "—", timeClass: "", title: t("noReport") };
  }
  if (report.status === "failed") {
    return { badge: t("failed"), badgeClass: "down", time: "—", timeClass: "", title: t("failed") };
  }
  const updated = Number(report.updated) || 0;
  const badge = updated === 0 ? t("updated") : `${updated} ${t(updated === 1 ? "updatedOne" : "updatedMany")}`;
  const reboot = report.rebooting ? t("rebooting") : report.rebootRequired ? t("rebootRequired") : "";
  const date = report.finishedAt ? formatDateTime(new Date(Number(report.finishedAt) * 1000)) : "—";
  return {
    badge,
    badgeClass: report.rebootRequired ? "warn" : "ok",
    time: reboot || date,
    timeClass: report.rebootRequired ? "warn" : "",
    title: `${t("lastRun")} : ${date}${reboot ? ` · ${reboot}` : ""}`
  };
}
