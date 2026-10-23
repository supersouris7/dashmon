// Point d'entrée : initialisation, menu principal, modals (éditeur/apparence), événements globaux.
import { state, normalizeConfig, normalizeViewPrefs, isTypingTarget, sanitizeUrl } from "./state.js";
import { patchConfig } from "./api.js";
import { loadViewPrefs, pickViewPrefs, saveViewPrefs } from "./view-prefs.js";
import { render, updateViewButton, updateIconsButton, updateOpenModeMenu, updateGroupModeMenu,
  updateSortModeMenu, setGroupMode, getCollapseAllState, updateCollapseAllButton,
  updateStatusIndicators } from "./render.js";
import { applyLanguage, setThemeLabelsUpdater, setCollapseButtonUpdater, setSupervisionUpdater, setPageSwitchUpdater } from "./i18n.js";
import {
  loadThemes, applyTheme, setTheme, currentTheme, downloadTheme,
  importThemeFile, deleteCustomTheme, applyThemeLabels
} from "./themes.js";
import { startStatusLoop, setupVisibilityPause, manualRefresh } from "./metrics.js";
import { renderSupervision, toggleAllSmartDetails } from "./supervision.js";
import { renderPageSwitch, setPage } from "./pages.js";
import { openEditor, closeEditor, renderServiceEditor, renderCategoryEditor,
  renderDashboardEditor, renderHostEditor, renderWebLinksEditor, renderWidgetsEditor } from "./editor.js";
import { closeImageLibrary } from "./images.js";
import { loadWidgetRegistry } from "./widget-registry.js";
import {
    searchInput, viewBtn, iconsBtn, collapseAllBtn, moreBtn, topMenu,
  openModeSelect, groupCategoryBtn, groupHostBtn,
  sortAlphabeticalBtn, sortUsageBtn, menuEditBtn, menuSupervisionBtn,
  menuAppearanceBtn, menuRefreshBtn,
  appearanceBackdrop, appearanceCloseBtn, appearanceDoneBtn, themeSelect,
  languageSelect, webLinksSection, restoreWebLinksBtn, resetUsageBtn, importThemeBtn, exportThemeBtn, deleteThemeBtn,
  themeImportInput, modalBackdrop, imageLibrary
} from "./dom.js";

setThemeLabelsUpdater(applyThemeLabels);
setCollapseButtonUpdater(updateCollapseAllButton);
setSupervisionUpdater(renderSupervision);
setPageSwitchUpdater(renderPageSwitch);

