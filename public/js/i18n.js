// fr/en UI translations with injection hooks for dependent modules.
import { state } from "./state.js";
import {
  menuEditBtn, menuAppearanceBtn, appearanceTitle, themeFieldLabel,
  languageFieldLabel, usageFieldLabel, resetUsageBtn, appearanceDoneBtn,
  appearanceCloseBtn, searchInput, topMenu, sameTabBtn,
  newTabBtn, groupCategoryBtn, groupHostBtn, sortMenuLabel,
  sortAlphabeticalBtn, sortUsageBtn, editorTitle, closeBtn, editorSearch,
  cancelBtn, saveBtn, imageLibraryTitle, closeImageLibraryBtn, webLinksHeader,
  webLinksSection
} from "./dom.js";

const UI_TEXT={
  fr:{
    editDashboardTitle:"Modifier Dashmon",
    support:"Soutenir",
    tabApplications:"Applications",
    tabCategories:"Catégories",
    tabHosts:"Hôtes",
    tabWebLinks:"Liens web",
    tabImages:"Images",
    addImages:"Ajouter des images",
    deleteSelection:"Supprimer la sélection",
    imageSelected:"image sélectionnée",
    imagesSelected:"images sélectionnées",
    imagesLoadError:"Impossible de charger les images.",
    imagesUploadPartial:"{count} image(s) n’ont pas pu être ajoutée(s).",
    imagesUploadFailed:"Import de l’image impossible.",
    imagesFormatError:"Seules les images PNG sont acceptées.",
    pngOnlyHint:"Format PNG uniquement",
    confirmDeleteImages:"Supprimer {count} image(s) ?",
    imagesDeletePartial:"{count} image(s) n’ont pas pu être supprimée(s).",
    importBtn:"Importer",
    exportBtn:"Exporter",
    cancelBtn:"Annuler",
    saveBtn:"Enregistrer",
    addApplication:"Application",
    addCategory:"Catégorie",
    addHost:"Hôte",
    addWebLink:"Lien web",
    nameLabel:"Nom",
    hostLabel:"Hôte",
    categoryLabel:"Catégorie",
    urlLabel:"URL",
    iconLabel:"Icône",
    monitoringLabel:"Supervision",
    deleteLabel:"Supprimer",
    monitorEnabled:"Supervision activée",
    monitorDisabled:"Supervision désactivée",
    chooseIcon:"Choisir une icône",
    noHost:"Sans hôte",
    editDashboard:"Modifier Dashmon",
    editTheme:"Modifier le thème",
    theme:"Thème",
    language:"Langue",
    dark:"Sombre",
    black:"Noir",
    light:"Clair",
    matrix:"Matrix",
    rainbow:"Arc-en-ciel sombre",
    rainbowLight:"Arc-en-ciel clair",
    close:"Fermer",
    search:"Rechercher une application...",
    collapseAll:"Tout plier",
    expandAll:"Tout déplier",
    focusHost:"Afficher uniquement cet hôte",
    sameTab:"Même onglet",
    newTab:"Nouvel onglet",
    groupBy:"Regrouper par",
    category:"Catégorie",
    host:"Hôte",
    opening:"Ouverture des liens",
    sort:"Tri",
    alphabetical:"Alphabétique",
    usage:"Par utilisation",
    usageLabel:"Compteurs d’utilisation",
    resetUsage:"Réinitialiser",
    allCategories:"Toutes les catégories",
    allHosts:"Tous les hôtes",
    choosePng:"Choisir ou importer une image PNG",
    move:"Déplacer",
    categoryName:"Nom de catégorie",
    hostName:"Nom de l’hôte",
    noParameters:"Aucun",
    noAuthentication:"Aucune",
    newHost:"Nouvel hôte",
    hostMonitoringEnabled:"Supervision CPU/RAM activée",
    hostMonitoringDisabled:"Supervision CPU/RAM désactivée",
    hostMonitoringType:"Type de supervision",
    hostTypeLocal:"Local",
    hostTypeLinux:"Linux",
    hostTypeProxmox:"Proxmox",
    proxmoxUrl:"URL Proxmox (ex. https://proxmox.lan:8006)",
    metricsUrl:"URL métriques Linux JSON (ex. http://linux.local/metrics)",
    bearerTokenEnv:"Variable du token Bearer (facultatif)",
    proxmoxTokenIdEnv:"Token ID : collez la valeur ou le nom d'env (défaut PROXMOX_TOKEN_ID)",
    proxmoxTokenSecretEnv:"Token secret : collez la valeur ou le nom d'env (défaut PROXMOX_TOKEN_SECRET)",
    imageLibraryTitle:"Images PNG",
    searchEditor:"Rechercher une application...",
    noServices:"Aucun service trouvé.",
    noImages:"Aucune image PNG importée.",
    unnamedService:"Sans nom",
    unnamedLink:"Lien",
    statusUp:"Disponible",
    statusDown:"Indisponible",
    statusPending:"Vérification en attente",
    statusNoResponse:"aucune réponse",
    viewRows:"Affichage en lignes",
    viewColumns:"Affichage en colonnes",
    viewPlain:"Affichage sans catégories",
    collapseWebLinks:"Replier les liens",
    expandWebLinks:"Déplier les liens",
    nativeThemes:"Thèmes natifs",
    customThemes:"Thèmes personnalisés",
    importTheme:"Importer un thème",
    exportTheme:"Exporter",
    deleteTheme:"Supprimer le thème",
    manageThemes:"Gestion des thèmes",
    smallIconsFieldLabel:"Mode petites icônes",
    smallIconsOptionOff:"Grandes icônes",
    smallIconsOptionOn:"Petites icônes",
    hostsDisplayFieldLabel:"Affichage des hôtes",
    hostsDisplayOptionName:"Par intitulé",
    hostsDisplayOptionIcon:"Par icône",
    bannerFieldLabel:"Icône bannière",
    bannerOptionOn:"Activée",
    bannerOptionOff:"Désactivée",
    bannerUrlFieldLabel:"URL de la bannière",
    faviconFieldLabel:"Favicon (.ico)",
    importFaviconLabel:"Importer",
    resetFaviconLabel:"Réinitialiser",
    faviconFormatError:"Seuls les fichiers .ico sont acceptés.",
    faviconTooLarge:"Favicon trop volumineux (max 256 Ko).",
  },
  en:{
    editDashboardTitle:"Edit Dashmon",
    support:"Support",
    tabApplications:"Applications",
    tabCategories:"Categories",
    tabHosts:"Hosts",
    tabWebLinks:"Web links",
    tabImages:"Images",
    addImages:"Add images",
    deleteSelection:"Delete selection",
    imageSelected:"image selected",
    imagesSelected:"images selected",
    imagesLoadError:"Unable to load images.",
    imagesUploadPartial:"{count} image(s) could not be added.",
    imagesUploadFailed:"Image import failed.",
    imagesFormatError:"Only PNG images are accepted.",
    pngOnlyHint:"PNG only",
    confirmDeleteImages:"Delete {count} image(s)?",
    imagesDeletePartial:"{count} image(s) could not be deleted.",
    importBtn:"Import",
    exportBtn:"Export",
    cancelBtn:"Cancel",
    saveBtn:"Save",
    addApplication:"Application",
    addCategory:"Category",
    addHost:"Host",
    addWebLink:"Web link",
    nameLabel:"Name",
    hostLabel:"Host",
    categoryLabel:"Category",
    urlLabel:"URL",
    iconLabel:"Icon",
    monitoringLabel:"Monitoring",
    deleteLabel:"Delete",
    monitorEnabled:"Monitoring enabled",
    monitorDisabled:"Monitoring disabled",
    chooseIcon:"Choose an icon",
    noHost:"No host",
    editDashboard:"Edit Dashmon",
    editTheme:"Appearance",
    theme:"Theme",
    language:"Language",
    dark:"Dark",
    black:"Black",
    light:"Light",
    matrix:"Matrix",
    rainbow:"Dark rainbow",
    rainbowLight:"Light rainbow",
    close:"Close",
    search:"Search an application...",
    collapseAll:"Collapse all",
    expandAll:"Expand all",
    focusHost:"Show only this host",
    sameTab:"Same tab",
    newTab:"New tab",
    groupBy:"Group by",
    category:"Category",
    host:"Host",
    opening:"Link opening",
    sort:"Sort",
    alphabetical:"Alphabetical",
    usage:"By usage",
    usageLabel:"Usage counters",
    resetUsage:"Reset",
    allCategories:"All categories",
    allHosts:"All hosts",
    choosePng:"Choose or upload a PNG image",
    move:"Move",
    categoryName:"Category name",
    hostName:"Host name",
    noParameters:"None",
    noAuthentication:"None",
    newHost:"New host",
    hostMonitoringEnabled:"CPU/RAM monitoring enabled",
    hostMonitoringDisabled:"CPU/RAM monitoring disabled",
    hostMonitoringType:"Monitoring type",
    hostTypeLocal:"Local",
    hostTypeLinux:"Linux",
    hostTypeProxmox:"Proxmox",
    proxmoxUrl:"Proxmox URL (e.g. https://proxmox.lan:8006)",
    metricsUrl:"Linux JSON metrics URL (e.g. http://linux.local/metrics)",
    bearerTokenEnv:"Bearer token environment variable (optional)",
    proxmoxTokenIdEnv:"Token ID: paste the value or env. var name (default PROXMOX_TOKEN_ID)",
    proxmoxTokenSecretEnv:"Token secret: paste the value or env. var name (default PROXMOX_TOKEN_SECRET)",
    imageLibraryTitle:"PNG images",
    searchEditor:"Search an application...",
    noServices:"No services found.",
    noImages:"No PNG images imported.",
    unnamedService:"Unnamed",
    unnamedLink:"Link",
    statusUp:"Available",
    statusDown:"Unavailable",
    statusPending:"Check pending",
    statusNoResponse:"no response",
    viewRows:"Rows view",
    viewColumns:"Columns view",
    viewPlain:"Plain view",
    collapseWebLinks:"Collapse web links",
    expandWebLinks:"Expand web links",
    nativeThemes:"Native themes",
    customThemes:"Custom themes",
    importTheme:"Import theme",
    exportTheme:"Export",
    deleteTheme:"Delete theme",
    manageThemes:"Theme management",
    smallIconsFieldLabel:"Small icon mode",
    smallIconsOptionOff:"Large icons",
    smallIconsOptionOn:"Small icons",
    hostsDisplayFieldLabel:"Hosts display",
    hostsDisplayOptionName:"By name",
    hostsDisplayOptionIcon:"By icon",
    bannerFieldLabel:"Banner icon",
    bannerOptionOn:"Enabled",
    bannerOptionOff:"Disabled",
    bannerUrlFieldLabel:"Banner URL",
    faviconFieldLabel:"Favicon (.ico)",
    importFaviconLabel:"Import",
    resetFaviconLabel:"Reset",
    faviconFormatError:"Only .ico files are accepted.",
    faviconTooLarge:"Favicon too large (max 256 KB).",
  }
};

