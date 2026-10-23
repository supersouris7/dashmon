// Rendu de Dashmon (cartes, groupes, mode d'affichage) et état des boutons du menu.
import { state, getCategory, compareServices, serviceUsageKey, normalize, sanitizeUrl, sanitizeIconClass, sanitizeTileColor, FALLBACK_HOST, linkCounterValue, compactCount, webLinksColors, WEB_LINK_COLORS, normalizeWebLinksColor } from "./state.js";
import { t } from "./i18n.js";
import { bumpUsage, patchConfig } from "./api.js";
import { saveViewPrefs } from "./view-prefs.js";
import { hasWidget, renderWidget, widgetStatusKey } from "./widget-registry.js";
import { effectiveStatus, statusIcon } from "./status.js";
import { fortuneText, pickFortune, loadFortunes } from "./fortune.js";
import {
  dashboard, searchInput, webLinksSection, webLinksList,
  hideWebLinksBtn, restoreWebLinksBtn, webLinksColorChoices,
  viewBtn, iconsBtn, collapseAllBtn, openModeSelect, groupCategoryBtn,
  groupHostBtn, sortAlphabeticalBtn, sortUsageBtn
} from "./dom.js";

function safeHref(url){
  return /^https?:\/\//.test(url) ? url : "#";
}

// Chiffre affiche dans le bandeau : "(3000)" quand le compteur est disponible,
// rien sinon. Nombre brut, sans separateur de milliers, pour rester compact sous
// les yeux. Le nom du lien reste seul tant que la mesure n'est pas revenue,
// plutot que d'afficher un zero trompeur.
function linkCounterText(link){
  if(!link.counter) return "";
  const value=linkCounterValue(link.counter,state.serviceStatus[link.url]);
  return value==null ? "" : `(${compactCount(value)})`;
}

function updateWebLinkCounters(){
  document.querySelectorAll(".web-link-counter[data-url]").forEach(counter=>{
    const link=state.webLinks.find(item=>item.url===counter.dataset.url);
    counter.textContent=link ? linkCounterText(link) : "";
  });
}

function statusTitle(monitor, info){
  if(!info) return t("statusPending");
  const state=effectiveStatus(monitor, info);
  if(state==="up") return `${t("statusUp")} · ${info.ms} ms`;
  if(state==="soft") return `${t("statusSoftDown")} · ${info.error||t("statusNoResponse")}`;
  return `${t("statusDown")} · ${info.error||t("statusNoResponse")}`;
}