async function loadConfig(){
  try{
    // Parametre anti-cache : certains reverse proxies ignorent Cache-Control et
    // resservent l'ancienne configuration apres une suppression.
    const response=await fetch("/api/config?_="+Date.now(),{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);

    const cfg=normalizeConfig(await response.json());
    state.services=cfg.services;
    state.categories=cfg.categories;
    state.dashboards=cfg.dashboards;
    state.hosts=cfg.hosts;
    state.specialTile=cfg.specialTile;
    // Disposition de l'écran : ce navigateur prime, la config serveur sert de
    // valeur initiale (premier chargement, ou navigateur tout neuf).
    const viewPrefs=normalizeViewPrefs(Object.assign(pickViewPrefs(cfg),loadViewPrefs()));
    state.collapsed=viewPrefs.collapsed;
    state.viewMode=viewPrefs.viewMode;
    state.openMode=viewPrefs.openMode;
    state.groupMode=viewPrefs.groupMode;
    state.sortMode=viewPrefs.sortMode;
    state.smallIcons=viewPrefs.smallIcons;
    state.webLinksHidden=viewPrefs.webLinksHidden;
    state.page=viewPrefs.page;
    // Le dashboard actif vient de la preference, mais il est borne a la liste
    // de la config : une preference dont le dashboard a ete supprime retombe
    // sur le premier dashboard.
    state.dashboardId=cfg.dashboards.some(d=>d.id===viewPrefs.dashboardId)
      ? viewPrefs.dashboardId
      : (cfg.dashboards[0]?.id||state.dashboardId);
    state.webLinksColor=cfg.webLinksColor;
    state.theme=cfg.theme;
    state.language=cfg.language;
    state.usageCounts=cfg.usageCounts;
    state.webLinks=cfg.webLinks;
    state.webLinksSeedVersion=cfg.webLinksSeedVersion;
  }catch(error){
    console.error("Chargement de config.json impossible",error);
  }

  updateViewButton();
  updateIconsButton();
  updateOpenModeMenu();
  updateGroupModeMenu();
  updateSortModeMenu();
  applyTheme();
  applyLanguage();
  render();
  setPage(state.page);
  setToolbarHeight();
}

function closeTopMenu(){
  topMenu.classList.remove("show");
  moreBtn.setAttribute("aria-expanded","false");
}

function setOpenMode(mode){
  state.openMode=mode;
  updateOpenModeMenu();
  openModeSelect.value=mode;
  render();
  saveViewPrefs({openMode:mode});
}

function setToolbarHeight(){
  const linksHeight=Math.max(webLinksSection.getBoundingClientRect().height,restoreWebLinksBtn.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--web-links-h",linksHeight+"px");
  const rect=document.querySelector(".toolbar").getBoundingClientRect();
  const bottom=Math.max(linksHeight,rect.bottom,0);
  document.documentElement.style.setProperty("--toolbar-h",bottom+"px");
}

window.addEventListener("resize",setToolbarHeight);
window.addEventListener("scroll",setToolbarHeight,{passive:true});
const headerObserver=new ResizeObserver(setToolbarHeight);
for(const element of [webLinksSection,restoreWebLinksBtn,document.querySelector(".toolbar")]) headerObserver.observe(element);

function openAppearance(){
  setToolbarHeight();
  closeTopMenu();
  if([...themeSelect.options].some(option=>option.value===state.theme)){
    themeSelect.value=state.theme;
  }
  languageSelect.value=state.language;
  openModeSelect.value=state.openMode==="new" ? "new" : "same";
  updateThemeManageUI();
  appearanceBackdrop.classList.add("show");
  appearanceBackdrop.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function closeAppearance(){
  appearanceBackdrop.classList.remove("show");
  appearanceBackdrop.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

function updateThemeManageUI(){
  const theme=currentTheme();
  const custom=Boolean(theme && !theme.native);
  deleteThemeBtn.disabled=!custom;
  exportThemeBtn.disabled=!theme;
}

moreBtn.addEventListener("click",e=>{
  e.stopPropagation();
  const open=topMenu.classList.toggle("show");
  moreBtn.setAttribute("aria-expanded",open ? "true" : "false");
});

topMenu.addEventListener("click",e=>e.stopPropagation());
groupCategoryBtn.addEventListener("click",()=>setGroupMode("category"));
groupHostBtn.addEventListener("click",()=>setGroupMode("host"));

sortAlphabeticalBtn.addEventListener("click",()=>{
  state.sortMode="alphabetical";
  updateSortModeMenu();
  render();
  saveViewPrefs({sortMode:"alphabetical"});
  closeTopMenu();
});

sortUsageBtn.addEventListener("click",()=>{
  state.sortMode="usage";
  updateSortModeMenu();
  render();
  saveViewPrefs({sortMode:"usage"});
  closeTopMenu();
});

viewBtn.addEventListener("click",()=>{
  if(state.viewMode==="rows"){
    state.viewMode="columns";
  }else if(state.viewMode==="columns"){
    state.viewMode="plain";
  }else{
    state.viewMode="rows";
  }

  updateViewButton();
  render();
  saveViewPrefs({viewMode:state.viewMode});
});

collapseAllBtn.addEventListener("click",()=>{
  if(state.page==="supervision"){
    toggleAllSmartDetails();
    return;
  }
  const info=getCollapseAllState();
  if(!info.entries.length) return;

  const shouldCollapse=!info.majorityCollapsed;

  info.entries.forEach(entry=>{
    state.collapsed[entry.key]=shouldCollapse;
    delete state.collapsed[entry.name];
  });

  render();
  saveViewPrefs({collapsed:state.collapsed});
});

menuEditBtn.addEventListener("click",()=>{
  closeTopMenu();
  openEditor();
});

menuSupervisionBtn.addEventListener("click",()=>{
  closeTopMenu();
  openEditor("supervision");
});

menuAppearanceBtn.addEventListener("click",openAppearance);

menuRefreshBtn.addEventListener("click",()=>{
  closeTopMenu();
  manualRefresh();
});
appearanceCloseBtn.addEventListener("click",closeAppearance);
appearanceDoneBtn.addEventListener("click",closeAppearance);

appearanceBackdrop.addEventListener("click",event=>{
  if(event.target===appearanceBackdrop) closeAppearance();
});

themeSelect.addEventListener("change",()=>{
  setTheme(themeSelect.value);
  updateThemeManageUI();
});

languageSelect.addEventListener("change",()=>{
  state.language=languageSelect.value==="en" ? "en" : "fr";
  applyLanguage();
  updateViewButton();
  updateIconsButton();
  updateStatusIndicators();
  renderServiceEditor();
  renderCategoryEditor();
  renderDashboardEditor();
  renderHostEditor();
  renderWebLinksEditor();
  renderWidgetsEditor();
  patchConfig({language:state.language});
});

// Le bouton est l'unique commande du mode petites icones.
iconsBtn.addEventListener("click",()=>{
  state.smallIcons=!state.smallIcons;
  render();
  updateIconsButton();
  saveViewPrefs({smallIcons:state.smallIcons});
});

openModeSelect.addEventListener("change",()=>setOpenMode(openModeSelect.value));

resetUsageBtn.addEventListener("click",()=>{
  state.usageCounts={};
  render();
  patchConfig({usageCounts:{}});
});

importThemeBtn.addEventListener("click",()=>themeImportInput.click());

themeImportInput.addEventListener("change",async()=>{
  const file=themeImportInput.files?.[0];
  themeImportInput.value="";
  if(!file) return;
  try{
    const theme=await importThemeFile(file);
    themeSelect.value=theme.id;
    applyThemeLabels();
    updateThemeManageUI();
  }catch(error){
    console.error(error);
    alert("Import du thème impossible.");
  }
});

exportThemeBtn.addEventListener("click",()=>{
  const theme=currentTheme();
  if(theme) downloadTheme(theme);
});

deleteThemeBtn.addEventListener("click",async()=>{
  const theme=currentTheme();
  if(!theme || theme.native) return;
  if(!confirm(`Supprimer le thème « ${theme.name||theme.id} » ?`)) return;
  try{
    await deleteCustomTheme(theme.id);
    applyThemeLabels();
    updateThemeManageUI();
  }catch(error){
    console.error(error);
    alert("Suppression du thème impossible.");
  }
});

let renderTimer=null;
searchInput.addEventListener("input",()=>{
  searchInput.closest(".search-box").classList.toggle("has-value",searchInput.value.length>0);
  clearTimeout(renderTimer);
  renderTimer=setTimeout(render,150);
});

document.addEventListener("click",closeTopMenu);

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeTopMenu();
    document.querySelectorAll(".icon-picker.open").forEach(p=>p.classList.remove("open"));
    if(imageLibrary.classList.contains("show")){
      closeImageLibrary();
      return;
    }
    if(appearanceBackdrop.classList.contains("show")){
      closeAppearance();
      return;
    }
    if(modalBackdrop.classList.contains("show")) closeEditor();
    return;
  }

  if(e.key==="/" && state.page==="dashboard" && !isTypingTarget(document.activeElement) && !modalBackdrop.classList.contains("show")){
    e.preventDefault();
    searchInput.focus();
  }
});

async function init(){
  try{
    // Le registre DOIT etre charge avant la config : la normalisation de
    // l'etat et le premier rendu s'appuient sur les schemas de widgets.
    await Promise.all([loadThemes(),loadWidgetRegistry()]);
    await loadConfig();
    setupVisibilityPause();
    startStatusLoop();
  }finally{
    requestAnimationFrame(()=>document.body.classList.add("app-ready"));
  }
}

init();
