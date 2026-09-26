// Point d'entrée : initialisation, menu principal, modals (éditeur/apparence), événements globaux.
import { state, normalizeConfig, isTypingTarget, sanitizeUrl, DEFAULT_BANNER_URL } from "./state.js";
import { patchConfig } from "./api.js";
import { render, updateViewButton, updateOpenModeMenu, updateGroupModeMenu,
  updateSortModeMenu, setGroupMode, getCollapseAllState, updateCollapseAllButton,
  applyBanner, applyFavicon, updateStatusIndicators } from "./render.js";
import { applyLanguage, setThemeLabelsUpdater, setCollapseButtonUpdater, t } from "./i18n.js";
import {
  loadThemes, applyTheme, setTheme, currentTheme, downloadTheme,
  importThemeFile, deleteCustomTheme, applyThemeLabels
} from "./themes.js";
import { startStatusLoop, startHostMetricsLoop, refreshHostMetrics, setupVisibilityPause, manualRefresh } from "./metrics.js";
import { openEditor, closeEditor, renderServiceEditor, renderCategoryEditor,
  renderHostEditor, renderWebLinksEditor } from "./editor.js";
import { closeImageLibrary } from "./images.js";
import { loadWidgetRegistry } from "./widget-registry.js";
import {
  searchInput, viewBtn, collapseAllBtn, moreBtn, topMenu,
  openModeSelect, groupCategoryBtn, groupHostBtn,
  sortAlphabeticalBtn, sortUsageBtn, menuEditBtn, menuAppearanceBtn, menuRefreshBtn,
  appearanceBackdrop, appearanceCloseBtn, appearanceDoneBtn, themeSelect,
  languageSelect, smallIconsSelect, hostsDisplaySelect, resetUsageBtn, importThemeBtn, exportThemeBtn, deleteThemeBtn,
  bannerIconSelect, bannerUrlInput, faviconInput, importFaviconBtn, resetFaviconBtn, faviconEnabledSelect,
  themeImportInput, modalBackdrop, imageLibrary
} from "./dom.js";

setThemeLabelsUpdater(applyThemeLabels);
setCollapseButtonUpdater(updateCollapseAllButton);

async function loadConfig(){
  try{
    const response=await fetch("/api/config",{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);

    const cfg=normalizeConfig(await response.json());
    state.services=cfg.services;
    state.categories=cfg.categories;
    state.hosts=cfg.hosts;
    state.collapsed=cfg.collapsed;
    state.viewMode=cfg.viewMode;
    state.openMode=cfg.openMode;
    state.groupMode=cfg.groupMode;
    state.theme=cfg.theme;
    state.language=cfg.language;
    state.sortMode=cfg.sortMode;
    state.usageCounts=cfg.usageCounts;
    state.webLinks=cfg.webLinks;
    state.webLinksCollapsed=cfg.webLinksCollapsed;
    state.webLinksSeedVersion=cfg.webLinksSeedVersion;
    state.smallIcons=cfg.smallIcons;
    state.hostsDisplay=cfg.hostsDisplay;
    state.bannerIcon=cfg.bannerIcon;
    state.bannerUrl=cfg.bannerUrl;
    state.favicon=cfg.favicon;
    state.faviconEnabled=cfg.faviconEnabled;
  }catch(error){
    console.error("Chargement de config.json impossible",error);
  }

  updateViewButton();
  updateOpenModeMenu();
  updateGroupModeMenu();
  updateSortModeMenu();
  applyTheme();
  applyBanner();
  applyFavicon();
  applyLanguage();
  render();
  startHostMetricsLoop();
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
  patchConfig({openMode:mode},true);
}

function setToolbarHeight(){
  const rect=document.querySelector(".toolbar").getBoundingClientRect();
  document.documentElement.style.setProperty("--toolbar-h",Math.max(0,rect.bottom)+"px");
}

function openAppearance(){
  setToolbarHeight();
  closeTopMenu();
  if([...themeSelect.options].some(option=>option.value===state.theme)){
    themeSelect.value=state.theme;
  }
  languageSelect.value=state.language;
  smallIconsSelect.value=state.smallIcons ? "1" : "0";
  hostsDisplaySelect.value=state.hostsDisplay==="icon" ? "icon" : "name";
  openModeSelect.value=state.openMode==="new" ? "new" : "same";
  bannerIconSelect.value=state.bannerIcon ? "1" : "0";
  bannerUrlInput.value=state.bannerUrl;
  bannerUrlInput.disabled=!state.bannerIcon;
  faviconEnabledSelect.value=state.faviconEnabled!==false ? "1" : "0";
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
  patchConfig({sortMode:"alphabetical"});
  closeTopMenu();
});

