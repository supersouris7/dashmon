// Préférences d'affichage, stockées côté navigateur (localStorage).
//
// Pourquoi pas dans config.json ? Ces réglages décrivent la façon dont CET
// écran regarde le tableau de bord (colonnes ou lignes, tri, sections
// repliées), pas la configuration du dashboard (services, hôtes, langue,
// thème). Les garder côté navigateur évite d'écrire un fichier sur le disque à
// chaque clic, évite de propager une disposition d'un appareil à l'autre, et
// ne renvoie rien au serveur à chaque requête — contrairement à un cookie.
//
// Le stockage peut être indisponible (navigation privée, cookies bloqués,
// quota) : dans ce cas l'application continue de fonctionner, la préférence
// est simplement conservée pour la session en cours.

const STORAGE_KEY="dashmon.view";

// Liste unique des clés autorisées : rien d'autre n'est jamais écrit, même si
// un appelant passe la config entière. La source de vérité est state.js
// (VIEW_PREF_KEYS), on ne fait que la recopier pour éviter une dépendance
// circulaire.
const ALLOWED=Object.freeze([
  "viewMode","sortMode","groupMode","openMode",
  "smallIcons","hostsDisplay","collapsed","webLinksCollapsed"
]);

function storage(){
  try{
    // Accès différé : le module reste chargeable hors navigateur (tests).
    const store=globalThis.localStorage;
    if(!store) return null;
    return store;
  }catch(_error){
    return null; // accès refusé (mode privé strict)
  }
}

// Ne renvoie que les préférences d'affichage contenues dans un objet (la
// config serveur, par exemple), sans jamais en inventer.
export function pickViewPrefs(source){
  if(!source || typeof source!=="object") return {};
  const out={};
  for(const key of ALLOWED){
    if(source[key]!==undefined) out[key]=source[key];
  }
  return out;
}

// Préférences enregistrées dans ce navigateur. Jamais d'exception : un
// stockage corrompu est traité comme un stockage vide.
export function loadViewPrefs(){
  const store=storage();
  if(!store) return {};
  try{
    const raw=store.getItem(STORAGE_KEY);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    return pickViewPrefs(parsed);
  }catch(_error){
    return {};
  }
}

// Enregistre uniquement les préférences d'affichage connues. Retourne ce qui a
// réellement été pris en compte, pour que l'appelant puisse mettre son état à
// jour sans refaire le tri.
export function saveViewPrefs(patch){
  const applied=pickViewPrefs(patch);
  if(!Object.keys(applied).length) return applied;
  const store=storage();
  if(!store) return applied;
  try{
    store.setItem(STORAGE_KEY,JSON.stringify(Object.assign(loadViewPrefs(),applied)));
  }catch(_error){
    // Quota plein ou stockage désactivé : la prefs reste valable en mémoire.
  }
  return applied;
}
