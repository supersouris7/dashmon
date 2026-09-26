// Rendu de la tuile Lichess (cote navigateur).

const VARIANT_LABELS = {
  fr: { bullet: "Bullet", blitz: "Blitz", rapid: "Rapide", classical: "Classique" },
  en: { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical" }
};

function variantLabel(variant, lang) {
  const labels = VARIANT_LABELS[lang] || VARIANT_LABELS.en;
  return labels[variant] || variant || "";
}

export function render(ctx) {
  const { info, t, lang } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }
  if (info.error) {
    return {
      badge: "ELO —",
      badgeClass: "",
      time: "—",
      timeClass: "",
      title: `${t("error")} : ${String(info.error).slice(0, 120)}`
    };
  }
  if (info.elo == null) {
    return { badge: "ELO —", badgeClass: "", time: "—", timeClass: "", title: t("noElo") };
  }
  const delta = info.delta == null ? null : Number(info.delta);
  return {
    badge: "ELO " + info.elo,
    badgeClass: "",
    time: delta == null ? "—" : delta > 0 ? "+" + delta : delta < 0 ? String(delta) : "±0",
    timeClass: delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "",
    title: `${t("name")} · ${variantLabel(info.variant, lang)} ${info.elo}`
  };
}
