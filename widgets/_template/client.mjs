// MODELE DE RENDU COTE NAVIGATEUR — a copier dans un nouveau dossier.
//
// Contrainte importante : render() ne doit toucher NI au DOM, NI a `document`,
// NI a des variables d'interface. Il renvoie un descripteur et le core se
// charge de l'appliquer sur la tuile. Deux raisons :
//   1. le module reste testable sous Node (voir test/widgets.test.js) ;
//   2. un widget casse ne peut pas casser l'affichage du dashboard.
//
// Si vous avez besoin d'un rendu totalement sur mesure, exportez
// element(ctx) qui retourne un nœud DOM : le core l'utilisera a la place du
// descripteur, pour ce widget uniquement.

export function render(ctx) {
  // ctx = {
  //   info   : statut calcule par votre server.js (ou null si jamais verifie),
  //   config : configuration du widget telle que saisie dans l'editeur,
  //   t      : (key) => libelle traduit, declare dans manifest.json -> strings,
  //   lang   : "fr" | "en",
  //   formatNumber, formatCompactNumber, formatDateTime : utilitaires d'affichage
  // }
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
  return {
    badge: `${t("badge")} ${info.value ?? "—"}`,
    badgeClass: "ok",              // "ok" | "nok" | "warn" | "pending" | ""
    time: info.detail || "",       // 2e ligne (masquee en mode icones)
    timeClass: "",                 // "warn" | "delta-up" | "delta-down" | ""
    title: t("name")
  };
}
