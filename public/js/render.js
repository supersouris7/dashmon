// Rendu de Dashmon (cartes, groupes, mode d'affichage) et état des boutons du menu.
import { state, getCategory, compareServices, serviceUsageKey, normalize, sanitizeUrl, sanitizeIconClass, DEFAULT_BANNER_URL, DEFAULT_FAVICON, FALLBACK_HOST } from "./state.js";
import { t } from "./i18n.js";
import { patchConfig, bumpUsage } from "./api.js";
import {
  dashboard, searchInput, webLinksSection, webLinksHeader, webLinksList,
  viewBtn, collapseAllBtn, openModeSelect, groupCategoryBtn,
  groupHostBtn, sortAlphabeticalBtn, sortUsageBtn,
  appLogoLink, faviconLink
} from "./dom.js";

export function applyBanner(){
  const enabled=state.bannerIcon!==false;
  document.documentElement.classList.toggle("banner-off",!enabled);
  if(appLogoLink){
    appLogoLink.href=sanitizeUrl(state.bannerUrl) || DEFAULT_BANNER_URL;
  }
}

export function applyFavicon(){
  if(!faviconLink) return;
  const enabled=state.faviconEnabled!==false;
  if(!enabled){
    faviconLink.href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";
    return;
  }
  faviconLink.href=state.favicon || DEFAULT_FAVICON;
}

function safeHref(url){
  return /^https?:\/\//.test(url) ? url : "#";
}

function effectiveStatus(monitor, info){
  const state=(info&&info.state)||"pending";
  return monitor==="soft" && state==="down" ? "soft" : state;
}

function statusIcon(state){
  if(state==="up") return "fa-solid fa-circle-check";
  if(state==="soft") return "fa-solid fa-circle-xmark";
  if(state==="down") return "fa-solid fa-circle-xmark";
  return "fa-regular fa-circle";
}

function statusTitle(monitor, info){
  if(!info) return t("statusPending");
  const state=effectiveStatus(monitor, info);
  if(state==="up") return `${t("statusUp")} · ${info.ms} ms`;
  if(state==="soft") return `${t("statusSoftDown")} · ${info.error||t("statusNoResponse")}`;
  return `${t("statusDown")} · ${info.error||t("statusNoResponse")}`;
}

function formatDateTime(ms){
  try{
    const locale=state.language==="en" ? "en-GB" : "fr-FR";
    return new Intl.DateTimeFormat(locale,{
      day:"2-digit",month:"2-digit",year:"numeric"
    }).format(new Date(ms));
  }catch(_error){
    return "";
  }
}

function formatCompactNumber(n){
  const locale=state.language==="en" ? "en-GB" : "fr-FR";
  try{
    const v=Number(n)||0;
    if(v>=100000) return new Intl.NumberFormat(locale,{notation:"compact",maximumFractionDigits:1}).format(v);
    return new Intl.NumberFormat(locale).format(v);
  }catch(_error){
    return String(n);
  }
}

function formatNumber(n){
  const locale=state.language==="en" ? "en-GB" : "fr-FR";
  try{
    return new Intl.NumberFormat(locale).format(Number(n)||0);
  }catch(_error){
    return String(n);
  }
}

function widgetStatusKey(service){
  if(service.widget?.type==="docker"){
    return "docker:"+String(service.widget.hostId||"").trim();
  }
  return sanitizeUrl(service.url)||service.url;
}

