// Navigation du tableau de bord : un bouton par dashboard, puis Supervision.
// Le panneau de boutons est construit en JavaScript car son contenu depend de
// la liste des dashboards et du libelle courant (langue, renommage en editeur).
import { state } from "./state.js";
import { render } from "./render.js";
import { renderSupervision, startSupervisionMetrics, stopSupervisionMetrics } from "./supervision.js";
import { pageSwitchGroup } from "./dom.js";
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
  btn.appendChild(i);
  // Les onglets sont icone seule : le libelle reste disponible en infobulle et
  // pour les lecteurs d'ecran.
  btn.title=label;
  btn.setAttribute("aria-label",label);
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
  applyPage();
}

function selectSupervision(){
  state.page="supervision";
  saveViewPrefs({page:state.page});
  applyPage();
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
  const activeId=activeDashboardId();

  state.dashboards.forEach(d=>{
    const id=d.id||"main";
    const btn=button("dashboard",d.icon||"fa-solid fa-grip",d.name||t("pageDashboard"),
      state.page==="dashboard" && id===activeId);
    btn.dataset.dashboardId=id;
    btn.addEventListener("click",()=>selectDashboard(id));
    pageSwitchGroup.appendChild(btn);
  });

  const sup=button("supervision","fa-solid fa-shield-halved",t("pageSupervision"),state.page==="supervision");
  sup.addEventListener("click",selectSupervision);
  pageSwitchGroup.appendChild(sup);
}

// Applique une page sans forcement persister : le rendu initial de l'application
// fait simplement honneur a la preference deja chargee.
export function setPage(page){
  state.page=page==="supervision" ? "supervision" : "dashboard";
  applyPage();
}
