// Rendu de la tuile Lichess (cote navigateur).
//
// Ligne 1 : la note, en vert. Ligne 2 : l'evolution sur un mois, et non la
// variation depuis la derniere reponse : le serveur compare l'ELO courant a
// la valeur d'il y a 30 jours. Si lichess.org ne repond pas (429), la note
// enregistree reste affichee, l'ecart au re-routage est signale dans l'info-
// bulle avec la date de la derniere mesure.

const VARIANT_LABELS = {
  fr: { bullet: "Bullet", blitz: "Blitz", rapid: "Rapide", classical: "Classique" },
  en: { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical" }
};

function variantLabel(variant, lang) {
  const labels = VARIANT_LABELS[lang] || VARIANT_LABELS.en;
  return labels[variant] || variant || "";
}

function signed(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return n > 0 ? "+" + n : n < 0 ? String(n) : "±0";
}

function trendClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "delta-up" : "delta-down";
}

export function render(ctx) {
  const { info, t, lang, formatDateTime } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  const elo = Number(info.elo);
  const hasElo = Number.isFinite(elo);

  // Rien a afficher : on garde le comportement d'erreur historique.
  if (!hasElo) {
    return {
      badge: "ELO —",
      badgeClass: "",
      time: "—",
      timeClass: "",
      title: info.error ? `${t("error")} : ${String(info.error).slice(0, 120)}` : t("noElo")
    };
  }

  // Evolution mensuelle : 30 jours quand l'historique le permet, sinon la
  // duree reellement mesuree.
  const monthDelta = info.monthDelta;
  const monthDays = Number(info.monthDays) || 0;
  const monthText = monthDelta == null
    ? "—"
    : `${signed(monthDelta)} ${t("over")} ${monthDays || 30} ${t("days")}`;

  const parts = [`${t("name")} · ${variantLabel(info.variant, lang)} ${elo}`, monthText];
  if (info.delta != null && Number(info.delta) !== 0) {
    parts.push(`${signed(info.delta)} ${t("over")} 1 ${t("days")}`);
  }
  if (info.updatedAt) parts.push(`${t("updated")} ${formatDateTime(info.updatedAt, lang)}`);
  if (info.stale) {
    parts.push(t("stale"));
    if (info.error) parts.push(String(info.error).slice(0, 120));
  }

  return {
    badge: "ELO " + elo,
    badgeClass: "ok",
    time: monthText,
    timeClass: trendClass(monthDelta),
    title: parts.join(" · ")
  };
}
