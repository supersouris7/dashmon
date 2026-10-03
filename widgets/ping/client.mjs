// Rendu de la tuile Ping (cote navigateur).
//
// La tuile ne montre qu'une pastille, exactement celle d'une tuile standard :
// le widget renvoie son propre noeud DOM (`element`), ce que le registre accepte
// pour tous les widgets et qui evite d'ecrire "Ping" sur la carte.
//
// Les classes sont celles de status.js, recopiees ici volontairement : les
// clients de widgets s'importent depuis le disque dans les tests, ou une
// importation relative ne designerait pas le meme fichier que celle servie au
// navigateur. Deux lignes de plus valent mieux qu'un import qui ne marche
// qu'a l'execution.

export function statusIcon(state) {
  if (state === "up") return "fa-solid fa-circle-check";
  if (state === "down") return "fa-solid fa-circle-xmark";
  return "fa-regular fa-circle";
}

export function element(ctx) {
  const { info, t } = ctx;
  const state = (info && info.state) || "pending";

  const status = document.createElement("span");
  status.className = "service-status " + state;
  status.title = [t("name"), info && info.error ? String(info.error).slice(0, 120) : t(state === "up" ? "reachable" : "unreachable")]
    .filter(Boolean).join(" · ");

  const icon = document.createElement("i");
  icon.className = statusIcon(state);
  status.appendChild(icon);
  return status;
}