function applyWidgetStatus(wrap,service,info){
  const badge=wrap.querySelector(".widget-badge");
  const time=wrap.querySelector(".widget-time");
  if(!info){
    badge.className="widget-badge pending";
    badge.textContent="—";
    time.textContent="";
    wrap.title=t("widgetPending");
    return;
  }
  if(service?.widget?.type==="lichess"){
    badge.className="widget-badge";
    if(info.error){
      badge.textContent="ELO —";
      time.className="widget-time";
      time.textContent="—";
      wrap.title=`${t("widgetError")} : ${String(info.error).slice(0,120)}`;
    }else if(info.elo==null){
      badge.textContent="ELO —";
      time.className="widget-time";
      time.textContent="—";
      wrap.title=t("widgetNoElo");
    }else{
      badge.textContent="ELO "+info.elo;
      const label=lichessVariantLabel(info.variant);
      const delta=info.delta==null ? null : Number(info.delta);
      time.className="widget-time"+(delta>0 ? " delta-up" : delta<0 ? " delta-down" : "");
      time.textContent=delta==null ? "—" : delta>0 ? `+${delta}` : delta<0 ? String(delta) : "±0";
      wrap.title=`${t("widgetLichess")} · ${label} ${info.elo}`;
    }
    return;
  }
  if(service?.widget?.type==="adguard"){
    if(info.error){
      badge.className="widget-badge nok";
      badge.textContent="AdGuard —";
      time.textContent="—";
      wrap.title=`${t("widgetAdGuardError")} : ${String(info.error).slice(0,120)}`;
    }else{
      const queries=Number(info.queries)||0;
      const pct=Math.round(Number(info.ratio)||0);
      badge.className="widget-badge ok";
      badge.textContent=`${t("widgetAdGuardBlocked")} ${pct} %`;
      time.textContent=`${t("widgetAdGuardQueries")} ${formatNumber(queries)}`;
      const avg=info.avgMs!=null ? ` · ${info.avgMs} ms` : "";
      wrap.title=`${t("widgetAdGuard")} · ${formatCompactNumber(queries)} ${t("widgetAdGuardQueries")} · ${pct} % ${t("widgetAdGuardBlocked")}${avg}`;
    }
return;
  }
  if(info.error){
    badge.className="widget-badge nok";
    badge.textContent=t("widgetBadgeNok");
    time.textContent="—";
    wrap.title=`${t("widgetError")} : ${String(info.error).slice(0,120)}`;
    return;
  }
  if(service?.widget?.type==="docker"){
    const containers=info?.containers;
    const updated=info?.updated;
    if(!info.error && containers && updated && containers.total>0){
      const allActive=containers.active===containers.total;
      const allUpdated=updated.count===updated.total;
      badge.className="widget-badge "+(allActive ? "ok" : "nok");
      badge.textContent=`${t("widgetDockerContainers")} ${containers.active} / ${containers.total}`;
      time.className="widget-time"+(allUpdated ? " delta-up" : " warn");
      time.textContent=`${t("widgetDockerUpdated")} ${updated.count} / ${updated.total}`;
      const unknown=Number(updated.unknown)||0;
      wrap.title=`${t("widgetDocker")} · ${containers.active}/${containers.total} · ${updated.count}/${updated.total}`
        + (unknown>0 ? ` · ${unknown} ${t("widgetDockerUnknown")}` : "");
    }else{
      badge.className="widget-badge pending";
      badge.textContent=`${t("widgetDocker")} —`;
      time.textContent="—";
      wrap.title=info?.error
        ? `${t("widgetError")} : ${String(info.error).slice(0,120)}`
        : t("widgetNever");
    }
    return;
  }
  if(info.ok===null || info.lastAttemptAt==null){
    badge.className="widget-badge pending";
    badge.textContent="—";
    time.textContent="—";
    wrap.title=t("widgetNever");
    return;
  }
  badge.className=info.ok ? "widget-badge ok" : "widget-badge nok";
  badge.textContent=info.ok ? t("widgetBadgeOk") : t("widgetBadgeNok");
  time.textContent=formatDateTime(info.lastAttemptAt);
  wrap.title=info.ok
    ? t("widgetOk")
    : `${t("widgetNok")} · ${formatDateTime(info.lastAttemptAt)}`;
}

function lichessVariantLabel(variant){
  const en=state.language==="en";
  const labels={
    bullet:en?"Bullet":"Bullet",
    blitz:en?"Blitz":"Blitz",
    rapid:en?"Rapid":"Rapide",
    classical:en?"Classical":"Classique"
  };
  return labels[variant] || variant || "";
}

export function updateViewButton(){
  const icon=viewBtn.querySelector("i");

  if(state.viewMode==="rows"){
    icon.className="fa-solid fa-bars";
    viewBtn.title=t("viewRows");
  }else if(state.viewMode==="columns"){
    icon.className="fa-solid fa-table-columns";
    viewBtn.title=t("viewColumns");
  }else{
    icon.className="fa-solid fa-border-all";
    viewBtn.title=t("viewPlain");
  }
}

export function updateOpenModeMenu(){
  openModeSelect.value=state.openMode==="new" ? "new" : "same";
}

export function updateGroupModeMenu(){
  groupCategoryBtn.classList.toggle("active",state.groupMode==="category");
  groupHostBtn.classList.toggle("active",state.groupMode==="host");
}

export function updateSortModeMenu(){
  sortAlphabeticalBtn.classList.toggle("active",state.sortMode==="alphabetical");
  sortUsageBtn.classList.toggle("active",state.sortMode==="usage");
}

