// Page supervision : CPU, RAM, temperature et disque des hotes surveilles.
// Le rendu est pur (il lit state.hostMetrics) ; la lecture reseau vit dans
// refreshHostMetrics, declenchee a l'ouverture de la page et par un minuteur.
import { t } from "./i18n.js";
import { state } from "./state.js";
import { supervisionList } from "./dom.js";

const HOST_METRICS_INTERVAL=15000;
const TYPE_LABEL={local:"hostTypeLocal",linux:"hostTypeLinux",proxmox:"hostTypeProxmox"};

function typeLabel(type){
  return t(TYPE_LABEL[type] || "hostTypeLocal");
}

// Un pourcentage absent (null) s'affiche "—", jamais "0 %" : une metrique
// indisponible et une metrique a zero n'ont pas la meme signification.
function percentText(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return "—";
  const shown=Math.round(n);
  return shown+" %";
}

function temperatureText(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return "—";
  return (Math.round(n*10)/10).toString().replace(".", state.language==="fr" ? "," : ".")+" °C";
}

// Une barre de metrique : un libelle, une piste remplie a la valeur, un chiffre.
// La classe de severite ne depend pas du theme (le remplissage reste lisible).
function metricRow(label,value){
  const row=document.createElement("div");
  row.className="supervision-metric";

  const key=document.createElement("span");
  key.className="supervision-metric-label";
  key.textContent=label;

  const track=document.createElement("span");
  track.className="supervision-track";
  const fill=document.createElement("span");
  fill.className="supervision-fill";
  const n=Number(value);
  if(Number.isFinite(n)){
    fill.style.width=Math.max(0,Math.min(100,n))+"%";
    fill.classList.add(n>=90 ? "high" : n>=70 ? "warn" : "ok");
  }else{
    track.classList.add("unknown");
  }
  track.appendChild(fill);

  const amount=document.createElement("span");
  amount.className="supervision-metric-value";
  amount.textContent=percentText(value);

  row.append(key,track,amount);
  return row;
}

function temperatureRow(value){
  const row=document.createElement("div");
  row.className="supervision-row";
  const key=document.createElement("span");
  key.textContent=t("supervisionTemperature");
  const content=document.createElement("span");
  content.textContent=temperatureText(value);
  row.append(key,content);
  return row;
}

function hostCard(host,metrics){
  const card=document.createElement("article");
  card.className="supervision-card";

  const head=document.createElement("div");
  head.className="supervision-head";
  const dot=document.createElement("span");
  dot.className="supervision-dot "+(metrics && metrics.ok ? "up" : "down");
  const icon=document.createElement("i");
  icon.className=host.icon||"fa-solid fa-server";
  icon.setAttribute("aria-hidden","true");
  const name=document.createElement("span");
  name.className="supervision-name";
  name.textContent=host.name||t("hostName");
  const badge=document.createElement("span");
  badge.className="supervision-type";
  badge.textContent=typeLabel(host.monitoring && host.monitoring.type);
  head.append(dot,icon,name,badge);
  card.appendChild(head);

  if(metrics && metrics.ok){
    const rows=document.createElement("div");
    rows.className="supervision-rows";
    rows.append(
      metricRow(t("supervisionCpu"),metrics.cpu),
      metricRow(t("supervisionRam"),metrics.ram),
      metricRow(t("supervisionDisk"),metrics.disk),
      temperatureRow(metrics.temperature)
    );
    card.appendChild(rows);
  }else{
    const error=document.createElement("p");
    error.className="supervision-error";
    error.textContent=(metrics && metrics.error) ? metrics.error : t("supervisionUnreachable");
    card.appendChild(error);
  }
  return card;
}

export function renderSupervision(){
  supervisionList.replaceChildren();

  const title=document.createElement("h2");
  title.className="supervision-title";
  title.id="supervisionTitle";
  title.textContent=t("supervisionTitle");

  const note=document.createElement("p");
  note.className="supervision-note";
  note.textContent=t("supervisionNote");

  const monitored=state.hosts.filter(host=>host.monitoring && host.monitoring.enabled===true);

  // Aucun hote surveille : on explique ou activer la supervision plutot que
  // d'afficher une grille vide et muette.
  if(!monitored.length){
    const empty=document.createElement("p");
    empty.className="supervision-empty";
    empty.textContent=t("supervisionEmpty");
    supervisionList.append(title,note,empty);
    return;
  }

  // Donnees pas encore disponibles : un message unique, pas une erreur par carte.
  if(!Array.isArray(state.hostMetrics)){
    const status=document.createElement("p");
    status.className="supervision-empty";
    status.textContent=state.hostMetricsError ? t("supervisionError") : t("supervisionLoading");
    supervisionList.append(title,note,status);
    return;
  }

  const byId=new Map(state.hostMetrics.filter(m=>m && m.id).map(m=>[m.id,m]));
  const grid=document.createElement("div");
  grid.className="supervision-grid";
  monitored.forEach(host=>grid.appendChild(hostCard(host,byId.get(host.id))));
  supervisionList.append(title,note,grid);
}

let metricsInflight=false;

export async function refreshHostMetrics(){
  if(metricsInflight) return;
  metricsInflight=true;
  try{
    const response=await fetch("/api/host-metrics",{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);
    const data=await response.json();
    state.hostMetrics=Array.isArray(data.hosts) ? data.hosts : [];
    state.hostMetricsError=false;
  }catch(_error){
    state.hostMetricsError=true;
  }finally{
    metricsInflight=false;
    if(state.page==="supervision") renderSupervision();
  }
}

function pageHidden(){
  return typeof document!=="undefined" && document.visibilityState==="hidden";
}

// La lecture ne tourne que sur la page supervision : ailleurs, le minuteur est
// arrete pour ne pas interroger des hotes distants sans raison.
export function startSupervisionMetrics(){
  stopSupervisionMetrics();
  refreshHostMetrics();
  state.hostMetricsTimer=setInterval(()=>{
    if(!pageHidden()) refreshHostMetrics();
  },HOST_METRICS_INTERVAL);
}

export function stopSupervisionMetrics(){
  if(state.hostMetricsTimer){
    clearInterval(state.hostMetricsTimer);
    state.hostMetricsTimer=null;
  }
}