export function t(key){
  return UI_TEXT[state.language]?.[key] || UI_TEXT.fr[key] || key;
}

export function applyLanguage(){
  document.documentElement.lang=state.language;

  const editLabel=menuEditBtn.querySelector("span:nth-child(2)");
  if(editLabel) editLabel.textContent=t("editDashboard");

  const appearanceLabel=menuAppearanceBtn.querySelector("span:nth-child(2)");
  if(appearanceLabel) appearanceLabel.textContent=t("editTheme");

  appearanceTitle.textContent=t("editTheme");
  themeFieldLabel.textContent=t("theme");
  languageFieldLabel.textContent=t("language");
  usageFieldLabel.textContent=t("usageLabel");
  resetUsageBtn.querySelector("span").textContent=t("resetUsage");
  appearanceDoneBtn.textContent=t("close");
  appearanceCloseBtn.title=t("close");
  searchInput.placeholder=t("search");
  document.getElementById("supportLabel").textContent=t("support");

  const labels=[...topMenu.querySelectorAll(".top-menu-label")];
  if(labels[0]) labels[0].textContent=t("opening");
  if(labels[1]) labels[1].textContent=t("groupBy");

  const menuSpans=[
    [sameTabBtn,"sameTab"],
    [newTabBtn,"newTab"],
    [groupCategoryBtn,"category"],
    [groupHostBtn,"host"],
    [sortAlphabeticalBtn,"alphabetical"],
    [sortUsageBtn,"usage"]
  ];
  menuSpans.forEach(([btn,key])=>{
    const span=btn.querySelector("span");
    if(span) span.textContent=t(key);
  });

  sortMenuLabel.textContent=t("sort");

  if(collapseButtonUpdater){
    collapseButtonUpdater();
  }

  editorTitle.textContent=t("editDashboardTitle");
  closeBtn.title=t("close");
  editorSearch.placeholder=t("searchEditor");

  const editorLabels=[
    ["editorTabApplications","tabApplications"],
    ["editorTabCategories","tabCategories"],
    ["editorTabHosts","tabHosts"],
    ["editorTabWebLinks","tabWebLinks"],
    ["editorTabImages","tabImages"],
    ["addServiceLabel","addApplication"],
    ["addCategoryLabel","addCategory"],
    ["addHostLabel","addHost"],
    ["addWebLinkLabel","addWebLink"],
    ["importConfigLabel","importBtn"],
    ["exportConfigLabel","exportBtn"],
    ["uploadPngLabel","importBtn"],
    ["manageUploadLabel","addImages"],
    ["manageDeleteLabel","deleteSelection"]
  ];
  editorLabels.forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=t(key);
  });

  document.getElementById("manageUploadHint").textContent=t("pngOnlyHint");
  document.getElementById("uploadPngHint").textContent=t("pngOnlyHint");

  cancelBtn.textContent=t("cancelBtn");
  saveBtn.textContent=t("saveBtn");
  imageLibraryTitle.textContent=t("imageLibraryTitle");
  closeImageLibraryBtn.title=t("close");

  const webLinksToggleText=state.webLinksCollapsed ? t("expandWebLinks") : t("collapseWebLinks");
  webLinksHeader.title=webLinksToggleText;
  webLinksHeader.setAttribute("aria-label",webLinksToggleText);

  const manageLabels=[
    ["themeManageLabel","manageThemes"],
    ["importThemeBtnLabel","importBtn"],
    ["exportThemeBtnLabel","exportBtn"],
    ["deleteThemeBtnLabel","deleteLabel"]
  ];
  manageLabels.forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=t(key);
  });

  const appearanceLabels=[
    ["smallIconsFieldLabel","smallIconsFieldLabel"],
    ["smallIconsOptionOff","smallIconsOptionOff"],
    ["smallIconsOptionOn","smallIconsOptionOn"],
    ["hostsDisplayFieldLabel","hostsDisplayFieldLabel"],
    ["hostsDisplayOptionName","hostsDisplayOptionName"],
    ["hostsDisplayOptionIcon","hostsDisplayOptionIcon"],
    ["bannerFieldLabel","bannerFieldLabel"],
    ["bannerOptionOn","bannerOptionOn"],
    ["bannerOptionOff","bannerOptionOff"],
    ["bannerUrlFieldLabel","bannerUrlFieldLabel"],
    ["faviconFieldLabel","faviconFieldLabel"],
    ["importFaviconLabel","importFaviconLabel"],
    ["resetFaviconLabel","resetFaviconLabel"]
  ];
  appearanceLabels.forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=t(key);
  });

  if(applyThemeLabels){
    applyThemeLabels();
  }
}

let applyThemeLabels=null;

export function setThemeLabelsUpdater(fn){
  applyThemeLabels=fn;
}

let collapseButtonUpdater=null;

export function setCollapseButtonUpdater(fn){
  collapseButtonUpdater=fn;
}