export function setGroupMode(mode){
  state.groupMode=mode==="host" ? "host" : "category";
  updateGroupModeMenu();
  render();
  patchConfig({groupMode:state.groupMode});
}

export function focusHostGroup(hostName){
  state.groupMode="host";

  Object.keys(state.collapsed).forEach(key=>{
    if(key.startsWith("category:")) delete state.collapsed[key];
  });

  const hostNames=new Set([
    ...state.hosts.map(host=>host.name),
    FALLBACK_HOST
  ]);
  state.services.forEach(service=>{
    hostNames.add((service.host||"").trim() || FALLBACK_HOST);
  });

  hostNames.forEach(name=>{
    state.collapsed[`host:${name}`]=name!==hostName;
  });
  state.collapsed[`host:${hostName}`]=false;

  updateGroupModeMenu();
  render();
  updateCollapseAllButton();
  patchConfig({groupMode:"host",collapsed:state.collapsed});
}

function createCard(service){
  const card=document.createElement("a");
  card.className="card";
  card.href=safeHref(service.url);
  if(!service.url){
    card.addEventListener("click",e=>e.preventDefault());
  }else{
    card.addEventListener("click",()=>bumpUsage(serviceUsageKey(service)));
  }
  if(state.openMode==="new"){
    card.target="_blank";
    card.rel="noopener noreferrer";
  }

  if(service.icon){
    const icon=document.createElement("img");
    icon.className="service-icon";
    icon.src=service.icon;
    icon.alt="";
    icon.onerror=()=>{
      icon.remove();
      const fallback=document.createElement("div");
      fallback.className="service-fallback";
      fallback.innerHTML='<i class="fa-solid fa-cube"></i>';
      card.prepend(fallback);
    };
    card.appendChild(icon);
  }else{
    const fallback=document.createElement("div");
    fallback.className="service-fallback";
    fallback.innerHTML='<i class="fa-solid fa-cube"></i>';
    card.appendChild(fallback);
  }

  const title=document.createElement("div");
  title.className="card-title";
  title.textContent=service.name || t("unnamedService");
  card.appendChild(title);

  if(service.widget && ["duplicati","lichess","adguard","docker"].includes(service.widget.type)){
    const wrap=document.createElement("div");
    wrap.className=`widget-status widget-${service.widget.type}`;
    wrap.dataset.url=widgetStatusKey(service);
    wrap._service=service;
    const badge=document.createElement("span");
    badge.className="widget-badge pending";
    const time=document.createElement("span");
    time.className="widget-time";
    wrap.append(badge,time);
    applyWidgetStatus(wrap,service,state.serviceStatus[wrap.dataset.url]);
    card.appendChild(wrap);
  }else if(service.monitor!==false && service.url){
    const status=document.createElement("span");
    const serviceState=effectiveStatus(service.monitor, state.serviceStatus[service.url]);
    status.className=`service-status ${serviceState}`;
    status.dataset.url=service.url;
    if(service.monitor==="soft") status.dataset.soft="1";
    status.title=statusTitle(service.monitor, state.serviceStatus[service.url]);
    const icon=document.createElement("i");
    icon.className=statusIcon(serviceState);
    status.appendChild(icon);
    card.appendChild(status);
  }

  return card;
}

function createSection(categoryName,categoryServices,groupType="category"){
  const category=groupType==="host"
    ? (state.hosts.find(host=>host.name===categoryName) || {name:categoryName,icon:"fa-solid fa-server"})
    : getCategory(categoryName);
  const collapseKey=`${groupType}:${categoryName}`;
  const section=document.createElement("section");
  section.className="section";
  if(state.collapsed[collapseKey] ?? state.collapsed[categoryName]) section.classList.add("collapsed");

  const header=document.createElement("button");
  header.className="section-header";
  header.type="button";
  header.innerHTML=`
    <i class="${sanitizeIconClass(category.icon)} category-icon"></i>
    <span class="category-name"></span>
    <i class="fa-solid fa-chevron-down chevron"></i>
  `;
  header.querySelector(".category-name").textContent=groupLabel(categoryName);

  header.addEventListener("click",()=>{
    const collapsing=!section.classList.contains("collapsed");
    state.collapsed[collapseKey]=collapsing;
    delete state.collapsed[categoryName];
    updateCollapseAllButton();
    patchConfig({collapsed:state.collapsed});

    if(collapsing){
      reorderDashboardSections(true,null,()=>{
        section.classList.add("collapsed");
      },section);
    }else{
      reorderDashboardSections(true,section,()=>{
        section.classList.remove("collapsed");
      });
    }
  });

  const body=document.createElement("div");
  body.className="section-body";

  const cards=document.createElement("div");
  cards.className="cards";

  [...categoryServices]
    .sort(compareServices)
    .forEach(s=>cards.appendChild(createCard(s)));

  body.appendChild(cards);
  section.append(header,body);
  return section;
}

