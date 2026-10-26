// Navigation du tableau de bord : un bouton par dashboard et par instance supervisee.
// Le panneau de boutons est construit en JavaScript car son contenu depend de
// la liste des dashboards et du libelle courant (langue, renommage en editeur).
import { state } from "./state.js";
import { render } from "./render.js";
import { renderSupervision, startSupervisionMetrics, stopSupervisionMetrics,
  selectedSupervisionInstanceId, supervisionInstanceLabel, supervisionInstances } from "./supervision.js";
import { pageSwitchGroup, mobilePageBtn, mobilePageMenu } from "./dom.js";
import { saveViewPrefs } from "./view-prefs.js";
import { t } from "./i18n.js";

function button(page, icon, label, active){
  const btn=document.createElement("button");
  btn.className="page-btn";
  btn.type="button";
  btn.dataset.page=page;
  const i=document.createElement("i");
  i.className=icon;
  i.setAttribute("aria-hidden","true");
  const span=document.createElement("span");
  span.textContent=label;
  btn.append(i,span);
  btn.setAttribute("aria-pressed",String(active));
  return btn;
}

// Un identifiant de dashboard inconnu ne doit jamais rendre tous les boutons
// inactifs : on retombe sur le dashboard effectif (voir currentDashboardId).
function activeDashboardId(){
  return state.dashboards.some(d=>d.id===state.dashboardId) ? state.dashboardId : (state.dashboards[0]?.id||"");
}

function selectDashboard(id){
  state.page="dashboard";
  state.dashboardId=id;
  saveViewPrefs({page:state.page,dashboardId:state.dashboardId});
  closeMobilePageMenu();
  applyPage();
}

function selectSupervision(instanceId){
  state.page="supervision";
  state.supervisionInstanceId=instanceId;
  selectedSupervisionInstanceId();
  saveViewPrefs({page:state.page,supervisionInstanceId:state.supervisionInstanceId});
  closeMobilePageMenu();
  applyPage();
}

function closeMobilePageMenu(){
  mobilePageBtn.setAttribute("aria-expanded","false");
  mobilePageMenu.classList.remove("show");
}

function mobileMenuItem(icon,label,active,onClick){
  const item=document.createElement("button");
  item.className="mobile-page-menu-item";
  item.type="button";
  item.setAttribute("role","menuitem");
  item.setAttribute("aria-current",active ? "page" : "false");
  const marker=document.createElement("i");
  marker.className=icon;
  marker.setAttribute("aria-hidden","true");
  const text=document.createElement("span");
  text.textContent=label;
  item.append(marker,text);
  item.addEventListener("click",onClick);
  return item;
}

function applyPage(){
  document.body.dataset.page=state.page;
  if(state.page==="supervision"){
    // La lecture des mesures ne tourne que sur cette page : ouvert ici, arrete
    // au retour au tableau de bord (voir startSupervisionMetrics).
    renderSupervision();
    startSupervisionMetrics();
  }else{
    stopSupervisionMetrics();
    render();
  }
  renderPageSwitch();
}

export function renderPageSwitch(){
  pageSwitchGroup.replaceChildren();
  mobilePageMenu.replaceChildren();
  const activeId=activeDashboardId();
  let mobileCurrent=null;

  state.dashboards.forEach(d=>{
    const id=d.id||"main";
    const active=state.page==="dashboard" && id===activeId;
    const btn=button("dashboard",d.icon||"fa-solid fa-grip",d.name||t("pageDashboard"),
      active);
    btn.dataset.dashboardId=id;
    btn.title=d.name||t("pageDashboard");
    btn.addEventListener("click",()=>selectDashboard(id));
    pageSwitchGroup.appendChild(btn);
    const icon=d.icon||"fa-solid fa-grip";
    const label=d.name||t("pageDashboard");
    mobilePageMenu.appendChild(mobileMenuItem(icon,label,active,()=>selectDashboard(id)));
    if(active) mobileCurrent={icon,label};
  });

  const requestedInstanceId=state.supervisionInstanceId;
  const activeInstanceId=selectedSupervisionInstanceId();
  if(requestedInstanceId!==activeInstanceId){
    saveViewPrefs({supervisionInstanceId:activeInstanceId});
  }
  supervisionInstances().forEach(instance=>{
    const label=supervisionInstanceLabel(instance);
    const active=state.page==="supervision" && instance.id===activeInstanceId;
    const sup=button("supervision","fa-solid fa-shield-halved",label,active);
    sup.dataset.supervisionInstanceId=instance.id;
    sup.title=label;
    sup.addEventListener("click",()=>selectSupervision(instance.id));
    pageSwitchGroup.appendChild(sup);
    mobilePageMenu.appendChild(mobileMenuItem("fa-solid fa-shield-halved",label,active,()=>selectSupervision(instance.id)));
    if(active) mobileCurrent={icon:"fa-solid fa-shield-halved",label};
  });

  const current=mobileCurrent||{icon:"fa-solid fa-grip",label:t("pageDashboard")};
  mobilePageBtn.replaceChildren();
  const icon=document.createElement("i");
  icon.className=current.icon;
  icon.setAttribute("aria-hidden","true");
  const text=document.createElement("span");
  text.textContent=current.label;
  const chevron=document.createElement("i");
  chevron.className="fa-solid fa-chevron-down";
  chevron.setAttribute("aria-hidden","true");
  mobilePageBtn.append(icon,text,chevron);
  mobilePageBtn.setAttribute("aria-label",t("pageSwitch"));
}

mobilePageBtn.addEventListener("click",()=>{
  const open=mobilePageBtn.getAttribute("aria-expanded")!=="true";
  mobilePageBtn.setAttribute("aria-expanded",String(open));
  mobilePageMenu.classList.toggle("show",open);
});

document.addEventListener("click",event=>{
  if(!event.target.closest(".mobile-page-menu")) closeMobilePageMenu();
});

// Applique une page sans forcement persister : le rendu initial de l'application
// fait simplement honneur a la preference deja chargee.
export function setPage(page){
  state.page=page==="supervision" ? "supervision" : "dashboard";
  applyPage();
}
