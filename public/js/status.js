// Regles d'etat des pastilles de supervision, sans DOM.
//
// `soft` = supervision non importante : le service est surveille, mais son
// indisponibilite n'est pas critique. L'etat reste `soft` (l'info-bulle
// l'explique) et la pastille prend l'aspect d'un statut inconnu : un rond
// vide. Seul un vrai `down` affiche une croix rouge.

export function effectiveStatus(monitor, info){
  const state=(info&&info.state)||"pending";
  return monitor==="soft" && state==="down" ? "soft" : state;
}

export function statusIcon(state){
  if(state==="up") return "fa-solid fa-circle-check";
  if(state==="down") return "fa-solid fa-circle-xmark";
  return "fa-regular fa-circle";
}