sortUsageBtn.addEventListener("click",()=>{
  state.sortMode="usage";
  updateSortModeMenu();
  render();
  patchConfig({sortMode:"usage"});
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
  patchConfig({viewMode:state.viewMode});
});

collapseAllBtn.addEventListener("click",()=>{
  const info=getCollapseAllState();
  if(!info.entries.length) return;

  const shouldCollapse=!info.majorityCollapsed;

  info.entries.forEach(entry=>{
    state.collapsed[entry.key]=shouldCollapse;
    delete state.collapsed[entry.name];
  });

  render();
  patchConfig({collapsed:state.collapsed});
});

menuEditBtn.addEventListener("click",()=>{
  closeTopMenu();
  openEditor();
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
  updateStatusIndicators();
  renderServiceEditor();
  renderCategoryEditor();
  renderHostEditor();
  renderWebLinksEditor();
  patchConfig({language:state.language});
});

smallIconsSelect.addEventListener("change",()=>{
  state.smallIcons=smallIconsSelect.value==="1";
  render();
  patchConfig({smallIcons:state.smallIcons});
});

hostsDisplaySelect.addEventListener("change",()=>{
  state.hostsDisplay=hostsDisplaySelect.value==="icon" ? "icon" : "name";
  refreshHostMetrics();
  patchConfig({hostsDisplay:state.hostsDisplay});
});

openModeSelect.addEventListener("change",()=>setOpenMode(openModeSelect.value));

bannerIconSelect.addEventListener("change",()=>{
  state.bannerIcon=bannerIconSelect.value==="1";
  bannerUrlInput.disabled=!state.bannerIcon;
  applyBanner();
  patchConfig({bannerIcon:state.bannerIcon});
});

const commitBannerUrl=()=>{
  const value=sanitizeUrl(bannerUrlInput.value) || DEFAULT_BANNER_URL;
  state.bannerUrl=value;
  bannerUrlInput.value=value;
  applyBanner();
  patchConfig({bannerUrl:value});
};
bannerUrlInput.addEventListener("change",commitBannerUrl);

importFaviconBtn.addEventListener("click",()=>faviconInput.click());

faviconInput.addEventListener("change",()=>{
  const file=faviconInput.files?.[0];
  faviconInput.value="";
  if(!file) return;
  if(!/\.ico$/i.test(file.name)){
    alert(t("faviconFormatError"));
    return;
  }
  if(file.size>256*1024){
    alert(t("faviconTooLarge"));
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    const result=String(reader.result||"");
    const comma=result.indexOf(",");
    if(comma<0) return;
    state.favicon=`data:image/x-icon;base64,${result.slice(comma+1)}`;
    applyFavicon();
    patchConfig({favicon:state.favicon});
  };
  reader.readAsDataURL(file);
});

resetFaviconBtn.addEventListener("click",()=>{
  state.favicon="";
  applyFavicon();
  patchConfig({favicon:""});
});

faviconEnabledSelect.addEventListener("change",()=>{
  state.faviconEnabled=faviconEnabledSelect.value==="1";
  applyFavicon();
  patchConfig({faviconEnabled:state.faviconEnabled});
});

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

  if(e.key==="/" && !isTypingTarget(document.activeElement) && !modalBackdrop.classList.contains("show")){
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