// Rendu d'une tuile de widget : le travail est fait par le renderer du widget
// (widgets/<id>/client.js), charge dynamiquement par le registre. Ce fichier ne
// contient plus aucun cas particulier : ajouter un widget n'edite pas render.js.
function applyWidgetStatus(wrap,service,info){
  const view=renderWidget(service,info,state.language);
  if(view.element){
    // Rendu sur mesure : le widget fournit son propre noeud DOM.
    wrap.replaceChildren(view.element);
    wrap.title=view.title||"";
    return;
  }
  const badge=wrap.querySelector(".widget-badge");
  const time=wrap.querySelector(".widget-time");
  if(!badge||!time) return;
  badge.className="widget-badge"+(view.badgeClass ? " "+view.badgeClass : "");
  badge.textContent=view.badge || "—";
  time.className="widget-time"+(view.timeClass ? " "+view.timeClass : "");
  time.textContent=view.time || "";
  wrap.title=view.title || "";
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

// Le bouton regle la taille des icones. Le libelle annonce l'etat courant et le glyphe change, comme
// le bouton d'affichage : les flèches rentrent quand les icônes rétrécissent et
// sortent quand elles grossissent, donc le bouton montre l'action, pas l'état.
export function updateIconsButton(){
  const icon=iconsBtn.querySelector("i");
  const label=state.smallIcons ? t("smallIconsOptionOn") : t("smallIconsOptionOff");
  icon.className=state.smallIcons
    ? "fa-solid fa-down-left-and-up-right-to-center"
    : "fa-solid fa-expand-alt";
  iconsBtn.title=label;
  iconsBtn.setAttribute("aria-label",label);
  iconsBtn.setAttribute("aria-pressed",state.smallIcons ? "true" : "false");
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
  saveViewPrefs({groupMode:state.groupMode});
}

// Couleur d'une tuile en affichage a plat : il n'y a pas de section, donc rien
// a quoi heriter. La regle reste celle du mode actif — couleur de l'hote quand
// l'affichage est par hote, couleur de la categorie sinon — pour que le
// passage d'un mode a l'autre ne change pas les couleurs.
function tileColorFor(service){
  const name=(service&&((service.host||"").trim()||FALLBACK_HOST))||"";
  const target=state.groupMode==="host"
    ? state.hosts.find(host=>host.name===name)
    : getCategory((service&&service.category)||"");
  return sanitizeTileColor((target||{}).color);
}

// Icone de tuile : PNG de la bibliotheque, ou cube par defaut si l'image
// manque.
function appendTileIcon(card,service){
  if(!service.icon){
    const fallback=document.createElement("div");
    fallback.className="service-fallback";
    fallback.innerHTML='<i class="fa-solid fa-cube"></i>';
    card.appendChild(fallback);
    return;
  }
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
}

// Tuile fortune : pas d'intitule, pas de pastille, pas de lien. L'icone et la
// phrase du jour suffisent ; un clic tire une autre phrase pour la journee.
// "key" est l'identite stable de la tuile (ici le type special).
function createFortuneCard(key){
  const card=document.createElement("div");
  card.className="card fortune";
  card.tabIndex=0;
  card.setAttribute("role","button");
  card.title=t("fortuneHint");

  // Meme traitement qu'une icône de service : `.service-icon` sans fond ni
  // bordure, contrairement a `.service-fallback` qui encadre un glyphe.
  const icon=document.createElement("img");
  icon.className="service-icon";
  icon.src="images/fortunecookie.png";
  icon.alt="Fortune Cookie";
  icon.onerror=()=>{
    icon.remove();
    const fallback=document.createElement("div");
    fallback.className="service-fallback";
    fallback.innerHTML='<i class="fa-solid fa-cookie-bite"></i>';
    card.prepend(fallback);
  };
  card.appendChild(icon);

  const text=document.createElement("div");
  text.className="fortune-text";
  card.appendChild(text);

  const paint=()=>{
    text.textContent=fortuneText(key,state.language);
  };
  paint();

  // Le jeu est charge en asynchrone : au premier rendu il peut etre vide, et la
  // tuile se remplit seule des que le fichier est arrive.
  loadFortunes().then(()=>{
    if(card.isConnected) paint();
  });

  const confetti=()=>{
    if(typeof window!=="undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors=["#ff8a1f","#ff4d6d","#3cf59b","#6d8ed1","#d76cff"];
    for(let index=0;index<28;index++){
      const particle=document.createElement("i");
      particle.className="fortune-confetti";
      particle.style.left=`${18+Math.round(Math.random()*64)}%`;
      particle.style.top=`${18+Math.round(Math.random()*62)}%`;
      particle.style.setProperty("--x",`${Math.round((Math.random()-.5)*460)}px`);
      particle.style.setProperty("--y",`${Math.round((Math.random()-.45)*300)}px`);
      particle.style.setProperty("--r",`${Math.round((Math.random()-.5)*540)}deg`);
      particle.style.setProperty("--size",`${8+Math.round(Math.random()*6)}px`);
      particle.style.background=colors[index%colors.length];
      particle.style.color=colors[index%colors.length];
      particle.addEventListener("animationend",()=>particle.remove(),{once:true});
      card.appendChild(particle);
    }
  };

  const next=event=>{
    if(event) event.preventDefault();
    text.textContent=pickFortune(key,state.language);
    confetti();
  };
  card.addEventListener("click",next);
  card.addEventListener("keydown",event=>{
    if(event.key!=="Enter" && event.key!==" ") return;
    next(event);
  });

  return card;
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

  appendTileIcon(card,service);

  const title=document.createElement("div");
  title.className="card-title";
  title.textContent=service.name || t("unnamedService");
  card.appendChild(title);

  // La classe widget-<id> reste : elle porte les specificites CSS du widget
  // (ex. la 2e ligne en gras pour Docker), sans que le core connaisse le widget.
  if(service.widget && hasWidget(service.widget.type)){
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

function createSection(categoryName,categoryServices,groupType="category",specialCard=null){
  const category=groupType==="host"
    ? (state.hosts.find(host=>host.name===categoryName) || {name:categoryName,icon:"fa-solid fa-server"})
    : getCategory(categoryName);
  const collapseKey=`${groupType}:${categoryName}`;
  const section=document.createElement("section");
  section.className="section";
  // La couleur se pose sur la section, pas sur chaque tuile : les services
  // heritent, et le mode d'affichage n'a rien a faire ici — createSection
  // resout deja la categorie OU l'hote selon le mode actif. Les deux themes
  // "colores" n'en font que le fond, les autres se contentent du liseret.
  const tileColor=sanitizeTileColor(category.color);
  // La classe "tinted" est ce qui distingue une section coloree : sans elle,
  // --tile-color vaudrait transparent et la bordure disparaitrait au lieu de
  // rester celle du theme.
  if(tileColor){
    section.classList.add("tinted");
    section.style.setProperty("--tile-color",tileColor);
  }
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
    saveViewPrefs({collapsed:state.collapsed});

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

  // La tuile speciale ouvre sa section : elle passe avant les services, meme
  // quand aucun service ne peuple le groupe.
  if(specialCard) cards.appendChild(specialCard);

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

export function updateWebLinksAppearance(){
  const {background,foreground}=webLinksColors(state.webLinksColor);
  for(const element of [webLinksSection,restoreWebLinksBtn]){
    element.style.backgroundColor=background;
    element.style.color=foreground;
  }
  for(const choice of webLinksColorChoices.querySelectorAll("[data-color]")){
    const active=choice.dataset.color===state.webLinksColor;
    choice.style.backgroundColor=WEB_LINK_COLORS[choice.dataset.color]||"transparent";
    choice.classList.toggle("is-active",active);
    choice.setAttribute("aria-checked",String(active));
  }
  webLinksSection.style.display=state.webLinks.length && !state.webLinksHidden ? "flex" : "none";
  restoreWebLinksBtn.hidden=!state.webLinks.length || !state.webLinksHidden;
}

webLinksColorChoices.addEventListener("click",event=>{
  const choice=event.target.closest("[data-color]");
  if(!choice) return;
  state.webLinksColor=normalizeWebLinksColor(choice.dataset.color);
  updateWebLinksAppearance();
  patchConfig({webLinksColor:state.webLinksColor});
});

hideWebLinksBtn.addEventListener("click",()=>{
  state.webLinksHidden=true;
  saveViewPrefs({webLinksHidden:true});
  updateWebLinksAppearance();
  restoreWebLinksBtn.focus();
});

restoreWebLinksBtn.addEventListener("click",()=>{
  state.webLinksHidden=false;
  saveViewPrefs({webLinksHidden:false});
  updateWebLinksAppearance();
  hideWebLinksBtn.focus();
});

function renderWebLinks(){
  updateWebLinksAppearance();
  webLinksList.innerHTML="";

  if(!state.webLinks.length){
    return;
  }

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

    if(link.counter){
      const counter=document.createElement("span");
      counter.className="web-link-counter";
      counter.dataset.url=link.url;
      counter.textContent=linkCounterText(link);
      a.appendChild(counter);
    }

    webLinksList.appendChild(a);
  });
}

// Dashboard actif, borne a un identifiant existant : une preference d'un autre
// navigateur pointant sur un dashboard supprime ne doit pas vider l'ecran.
export function currentDashboardId(){
  return state.dashboards.some(d=>d.id===state.dashboardId) ? state.dashboardId : (state.dashboards[0]?.id||"");
}

// Un dashboard regroupe des categories ; une categorie appartient a un seul
// dashboard. Un service est donc visible si sa categorie est rattachee au
// dashboard actif. Une categorie vide ou inconnue retombe sur le premier
// dashboard, pour ne jamais faire disparaitre un service mal categorise.
function categoryDashboardId(name){
  const category=state.categories.find(c=>c.name===name);
  return category ? category.dashboardId : (state.dashboards[0]?.id||"");
}

function serviceInDashboard(service){
  return categoryDashboardId(service.category)===currentDashboardId();
}

function serviceMatchesQuery(service){
  if(!serviceInDashboard(service)) return false;
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

// Tuile speciale : une seule par tableau de bord, placee dans la categorie
// choisie. En affichage par hote, elle rejoint le groupe "sans hote". Elle suit
// aussi la recherche et le dashboard actif, comme les services.
function specialTileVisible(){
  if(!state.specialTile) return false;
  if(categoryDashboardId(state.specialTile.category)!==currentDashboardId()) return false;
  const query=normalize(searchInput.value);
  if(!query) return true;
  return normalize(state.specialTile.category).includes(query);
}

function specialGroupName(){
  if(!specialTileVisible()) return "";
  return state.groupMode==="host" ? FALLBACK_HOST : (state.specialTile.category||"Autres");
}

function createSpecialCard(){
  const tile=state.specialTile;
  if(!tile) return null;
  if(tile.type==="fortune") return createFortuneCard(tile.type);
  return null;
}

// Couleur de la tuile speciale en affichage a plat : meme regle que les
// services, resolue sur le groupe qui l'accueille.
function specialTileColor(){
  if(state.groupMode==="host"){
    const host=state.hosts.find(item=>item.name===FALLBACK_HOST);
    return sanitizeTileColor((host||{}).color);
  }
  return sanitizeTileColor((getCategory(state.specialTile.category)||{}).color);
}

function getVisibleGroupNames(){
  const filtered=state.services.filter(serviceMatchesQuery);
  const field=state.groupMode==="host" ? "host" : "category";
  const names=[...new Set(
    filtered.map(service=>(service[field]||"").trim() || groupFallbackName())
  )];
  const extra=specialGroupName();
  if(extra && !names.includes(extra)) names.push(extra);
  return names;
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
  const specialGroup=specialGroupName();
  const special=specialGroup ? createSpecialCard() : null;

  dashboard.innerHTML="";

  if(!filtered.length && !special){
    const empty=document.createElement("div");
    empty.className="empty";
    empty.textContent=t("noServices");
    dashboard.appendChild(empty);
    return;
  }

  if(state.viewMode==="plain"){
    const cards=document.createElement("div");
    cards.className="cards";

    if(special){
      const color=specialTileColor();
      if(color){
        special.classList.add("tinted");
        special.style.setProperty("--tile-color",color);
      }
      cards.appendChild(special);
    }

    [...filtered]
      .sort(compareServices)
      .forEach(service=>{
        const card=createCard(service);
        // Mode a plat : la tuile porte sa propre couleur, faute de section.
        const color=tileColorFor(service);
        if(color){
          card.classList.add("tinted");
          card.style.setProperty("--tile-color",color);
        }
        cards.appendChild(card);
      });

    dashboard.appendChild(cards);
    return;
  }

  if(state.groupMode==="host"){
    sortGroupNames(getVisibleGroupNames()).forEach((hostName,index)=>{
      const items=filtered.filter(s=>((s.host||"").trim()||FALLBACK_HOST)===hostName);
      const section=createSection(hostName,items,"host",specialGroup===hostName ? special : null);
      section.dataset.rank=String(index);
      dashboard.appendChild(section);
    });
  }else{
    sortGroupNames(getVisibleGroupNames()).forEach((categoryName,index)=>{
      const items=filtered.filter(s=>(s.category||"Autres")===categoryName);
      const section=createSection(categoryName,items,"category",specialGroup===categoryName ? special : null);
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
  updateWebLinkCounters();
}
