// Rendu de la tuile Duplicati (cote navigateur).
//
// Contrat : render() ne touche jamais au DOM et renvoie un descripteur. Le core
// se charge de l'appliquer sur la tuile, ce qui garde ce module testable sous
// Node et identique a un widget tier.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("pending") };
  }
  if (info.error) {
    return {
      badge: t("error") + " —",
      badgeClass: "nok",
      time: "—",
      timeClass: "",
      title: `${t("error")} : ${String(info.error).slice(0, 120)}`
    };
  }
  if (info.ok === null || info.ok === undefined || info.lastAttemptAt == null) {
    return { badge: "—", badgeClass: "pending", time: "—", timeClass: "", title: t("never") };
  }
  return {
    badge: info.ok ? t("badgeOk") : t("badgeNok"),
    badgeClass: info.ok ? "ok" : "nok",
    time: ctx.formatDateTime(info.lastAttemptAt),
    timeClass: "",
    title: info.ok ? t("ok") : `${t("nok")} · ${ctx.formatDateTime(info.lastAttemptAt)}`
  };
}