function prefersReducedMotion(){
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sectionHomeRank(section){
  const rank=Number(section.dataset.rank);
  return Number.isFinite(rank) ? rank : 0;
}

function getDashboardSections(){
  return [...dashboard.children].filter(node=>node&&node.classList&&node.classList.contains("section"));
}

function reorderDashboardSections(animate=false, forceExpand=null, onDone=null, forceCollapse=null){
  const sections=getDashboardSections();
  if(sections.length<2){
    if(onDone) onDone();
    return;
  }

  const ordered=[...sections].sort((a,b)=>{
    const ac=(a.classList.contains("collapsed") || a===forceCollapse) && a!==forceExpand;
    const bc=(b.classList.contains("collapsed") || b===forceCollapse) && b!==forceExpand;
    if(ac!==bc) return ac?1:-1;
    return sectionHomeRank(a)-sectionHomeRank(b);
  });

  const alreadyOrdered=ordered.every((s,i)=>s===sections[i]);
  if(alreadyOrdered){
    if(onDone) onDone();
    return;
  }

  if(!animate || prefersReducedMotion()){
    sections.forEach(s=>s.remove());
    ordered.forEach(s=>dashboard.appendChild(s));
    if(onDone) onDone();
    return;
  }

  const first=new Map(ordered.map(s=>[s,s.getBoundingClientRect()]));
  sections.forEach(s=>s.remove());
  ordered.forEach(s=>dashboard.appendChild(s));
  const last=new Map(ordered.map(s=>[s,s.getBoundingClientRect()]));

  ordered.forEach(s=>{
    const f=first.get(s);
    const l=last.get(s);
    s.style.transition="none";
    s.style.transform=`translate(${f.left-l.left}px, ${f.top-l.top}px)`;
  });

  void dashboard.offsetHeight;

  requestAnimationFrame(()=>{
    ordered.forEach(s=>{
      s.style.transition="transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1)";
      s.style.transform="";
    });
    setTimeout(()=>{
      ordered.forEach(s=>{
        s.style.transition="";
        s.style.transform="";
      });
      if(onDone) onDone();
    },400);
  });
}

function renderWebLinks(){
  webLinksSection.classList.toggle("collapsed",state.webLinksCollapsed);
  webLinksList.innerHTML="";

  if(!state.webLinks.length){
    webLinksSection.style.display="none";
    return;
  }

  webLinksSection.style.display="block";

  state.webLinks.forEach(link=>{
    const a=document.createElement("a");
    a.className="web-link";
    a.href=safeHref(link.url);
    a.target=state.openMode==="new" ? "_blank" : "_self";
    if(state.openMode==="new") a.rel="noopener noreferrer";
    a.title=link.url||link.name||"";
    a.addEventListener("click",e=>e.stopPropagation());

    const icon=document.createElement("span");
    icon.className="web-link-icon";
    icon.innerHTML=`<i class="${sanitizeIconClass(link.icon)}"></i>`;
    a.appendChild(icon);

    const name=document.createElement("span");
    name.className="web-link-name";
    name.textContent=link.name||t("unnamedLink");
    a.appendChild(name);
    webLinksList.appendChild(a);
  });
}

webLinksHeader.addEventListener("click",()=>{
  state.webLinksCollapsed=!state.webLinksCollapsed;
  renderWebLinks();
  patchConfig({webLinksCollapsed:state.webLinksCollapsed});
});

webLinksSection.addEventListener("click",e=>{
  if(e.target.closest(".web-link")) return;
  if(e.target.closest("#webLinksHeader")) return;
  state.webLinksCollapsed=!state.webLinksCollapsed;
  renderWebLinks();
  patchConfig({webLinksCollapsed:state.webLinksCollapsed});
});

function serviceMatchesQuery(service){
  const query=normalize(searchInput.value);
  if(!query) return true;
  return [
    service.name,
    service.category,
    service.host,
    service.url
  ].some(value=>normalize(value).includes(query));
}

function groupFallbackName(){
  return state.groupMode==="host" ? FALLBACK_HOST : "Autres";
}

function groupLabel(name){
  return state.groupMode==="host" && name===FALLBACK_HOST ? t("noHost") : name;
}

function getVisibleGroupNames(){
  const filtered=state.services.filter(serviceMatchesQuery);
  const field=state.groupMode==="host" ? "host" : "category";
  return [...new Set(
    filtered.map(service=>(service[field]||"").trim() || groupFallbackName())
  )];
}

function sortGroupNames(names){
  const reference=state.groupMode==="host" ? state.hosts : state.categories;
  return names.sort((a,b)=>{
    const ia=reference.findIndex(item=>item.name===a);
    const ib=reference.findIndex(item=>item.name===b);
    if(ia===-1 && ib===-1) return normalize(a).localeCompare(normalize(b),"fr");
    if(ia===-1) return 1;
    if(ib===-1) return -1;
    return ia-ib;
  });
}

export function render(){
  renderWebLinks();
  dashboard.dataset.view=state.viewMode;
  dashboard.classList.toggle("small-icons",state.smallIcons);

  const filtered=state.services.filter(serviceMatchesQuery);

  dashboard.innerHTML="";

  if(!filtered.length){
    const empty=document.createElement("div");
    empty.className="empty";
    empty.textContent=t("noServices");
    dashboard.appendChild(empty);
    return;
  }

  if(state.viewMode==="plain"){
    const cards=document.createElement("div");
    cards.className="cards";

    [...filtered]
      .sort(compareServices)
      .forEach(s=>cards.appendChild(createCard(s)));

    dashboard.appendChild(cards);
    return;
  }

  if(state.groupMode==="host"){
    sortGroupNames(getVisibleGroupNames()).forEach((hostName,index)=>{
      const items=filtered.filter(s=>((s.host||"").trim()||FALLBACK_HOST)===hostName);
      const section=createSection(hostName,items,"host");
      section.dataset.rank=String(index);
      dashboard.appendChild(section);
    });
  }else{
    sortGroupNames(getVisibleGroupNames()).forEach((categoryName,index)=>{
      const items=filtered.filter(s=>(s.category||"Autres")===categoryName);
      const section=createSection(categoryName,items,"category");
      section.dataset.rank=String(index);
      dashboard.appendChild(section);
    });
  }

  reorderDashboardSections(false);
  updateCollapseAllButton();
}

function getActiveGroupEntries(){
  if(state.viewMode==="plain") return [];

  return sortGroupNames(getVisibleGroupNames()).map(name=>({
    name,
    key:`${state.groupMode}:${name}`
  }));
}

function isGroupCollapsed(entry){
  return state.collapsed[entry.key] ?? state.collapsed[entry.name] ?? false;
}

export function getCollapseAllState(){
  const entries=getActiveGroupEntries();
  const collapsedCount=entries.filter(isGroupCollapsed).length;
  const expandedCount=entries.length-collapsedCount;

  return {
    entries,
    collapsedCount,
    expandedCount,
    majorityCollapsed:collapsedCount>expandedCount
  };
}

export function updateCollapseAllButton(){
  const info=getCollapseAllState();

  collapseAllBtn.disabled=info.entries.length===0;

  const actionExpand=info.majorityCollapsed;
  collapseAllBtn.title=actionExpand ? t("expandAll") : t("collapseAll");
  collapseAllBtn.setAttribute("aria-label",collapseAllBtn.title);
  collapseAllBtn.innerHTML=actionExpand
    ? '<i class="fa-solid fa-angles-down"></i>'
    : '<i class="fa-solid fa-angles-up"></i>';
}

export function updateStatusIndicators(){
  document.querySelectorAll(".service-status[data-url]").forEach(status=>{
    const info=state.serviceStatus[status.dataset.url];
    if(!info) return;
    const monitor=status.dataset.soft==="1" ? "soft" : "full";
    const serviceState=effectiveStatus(monitor, info);
    status.className=`service-status ${serviceState}`;
    const icon=status.querySelector("i");
    if(icon) icon.className=statusIcon(serviceState);
    status.title=statusTitle(monitor, info);
  });
  document.querySelectorAll(".widget-status[data-url]").forEach(wrap=>{
    const info=state.serviceStatus[wrap.dataset.url];
    if(!info) return;
    const service=wrap._service
      || state.services.find(s=>s.url===wrap.dataset.url)
      || state.services.find(s=>(sanitizeUrl(s.url)||s.url)===wrap.dataset.url);
    applyWidgetStatus(wrap,service,info);
  });
}
