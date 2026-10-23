// Page supervision : CPU, RAM, temperature et disque des hotes surveilles.
// Le rendu est pur (il lit state.hostMetrics) ; la lecture reseau vit dans
// refreshHostMetrics, declenchee a l'ouverture de la page et par un minuteur.
import { t } from "./i18n.js";
import { state } from "./state.js";
import { supervisionList, supervisionPage, expandSmartBtn, collapseSmartBtn } from "./dom.js";

// Intervalle injecte par le serveur (voir HOST_METRICS_INTERVAL). Un HTML
// servi sans substitution (test, fichier local) retombe sur 60 s.
function metricsInterval(){
  if(typeof document==="undefined") return 60000;
  const meta=document.querySelector('meta[name="host-metrics-interval"]');
  const value=Number(meta && meta.content);
  return Number.isFinite(value) && value>=5000 ? Math.min(value,3600000) : 60000;
}
const HOST_METRICS_INTERVAL=metricsInterval();
const TYPE_LABEL={local:"hostTypeLocal",linux:"hostTypeLinux",proxmox:"hostTypeProxmox"};
let smartDetailsExpanded=false;

function setAllSmartDetails(expanded){
  smartDetailsExpanded=expanded;
  supervisionList.querySelectorAll(".supervision-card-smart").forEach(card=>{
    card.classList.toggle("expanded",expanded);
    card.setAttribute("aria-expanded",String(expanded));
  });
}

function updateSmartActions(){
  const cards=[...supervisionList.querySelectorAll(".supervision-card-smart")];
  const expanded=cards.filter(card=>card.classList.contains("expanded")).length;
  expandSmartBtn.disabled=!cards.length || expanded===cards.length;
  collapseSmartBtn.disabled=!expanded;
}

expandSmartBtn.addEventListener("click",()=>{
  setAllSmartDetails(true);
  updateSmartActions();
});
collapseSmartBtn.addEventListener("click",()=>{
  setAllSmartDetails(false);
  updateSmartActions();
});

function typeLabel(type){
  return t(TYPE_LABEL[type] || "hostTypeLocal");
}

// null ou undefined = metrique indisponible. Number(null) vaut 0 : sans ce
// garde, une valeur absente s'afficherait "0 %" comme une vraie mesure a zero.
function isMissing(value){
  return value===null || value===undefined || value==="";
}

// Un pourcentage absent s'affiche "—", jamais "0 %" : une metrique
// indisponible et une metrique a zero n'ont pas la meme signification.
function percentText(value){
  if(isMissing(value)) return "—";
  const n=Number(value);
  if(!Number.isFinite(n)) return "—";
  const shown=Math.round(n);
  return shown+" %";
}

