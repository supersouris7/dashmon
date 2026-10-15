// Tuile « Fortune Cookie » : une phrase par jour, sans intitulé ni pastille.
//
// La phrase du jour est deterministe : elle sort du jour et de l'identite de la
// tuile, jamais d'un hasard au chargement. La meme tuile affiche donc la meme
// phrase toute la journee, et un rechargement ne la change pas.
//
// L'identite est le type de la tuile speciale ("fortune"), pour qu'il y ait une
// seule memoire par tableau de bord. Une identite sous forme d'objet reste
// acceptee pour ne pas casser d'anciens appels.
//
// Un clic tire une autre phrase. Ce choix est memorise dans le navigateur, avec
// le jour qui l'a produit : le lendemain la memoire est invalidee et la tuile
// repart sur la phrase du jour. Comme pour les preferences d'affichage, le
// stockage peut etre indisponible ; la tuile reste alors utilisable, seule la
// memorisation du clic est perdue.

const STORAGE_KEY="dashmon.fortune";
const MESSAGES_URL="/fortune-messages.json";

let messages=[];
let loading=null;

// Identite stable d'une tuile : le type s'il est donne tel quel, sinon la
// concatenation nom/hote/categorie (anciens appels).
function asKey(identity){
  if(typeof identity==="string") return identity;
  return [(identity&&identity.name)||"",(identity&&identity.host)||"",(identity&&identity.category)||""].join("|");
}

function storage(){
  try{
    const store=globalThis.localStorage;
    return store || null;
  }catch(_error){
    return null;
  }
}

// Jour local, au format AAAA-MM-JJ. Volontairement pas d'ISO/UTC : la phrase
// doit changer au minuit du lecteur, pas a celui d'un fuseau distant.
export function dayStamp(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

// FNV-1a 32 bits : rapide, sans dependance, et suffisamment reparti pour
// choisir un index de phrase.
export function hashString(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

export function fortuneKey(identity){
  return asKey(identity);
}

// Phrases validees au chargement : le fichier est livre avec le depot, mais un
// tri defaillant ne doit pas rendre une tuile vide ni casser le rendu.
function normalizeMessages(raw){
  if(!Array.isArray(raw)) return [];
  return raw
    .filter(item=>item && typeof item==="object")
    .map(item=>({
      id:String(item.id||""),
      fr:typeof item.fr==="string" ? item.fr : "",
      en:typeof item.en==="string" ? item.en : ""
    }))
    .filter(item=>item.fr || item.en);
}

export function loadFortunes(){
  if(messages.length) return Promise.resolve(messages);
  if(!loading){
    loading=fetch(MESSAGES_URL)
      .then(response=>{
        if(!response.ok) throw new Error("HTTP "+response.status);
        return response.json();
      })
      .then(raw=>{
        messages=normalizeMessages(raw);
        return messages;
      })
      .catch(error=>{
        console.error("Chargement des phrases impossible",error);
        loading=null;
        messages=[];
        return messages;
      });
  }
  return loading;
}

export function fortuneCount(){
  return messages.length;
}

// Les tests et le rendu ont besoin de la liste sans passer par le reseau.
export function setFortunes(list){
  messages=normalizeMessages(list);
  loading=messages.length ? Promise.resolve(messages) : null;
}

function phraseOf(message,language){
  if(!message) return "";
  if(language==="en") return message.en || message.fr;
  return message.fr || message.en;
}

// Memoire des clics, par tuile et par jour. Une entree d'un autre jour est
// ignoree a la lecture, puis effacee a l'ecriture : la map ne grossit donc pas
// d'un jour sur l'autre.
function readOverrides(){
  const store=storage();
  if(!store) return {};
  try{
    const raw=store.getItem(STORAGE_KEY);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : {};
  }catch(_error){
    return {};
  }
}

function writeOverride(key,index,day){
  const store=storage();
  if(!store) return;
  const overrides=readOverrides();
  for(const existing of Object.keys(overrides)){
    if(overrides[existing] && overrides[existing].day!==day) delete overrides[existing];
  }
  overrides[key]={day,index};
  try{
    store.setItem(STORAGE_KEY,JSON.stringify(overrides));
  }catch(_error){
    // Quota plein ou stockage desactive : le choix reste valable pour la session.
  }
}

// Index de la phrase affichee : memorise s'il existe et s'il date du jour
// courant, sinon derive du jour et de la tuile.
export function currentFortuneIndex(key,day=dayStamp()){
  if(!messages.length) return -1;
  const overrides=readOverrides();
  const saved=overrides[key];
  if(saved && saved.day===day && Number.isInteger(saved.index)
    && saved.index>=0 && saved.index<messages.length){
    return saved.index;
  }
  return hashString(`${day}|${key}`)%messages.length;
}

export function fortuneText(identity,language,day=dayStamp()){
  const index=currentFortuneIndex(asKey(identity),day);
  if(index<0) return "";
  return phraseOf(messages[index],language);
}

// Tirage d'une autre phrase. Le tour complet revient sur la phrase memorisee,
// pour ne jamais boucler indefiniment quand il ne reste qu'un message.
export function pickFortune(identity,language,day=dayStamp()){
  if(messages.length<1) return "";
  const key=asKey(identity);
  const current=currentFortuneIndex(key,day);
  const offset=hashString(`${day}|${key}|${Math.random()}`)%messages.length;
  const next=(current+1+offset)%messages.length;
  writeOverride(key,next,day);
  return phraseOf(messages[next],language);
}
