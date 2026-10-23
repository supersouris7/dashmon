// Page supervision : CPU, RAM, temperature et disque des hotes surveilles.
// Le rendu est pur (il lit state.hostMetrics) ; la lecture reseau vit dans
// refreshHostMetrics, declenchee a l'ouverture de la page et par un minuteur.
import { t } from "./i18n.js";
import { state } from "./state.js";
import { supervisionList, supervisionPage } from "./dom.js";

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
  name.textContent=peer.name || t("supervisionPeerUnnamed");
  const endpoint=peer.endpoint ? ` · ${peer.endpoint}` : "";
  name.title=(peer.name || t("supervisionPeerUnnamed"))+endpoint;

  const handshake=document.createElement("span");
  handshake.className="supervision-peer-handshake";
  const age=handshakeAge(peer.latestHandshake);
  const fresh=peer.connected===true || (age!==null && age<=WG_CONNECTED_SECONDS);
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
    return;
  }

  // Donnees pas encore disponibles : un message unique, pas une erreur par carte.
  if(!Array.isArray(state.hostMetrics)){
    const status=document.createElement("p");
    status.className="supervision-empty";
    status.textContent=state.hostMetricsError ? t("supervisionError") : t("supervisionLoading");
    supervisionList.append(status);
    return;
  }

  const byId=new Map(state.hostMetrics.filter(m=>m && m.id).map(m=>[m.id,m]));
  const grid=document.createElement("div");
  grid.className="supervision-grid";
  monitored.forEach(host=>grid.appendChild(hostCard(host,byId.get(host.id))));
  supervisionList.append(grid);

  // WireGuard est detache des cartes hote : sa propre grille, sous celle des
  // mesures, avec un intitule de section, comme la tuile WireGuard du tableau de
  // bord. Une carte par hote concerne, une section par interface.
  const wgCards=[];
  monitored.forEach(host=>{
    const metrics=byId.get(host.id);
    const interfaces=visibleInterfaces(host,metrics);
    if(interfaces.length) wgCards.push(wireguardCard(host,metrics,interfaces));
  });
  if(wgCards.length){
    const section=document.createElement("section");
    section.className="supervision-wireguard-section";
    section.setAttribute("aria-label",t("supervisionWireguard"));
    const wgGrid=document.createElement("div");
    wgGrid.className="supervision-grid";
    wgCards.forEach(card=>wgGrid.appendChild(card));
    section.appendChild(wgGrid);
    supervisionList.append(section);
  }
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