function temperatureText(value){
  if(isMissing(value)) return "—";
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
  const n=isMissing(value) ? NaN : Number(value);
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

// Un pair est considere connecte si son dernier handshake date de moins de
// trois minutes : WireGuard renegocie environ toutes les deux minutes quand le
// lien vit. L'agent peut toutefois fournir un booleen "connected" explicite.
const WG_CONNECTED_SECONDS=180;

function handshakeAge(value){
  const n=Number(value);
  if(!Number.isFinite(n) || n<=0) return null;
  return Math.max(0,Math.floor(Date.now()/1000-n));
}

function relativeAge(seconds){
  const fr=state.language==="fr";
  const s=Math.max(0,Math.floor(seconds));
  if(s<60) return fr ? `il y a ${s} s` : `${s}s ago`;
  const m=Math.floor(s/60);
  if(m<60) return fr ? `il y a ${m} min` : `${m} min ago`;
  const h=Math.floor(m/60);
  if(h<48) return fr ? `il y a ${h} h` : `${h} h ago`;
  const d=Math.floor(h/24);
  return fr ? `il y a ${d} j` : `${d} d ago`;
}

function handshakeText(peer){
  const age=handshakeAge(peer.latestHandshake);
  if(age===null){
    return peer.connected===true ? t("supervisionPeerConnected") : t("supervisionPeerNever");
  }
  return relativeAge(age);
}

function bytesText(value){
  if(isMissing(value)) return "—";
  const n=Number(value);
  if(!Number.isFinite(n) || n<0) return "—";
  const fr=state.language==="fr";
  const units=fr ? ["o","ko","Mo","Go","To"] : ["B","kB","MB","GB","TB"];
  let shown=n, index=0;
  while(shown>=1024 && index<units.length-1){ shown/=1024; index++; }
  const rounded=shown>=100 ? Math.round(shown) : Math.round(shown*10)/10;
  return rounded.toString().replace(".",fr?",":".")+" "+units[index];
}

// Un pair : nom, dernier handshake, puis trafic recu et emis. Le nom et
// l'endpoint viennent de l'agent : le point d'interrogation de l'interpolation
// est volontairement absent, tout passe par textContent.
function peerRow(peer){
  const row=document.createElement("div");
  row.className="supervision-peer";

  const name=document.createElement("span");
  name.className="supervision-peer-name";
  const age=handshakeAge(peer.latestHandshake);
  const fresh=peer.connected===true || (age!==null && age<=WG_CONNECTED_SECONDS);
  const dot=document.createElement("i");
  dot.className="supervision-peer-dot"+(fresh ? " up" : "");
  dot.setAttribute("aria-hidden","true");
  const label=document.createElement("span");
  label.textContent=peer.name || t("supervisionPeerUnnamed");
  name.append(dot,label);
  const endpoint=peer.endpoint ? ` · ${peer.endpoint}` : "";
  name.title=(peer.name || t("supervisionPeerUnnamed"))+endpoint;

  const handshake=document.createElement("span");
  handshake.className="supervision-peer-handshake";
  if(fresh) handshake.classList.add("up");
  handshake.textContent=handshakeText(peer);

  const traffic=document.createElement("span");
  traffic.className="supervision-peer-traffic";
  traffic.textContent=`↓ ${bytesText(peer.rx)} · ↑ ${bytesText(peer.tx)}`;

  row.append(name,handshake,traffic);
  return row;
}

function hostCard(host,metrics){
  const card=document.createElement("article");
  card.className="supervision-card";

  const head=document.createElement("div");
  head.className="supervision-head";
  const icon=document.createElement("i");
  icon.className=host.icon||"fa-solid fa-server";
  icon.setAttribute("aria-hidden","true");
  const name=document.createElement("span");
  name.className="supervision-name";
  name.textContent=host.name||t("hostName");
  const badge=document.createElement("span");
  badge.className="supervision-type";
  badge.textContent=typeLabel(host.monitoring && host.monitoring.type);
  head.append(icon,name,badge);
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

// Les interfaces d'un hote retenues par ses preferences : section masquable
// (enabled===false) et filtre d'interface. Un tableau vide = rien a afficher.
function visibleInterfaces(host,metrics){
  if(!metrics || !metrics.ok) return [];
  const prefs=host.monitoring && host.monitoring.wireguard;
  if(prefs && prefs.enabled===false) return [];
  if(!Array.isArray(metrics.wireguard) || !metrics.wireguard.length) return [];
  const interfaces=prefs && prefs.interface
    ? metrics.wireguard.filter(item=>item.interface===prefs.interface)
    : metrics.wireguard;
  return interfaces;
}

// Carte WireGuard autonome : detachee de la carte hote, comme la tuile du
// tableau de bord. Une carte par hote, une section par interface, puis un pair
// par ligne. Sur la ligne d'interface : "wg0" (blanc) puis " : Dernier releve"
// (gris), date du fichier dump (wireguardFetchedAt).
function wireguardCard(host,metrics,interfaces){
  const card=document.createElement("article");
  card.className="supervision-card supervision-card-wireguard";

  const head=document.createElement("div");
  head.className="supervision-head";
  const icon=document.createElement("i");
  // Pas d'icone WireGuard dans Font Awesome : le dragon est le repli retenu.
  icon.className="fa-solid fa-dragon";
  icon.setAttribute("aria-hidden","true");
  const name=document.createElement("span");
  name.className="supervision-name";
  name.textContent=host.name||t("hostName");
  const badge=document.createElement("span");
  badge.className="supervision-type";
  badge.textContent=t("supervisionWireguard");
  head.append(icon,name,badge);
  card.appendChild(head);

  const age=handshakeAge(metrics.wireguardFetchedAt);
  const updatedText=age===null
    ? ""
    : t("supervisionWireguardUpdated").replace("{ago}",relativeAge(age));

  interfaces.forEach(item=>{
    const section=document.createElement("div");
    section.className="supervision-wireguard";

    const line=document.createElement("div");
    line.className="supervision-wireguard-head";
    if(item.interface){
      const iface=document.createElement("span");
      iface.className="supervision-wireguard-iface";
      iface.textContent=item.interface;
      line.appendChild(iface);
    }
    if(updatedText){
      const updated=document.createElement("span");
      updated.className="supervision-wireguard-updated";
      updated.textContent=(item.interface ? ": " : "")+updatedText;
      line.appendChild(updated);
    }
    if(line.childNodes.length) section.appendChild(line);

    const peers=Array.isArray(item.peers) ? item.peers : [];
    if(!peers.length){
      const empty=document.createElement("p");
      empty.className="supervision-wireguard-empty";
      empty.textContent=t("supervisionWireguardNoPeer");
      section.appendChild(empty);
    }else{
      const list=document.createElement("div");
      list.className="supervision-peers";
      peers.forEach(peer=>list.appendChild(peerRow(peer)));
      section.appendChild(list);
    }
    card.appendChild(section);
  });

  return card;
}

function smartNumberText(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0
    ? new Intl.NumberFormat(state.language==="fr" ? "fr-FR" : "en-US").format(Math.floor(n))
    : "—";
}

function smartFact(label,value,warning=false){
  const fact=document.createElement("span");
  const n=Number(value);
  fact.className="supervision-smart-fact";
  if(warning && Number.isFinite(n) && n>0) fact.classList.add("warn");
  fact.textContent=label+" "+smartNumberText(value);
  return fact;
}

function smartDiagnosis(key,value){
  const n=Number(value);
  if(!Number.isFinite(n) || n<0) return {text:"—",className:""};
  if(key==="hours") return n>=50000 ? {text:t("smartHigh"),className:"warn"} : {text:t("smartGood"),className:"up"};
  if(key==="temperature") return n<40 ? {text:t("smartVeryGood"),className:"up"} : n<50 ? {text:t("smartGood"),className:"up"} : {text:t("smartHot"),className:"warn"};
  if(key==="load") return n>=100000 ? {text:t("smartWatch"),className:"warn"} : {text:t("smartGood"),className:"up"};
  return n===0 ? {text:t("smartGood"),className:"up"} : {text:t("smartWatch"),className:"warn"};
}

function smartDetailRow(label,value,key){
  const row=document.createElement("div");
  row.className="supervision-smart-detail-row";
  const name=document.createElement("span");
  name.textContent=label;
  const amount=document.createElement("span");
  amount.textContent=smartNumberText(value);
  const diagnosis=smartDiagnosis(key,value);
  const diagnostic=document.createElement("span");
  diagnostic.className="supervision-smart-detail-diagnostic "+diagnosis.className;
  diagnostic.textContent=diagnosis.text;
  row.append(name,amount,diagnostic);
  return row;
}

function visibleSmartDisks(host,metrics){
  if(!metrics || !metrics.ok || !Array.isArray(metrics.smart) || !metrics.smart.length) return [];
  const prefs=host.monitoring && host.monitoring.smart;
  if(prefs && prefs.enabled===false) return [];
  const wanted=prefs && Array.isArray(prefs.disks) ? prefs.disks : [];
  return wanted.length ? metrics.smart.filter(disk=>wanted.includes(disk.device)) : metrics.smart;
}

function smartCard(host,metrics,disks){
  const card=document.createElement("article");
  card.className="supervision-card supervision-card-smart";
  card.setAttribute("role","button");
  card.tabIndex=0;
  card.setAttribute("aria-expanded","false");
  if(smartDetailsExpanded){
    card.classList.add("expanded");
    card.setAttribute("aria-expanded","true");
  }
  const head=document.createElement("div");
  head.className="supervision-head";
  const icon=document.createElement("i");
  icon.className="fa-solid fa-hard-drive";
  icon.setAttribute("aria-hidden","true");
  const name=document.createElement("span");
  name.className="supervision-name";
  name.textContent=host.name||t("hostName");
  const badge=document.createElement("span");
  badge.className="supervision-type";
  badge.textContent=t("supervisionSmart");
  const chevron=document.createElement("i");
  chevron.className="fa-solid fa-chevron-down supervision-smart-chevron";
  chevron.setAttribute("aria-hidden","true");
  head.append(icon,name,badge,chevron);
  card.appendChild(head);

  const age=handshakeAge(metrics.smartFetchedAt);
  if(age!==null){
    const updated=document.createElement("p");
    updated.className="supervision-smart-updated";
    updated.textContent=t("supervisionSmartUpdated").replace("{ago}",relativeAge(age));
    card.appendChild(updated);
  }

  // Toute la tuile bascule ensemble : le chevron reste un repere visuel, pas
  // une cible minuscule. Entree et Espace couvrent aussi le clavier.
  const toggleDetails=()=>{
    const expanded=card.classList.toggle("expanded");
    card.setAttribute("aria-expanded",String(expanded));
    updateSmartActions();
  };
  card.addEventListener("click",toggleDetails);
  card.addEventListener("keydown",event=>{
    if(event.key!=="Enter" && event.key!==" ") return;
    event.preventDefault();
    toggleDetails();
  });

  disks.forEach(disk=>{
    const section=document.createElement("section");
    section.className="supervision-smart-disk";
    const title=document.createElement("div");
    title.className="supervision-smart-title";
    const label=document.createElement("span");
    label.textContent=disk.device;
    const passed=disk.passed===true ? "passed" : disk.passed===false ? "failed" : "unknown";
    const status=document.createElement("span");
    status.className="supervision-smart-status "+passed;
    status.setAttribute("role","img");
    status.setAttribute("aria-label",passed==="passed" ? t("supervisionSmartPassed")
      : passed==="failed" ? t("supervisionSmartFailed") : t("supervisionSmartUnknown"));
    status.title=status.getAttribute("aria-label");
    title.append(status,label);
    section.appendChild(title);

    const summary=document.createElement("div");
    summary.className="supervision-smart-summary";
    const uptime=document.createElement("span");
    uptime.className="supervision-smart-uptime";
    uptime.textContent=smartNumberText(disk.powerOnHours)+" h";
    const years=document.createElement("small");
    years.textContent=Number.isFinite(Number(disk.powerOnHours))
      ? (Number(disk.powerOnHours)/8766).toFixed(1).replace(".",state.language==="fr" ? "," : ".")+(state.language==="fr" ? " ans" : " years")
      : "—";
    const temperature=document.createElement("span");
    temperature.className="supervision-smart-temperature";
    temperature.textContent=Number.isFinite(Number(disk.temperature)) ? Math.round(Number(disk.temperature))+" °C" : "—";
    summary.append(uptime,years,temperature);
    section.appendChild(summary);

    const facts=document.createElement("div");
    facts.className="supervision-smart-facts";
    facts.append(
      smartFact(t("smartReallocatedShort"),disk.reallocated,true),
      smartFact(t("smartPendingShort"),disk.pending,true),
      smartFact(t("smartUncorrectableShort"),disk.uncorrectable,true),
      smartFact(t("smartSataCrcShort"),disk.sataCrc,true),
      smartFact(t("smartErrorsShort"),disk.smartErrors,true),
      smartFact(t("smartLoadCycleShort"),disk.loadCycle)
    );
    section.appendChild(facts);

    const details=document.createElement("div");
    details.className="supervision-smart-details";
    if(disk.model){
      const model=document.createElement("p");
      model.className="supervision-smart-model";
      model.textContent=disk.model;
      details.appendChild(model);
    }
    const statusText=document.createElement("p");
    statusText.className="supervision-smart-full-status "+passed;
    statusText.textContent=passed==="passed" ? t("supervisionSmartPassed")
      : passed==="failed" ? t("supervisionSmartFailed") : t("supervisionSmartUnknown");
    details.append(statusText,
      smartDetailRow(t("smartReallocated"),disk.reallocated,"error"),
      smartDetailRow(t("smartPending"),disk.pending,"error"),
      smartDetailRow(t("smartUncorrectable"),disk.uncorrectable,"error"),
      smartDetailRow(t("smartSataCrc"),disk.sataCrc,"error"),
      smartDetailRow(t("smartErrors"),disk.smartErrors,"error"),
      smartDetailRow(t("smartLoadCycle"),disk.loadCycle,"load"),
      smartDetailRow(t("smartPowerHours"),disk.powerOnHours,"hours"),
      smartDetailRow(t("smartTemperature"),disk.temperature,"temperature")
    );
    section.appendChild(details);
    card.appendChild(section);
  });
  return card;
}

export function renderSupervision(){
  supervisionList.replaceChildren();

  // Le titre n'est plus affiche : les onglets suffisent. On garde un nom
  // accessible sur la section pour les lecteurs d'ecran.
  supervisionPage.setAttribute("aria-label",t("supervisionTitle"));

  const monitored=state.hosts.filter(host=>host.monitoring && host.monitoring.enabled===true);

  // Aucun hote surveille : on explique ou activer la supervision plutot que
  // d'afficher une grille vide et muette.
  if(!monitored.length){
    const empty=document.createElement("p");
    empty.className="supervision-empty";
    empty.textContent=t("supervisionEmpty");
    supervisionList.append(empty);
    updateSmartActions();
    return;
  }

  // Donnees pas encore disponibles : un message unique, pas une erreur par carte.
  if(!Array.isArray(state.hostMetrics)){
    const status=document.createElement("p");
    status.className="supervision-empty";
    status.textContent=state.hostMetricsError ? t("supervisionError") : t("supervisionLoading");
    supervisionList.append(status);
    updateSmartActions();
    return;
  }

  const byId=new Map(state.hostMetrics.filter(m=>m && m.id).map(m=>[m.id,m]));
  // Une seule grille evite de reserver une ligne entiere aux details : WireGuard
  // et SMART prennent la premiere case libre apres les hotes, sans agrandir une
  // carte isolee. L'ordre reste lisible : hotes, WireGuard, puis SMART.
  const grid=document.createElement("div");
  grid.className="supervision-grid";
  monitored.forEach(host=>grid.appendChild(hostCard(host,byId.get(host.id))));

  const wgCards=[];
  monitored.forEach(host=>{
    const metrics=byId.get(host.id);
    const interfaces=visibleInterfaces(host,metrics);
    if(interfaces.length) wgCards.push(wireguardCard(host,metrics,interfaces));
  });
  wgCards.forEach(card=>grid.appendChild(card));
  monitored.forEach(host=>{
    const metrics=byId.get(host.id);
    const disks=visibleSmartDisks(host,metrics);
    if(disks.length) grid.appendChild(smartCard(host,metrics,disks));
  });
  supervisionList.append(grid);
  updateSmartActions();
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
