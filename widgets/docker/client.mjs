// Rendu de la tuile Docker (cote navigateur).
//
// Ligne 1 : conteneurs actifs / total. Ligne 2 : images a jour (MAJ).
// Un conteneur n'est compte "non a jour" que sur preuve positive ; sinon il
// reste vert et le nombre d'images non verifiables apparait dans le tooltip.

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }
  const containers = info.containers;
  const updated = info.updated;

  if (info.error || !containers || !updated || !containers.total) {
    return {
      badge: t("name") + " —",
      badgeClass: "pending",
      time: "—",
      timeClass: "",
      title: info && info.error
        ? `${t("error")} : ${String(info.error).slice(0, 120)}`
        : t("name")
    };
  }

  const allActive = containers.active === containers.total;
  const allUpdated = updated.count === updated.total;
  const unknown = Number(updated.unknown) || 0;
  return {
    badge: `${t("containers")} ${containers.active} / ${containers.total}`,
    badgeClass: allActive ? "ok" : "nok",
    time: `${t("updated")} ${updated.count} / ${updated.total}`,
    timeClass: allUpdated ? "delta-up" : "warn",
    title: `${t("name")} · ${containers.active}/${containers.total} · ${updated.count}/${updated.total}`
      + (unknown > 0 ? ` · ${unknown} ${t("unknown")}` : "")
  };
}
