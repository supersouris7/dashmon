// Rendu de Dashmon (cartes, groupes, mode d'affichage) et état des boutons du menu.
import { state, getCategory, compareServices, serviceUsageKey, normalize, sanitizeUrl, sanitizeIconClass, DEFAULT_BANNER_URL, DEFAULT_FAVICON, FALLBACK_HOST } from "./state.js";
import { t } from "./i18n.js";
import { patchConfig, bumpUsage } from "./api.js";
import {
  dashboard, searchInput, webLinksSection, webLinksHeader, webLinksList,
  viewBtn, collapseAllBtn, sameTabBtn, newTabBtn, groupCategoryBtn,
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
  if(faviconLink){
    faviconLink.href=state.favicon || DEFAULT_FAVICON;
  }
}

function safeHref(url){
  return /^https?:\/\//.test(url) ? url : "#";
}

function effectiveStatus(monitor, info){
  const state=(info&&info.state)||"pending";
  return monitor==="soft" && state==="down" ? "soft" : state;
}

function statusIcon(state){
  if(state==="up") return "fa-regular fa-circle-check";
  if(state==="soft") return "fa-solid fa-circle-exclamation";
  if(state==="down") return "fa-regular fa-circle-xmark";
  return "fa-regular fa-circle";
}

function statusTitle(monitor, info){
  if(!info) return t("statusPending");
  const state=effectiveStatus(monitor, info);
  if(state==="up") return `${t("statusUp")} · ${info.ms} ms`;
  if(state==="soft") return `${t("statusSoftDown")} · ${info.error||t("statusNoResponse")}`;
  return `${t("statusDown")} · ${info.error||t("statusNoResponse")}`;
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
  sameTabBtn.classList.toggle("active",state.openMode==="same");
  newTabBtn.classList.toggle("active",state.openMode==="new");
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

  if(service.monitor!==false && service.url){
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
    const isCollapsed=section.classList.toggle("collapsed");
    state.collapsed[collapseKey]=isCollapsed;
    delete state.collapsed[categoryName];
    updateCollapseAllButton();
    patchConfig({collapsed:state.collapsed});
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
  return normalize(service.name).includes(normalize(searchInput.value));
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
  const query=normalize(searchInput.value);

  const filtered=state.services.filter(s=>{
    return normalize(s.name).includes(query);
  });

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
    sortGroupNames(getVisibleGroupNames()).forEach(hostName=>{
      const items=filtered.filter(s=>((s.host||"").trim()||FALLBACK_HOST)===hostName);
      dashboard.appendChild(createSection(hostName,items,"host"));
    });
  }else{
    sortGroupNames(getVisibleGroupNames()).forEach(categoryName=>{
      const items=filtered.filter(s=>(s.category||"Autres")===categoryName);
      dashboard.appendChild(createSection(categoryName,items,"category"));
    });
  }

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
}
