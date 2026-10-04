// Rendu de la tuile Docker (cote navigateur).
//
// Ligne 1 : conteneurs en ligne. Ligne 2 : images a jour.
//
// Les totaux ne sont plus sur la tuile — "en ligne 8" se lit mieux que
// "en ligne 8 / 9", et la tuile gagne la largeur qui manquait sur les petits
// ecrans. Ils restent dans l'info-bulle, ou "3 sur 9" garde tout son sens : sans
// le total, un compteur seul ne dit pas si la cible est petite ou grande.
// Les deux libelles viennent du manifest, donc la tuile suit la langue de
// l'interface.
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
  const up = `${t("up")} ${containers.active}`;
  const fresh = `${t("updated")} ${updated.count}`;
  // L'info-bulle garde les totaux : c'est elle qui repond a "sur combien ?".
  const upFull = `${t("up")} ${containers.active} / ${containers.total}`;
  const freshFull = `${t("updated")} ${updated.count} / ${updated.total}`;
  return {
    badge: up,
    badgeClass: allActive ? "ok" : "nok",
    time: fresh,
    timeClass: allUpdated ? "delta-up" : "warn",
    title: `${t("name")} · ${upFull} · ${freshFull}`
      + (unknown > 0 ? ` · ${unknown} ${t(unknown > 1 ? "unknownMany" : "unknownOne")}` : "")
  };
}
