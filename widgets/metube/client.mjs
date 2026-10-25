// Rendu de la tuile MeTube : activite en cours et file d'attente.

function countOf(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function render(ctx) {
  const { info, t } = ctx;
  if (!info) return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("pending") };
  if (info.error) return {
    badge: t("error") + " —", badgeClass: "nok", time: "—", timeClass: "",
    title: t("error") + " : " + String(info.error).slice(0, 120)
  };

  const active = countOf(info.active);
  const queued = countOf(info.queued);
  const completed = countOf(info.completed);
  const activeText = active + " " + t(active === 1 ? "activeOne" : "activeMany");
  const queuedText = queued + " " + t(queued === 1 ? "queuedOne" : "queuedMany");
  return {
    badge: active ? activeText : t("idle"),
    badgeClass: "ok",
    time: queued ? queuedText : "",
    timeClass: "",
    title: `${t("name")} · ${activeText} · ${queuedText} · ${t("completed")} ${completed}`
  };
}
