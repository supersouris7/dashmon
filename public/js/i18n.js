// fr/en UI translations with injection hooks for dependent modules.
import { state } from "./state.js";
import {
  menuEditBtn, menuSupervisionBtn, menuAppearanceBtn, appearanceTitle, themeFieldLabel,
  languageFieldLabel, usageFieldLabel, resetUsageBtn, appearanceDoneBtn,
  appearanceCloseBtn, searchInput, topMenu, modalBackdrop,
  groupCategoryBtn, groupHostBtn, sortMenuLabel,
  sortAlphabeticalBtn, sortUsageBtn, editorTitle, closeBtn, editorSearch,
  cancelBtn, saveBtn, imageLibraryTitle, widgetConfigTitle, closeImageLibraryBtn,
  menuRefreshBtn, hideWebLinksBtn, restoreWebLinksBtn
} from "./dom.js";

const UI_TEXT={
  fr:{
    editDashboardTitle:"Modifier Dashmon",
    support:"Soutenir",
    tabApplications:"Applications",
    tabCategories:"Catégories",
    tabDashboards:"Dashboards",
    tabHosts:"Hôtes",
    tabWebLinks:"Liens web",
    tabWidgets:"Widgets",
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
    saveError:"Enregistrement impossible. Vérifiez que le fichier de configuration est accessible en écriture.",
    saveNotPersisted:"Suppression non enregistrée : config.json contient encore {names}. Une autre instance ou un autre onglet a peut-être écrasé la modification.",
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
    monitorSoft:"Supervision non importante",
    chooseIcon:"Choisir une icône",
    noHost:"Sans hôte",
    editDashboard:"Modifier Dashmon",
    editTheme:"Modifier le thème",
    menuRefresh:"Rafraîchir les statuts",
    refreshing:"Rafraîchissement des statuts en cours…",
    theme:"Thème",
    language:"Langue",
    dark:"Sombre",
    black:"Noir",
    light:"Clair",
    matrix:"Matrix",
    rainbow:"Arc-en-ciel sombre",
    rainbowLight:"Arc-en-ciel clair",
    close:"Fermer",
    search:"app, catégories, hôtes…",
    collapseAll:"Tout plier",
    expandAll:"Tout déplier",
    sameTab:"Même onglet",
    newTab:"Nouvel onglet",
    openModeFieldLabel:"Ouverture des liens",
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
    dashboardName:"Nom du dashboard",
    addDashboard:"Dashboard",
    newDashboard:"Nouveau dashboard",
    dashboardLabel:"Dashboard",
    categoryDashboard:"Dashboard de la catégorie",
    deleteDashboardConfirm:"Supprimer ce dashboard ? Ses catégories seront rattachées au premier dashboard.",
    colorSwatch:"Couleur",
    hostName:"Nom de l’hôte",
    newHost:"Nouvel hôte",
    imageLibraryTitle:"Images PNG",
    searchEditor:"Rechercher une application...",
    noServices:"Aucun service trouvé.",
    noImages:"Aucune image PNG importée.",
    unnamedService:"Sans nom",
    unnamedLink:"Lien",
    linkCounterLabel:"Compteur du lien",
    linkCounterNone:"Aucun compteur",
    linkCounterGitHub:"GitHub (étoiles)",
    linkCounterDockerHub:"Docker Hub (pulls)",
    linkCounterYoutube:"YouTube (abonnés)",
    linkCounterRepoPlaceholder:"dépôt, ex. proprietaire/nom",
    linkCounterChannelPlaceholder:"chaîne, ex. @pseudo ou URL",
    statusUp:"Disponible",
    statusDown:"Indisponible",
    statusSoftDown:"Indisponible (non critique)",
    statusPending:"Vérification en attente",
    statusNoResponse:"aucune réponse",
    widgetLabel:"Widget",
    widgetConfigTitle:"Configurer le widget",
    widgetStandard:"Standard",
    fortuneHint:"Cliquez pour une autre phrase",
    specialTileHint:"Activez une tuile spéciale du tableau de bord. Une seule peut être active à la fois.",
    specialTileFortune:"Fortune Cookie",
    specialTileCategory:"Catégorie d’affichage",
    passwordConfigured:"mot de passe enregistré",
    widgetConfigSaveLabel:"Valider",
    viewRows:"Affichage en lignes",
    viewColumns:"Affichage en colonnes",
    viewPlain:"Affichage sans catégories",
    nativeThemes:"Thèmes natifs",
    customThemes:"Thèmes personnalisés",
    importTheme:"Importer un thème",
    exportTheme:"Exporter",
    deleteTheme:"Supprimer le thème",
    manageThemes:"Gestion des thèmes",
    webLinksColorLabel:"Couleur des liens web",
    webLinksColorDark:"Gris foncé",
    webLinksColorRed:"Rouge",
    webLinksColorBlue:"Bleu",
    webLinksColorGreen:"Vert",
    webLinksColorOrange:"Orange",
    webLinksColorPurple:"Violet",
    hideWebLinks:"Masquer les liens web",
    restoreWebLinks:"Afficher les liens web",
    smallIconsOptionOff:"Grandes icônes",
    smallIconsOptionOn:"Petites icônes",
    pageSwitch:"Navigation",
    pageDashboard:"Dashboard",
    pageSupervision:"Supervision",
    supervisionTitle:"Supervision",
    supervisionCpu:"Processeur",
    supervisionRam:"Mémoire",
    supervisionDisk:"Disque",
    supervisionTemperature:"Température",
    supervisionEmpty:"Aucun hôte n’est surveillé. Utilisez « Modifier la supervision » dans le menu … pour en ajouter.",
    supervisionLoading:"Mesure des hôtes…",
    supervisionError:"Les mesures ne sont pas disponibles pour l’instant.",
    supervisionUnreachable:"Hôte injoignable",
    supervisionWireguard:"WireGuard",
    supervisionWireguardNoPeer:"Aucun pair",
    supervisionWireguardUpdated:"Dernier relevé {ago}",
    supervisionPeerNever:"jamais",
    supervisionPeerConnected:"connecté",
    supervisionPeerUnnamed:"pair",
    editSupervisionTitle:"Modifier la supervision",
    menuSupervision:"Modifier la supervision",
    tabWireguard:"WireGuard",
    wireguardShowPeers:"Afficher les pairs",
    wireguardHidden:"Pairs masqués",
    wireguardInterface:"Interface",
    phWireguardInterface:"Toutes les interfaces",
    wireguardEditorHint:"Les pairs proviennent du champ wireguard renvoyé par l’agent Linux.",
    wireguardLocalHint:"Hôte local : le fichier data/wireguard.dump (ou WIREGUARD_DUMP_FILE) doit contenir « wg show all dump », mis à jour par un cron ou un timer.",
    wireguardNoHost:"Aucun hôte local ou Agent Linux supervisé. Ajoutez-en un dans l’onglet Hôtes.",
    wireguardHelpIntro:"Le fichier data/wireguard.dump doit être régénéré sur l’hôte. Installez le script et planifiez son exécution : voir le guide d’installation.",
    wireguardHelpScript:"Télécharger wireguard-dump.sh",
    wireguardHelpDoc:"Guide d’installation",
    hostTypeLocal:"Local",
    hostTypeLinux:"Agent Linux",
    hostTypeProxmox:"Proxmox",
    hostMonitoringEnabled:"Supervision activée",
    hostMonitoringDisabled:"Supervision désactivée",
    hostMonitoringType:"Type de supervision",
    hostDiskPath:"Chemin du disque",
    hostLocalHint:"Chemin monté dans le conteneur pour lire le disque de l’hôte (la racine par défaut).",
    proxmoxUrl:"URL Proxmox",
    proxmoxNode:"Nœud Proxmox",
    proxmoxTokenIdEnv:"Identifiant du jeton",
    proxmoxTokenSecretEnv:"Secret du jeton",
    metricsUrl:"URL des mesures",
    bearerTokenEnv:"Jeton (Bearer)",
    tokenEnvHint:"Nom d’une variable d’environnement, ou la valeur elle-même.",
    phProxmoxUrl:"https://proxmox.exemple.lan:8006",
    phProxmoxNode:"pve",
    phMetricsUrl:"http://192.0.2.10:9100/metrics",
    phDiskPath:"/",
    phTokenEnv:"PROXMOX_TOKEN_ID",
  },
  en:{
    editDashboardTitle:"Edit Dashmon",
    support:"Support",
    tabApplications:"Applications",
    tabCategories:"Categories",
    tabDashboards:"Dashboards",
    tabHosts:"Hosts",
    tabWebLinks:"Web links",
    tabWidgets:"Widgets",
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
    saveError:"Save failed. Check that the configuration file is writable.",
    saveNotPersisted:"Deletion not saved: config.json still contains {names}. Another instance or tab may have overwritten the change.",
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
    monitorSoft:"Non-critical monitoring",
    chooseIcon:"Choose an icon",
    noHost:"No host",
    editDashboard:"Edit Dashmon",
    editTheme:"Appearance",
    menuRefresh:"Refresh statuses",
    refreshing:"Refreshing statuses…",
    theme:"Theme",
    language:"Language",
    dark:"Dark",
    black:"Black",
    light:"Light",
    matrix:"Matrix",
    rainbow:"Dark rainbow",
    rainbowLight:"Light rainbow",
    close:"Close",
    search:"app, categories, hosts…",
    collapseAll:"Collapse all",
    expandAll:"Expand all",
    sameTab:"Same tab",
    newTab:"New tab",
    openModeFieldLabel:"Link opening",
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
    dashboardName:"Dashboard name",
    addDashboard:"Dashboard",
    newDashboard:"New dashboard",
    dashboardLabel:"Dashboard",
    categoryDashboard:"Category dashboard",
    deleteDashboardConfirm:"Delete this dashboard? Its categories will be moved to the first dashboard.",
    colorSwatch:"Color",
    hostName:"Host name",
    newHost:"New host",
    imageLibraryTitle:"PNG images",
    searchEditor:"Search an application...",
    noServices:"No services found.",
    noImages:"No PNG images imported.",
    unnamedService:"Unnamed",
    unnamedLink:"Link",
    linkCounterLabel:"Link counter",
    linkCounterNone:"No counter",
    linkCounterGitHub:"GitHub (stars)",
    linkCounterDockerHub:"Docker Hub (pulls)",
    linkCounterYoutube:"YouTube (subscribers)",
    linkCounterRepoPlaceholder:"repository, e.g. owner/name",
    linkCounterChannelPlaceholder:"channel, e.g. @handle or URL",
    statusUp:"Available",
    statusDown:"Unavailable",
    statusSoftDown:"Unavailable (non-critical)",
    statusPending:"Check pending",
    statusNoResponse:"no response",
    widgetLabel:"Widget",
    widgetConfigTitle:"Configure widget",
    widgetStandard:"Standard",
    fortuneHint:"Click for another phrase",
    specialTileHint:"Enable a special dashboard tile. Only one can be active at a time.",
    specialTileFortune:"Fortune Cookie",
    specialTileCategory:"Display category",
    passwordConfigured:"password saved",
    widgetConfigSaveLabel:"Apply",
    viewRows:"Rows view",
    viewColumns:"Columns view",
    viewPlain:"Plain view",
    nativeThemes:"Native themes",
    customThemes:"Custom themes",
    importTheme:"Import theme",
    exportTheme:"Export",
    deleteTheme:"Delete theme",
    manageThemes:"Theme management",
    webLinksColorLabel:"Web links color",
    webLinksColorDark:"Dark gray",
    webLinksColorRed:"Red",
    webLinksColorBlue:"Blue",
    webLinksColorGreen:"Green",
    webLinksColorOrange:"Orange",
    webLinksColorPurple:"Purple",
    hideWebLinks:"Hide web links",
    restoreWebLinks:"Show web links",
    smallIconsOptionOff:"Large icons",
    smallIconsOptionOn:"Small icons",
    pageSwitch:"Navigation",
    pageDashboard:"Dashboard",
    pageSupervision:"Supervision",
    supervisionTitle:"Supervision",
    supervisionCpu:"CPU",
    supervisionRam:"Memory",
    supervisionDisk:"Disk",
    supervisionTemperature:"Temperature",
    supervisionEmpty:"No host is being monitored. Use “Edit supervision” in the … menu to add one.",
    supervisionLoading:"Measuring hosts…",
    supervisionError:"Measurements are not available right now.",
    supervisionUnreachable:"Host unreachable",
    supervisionWireguard:"WireGuard",
    supervisionWireguardNoPeer:"No peer",
    supervisionWireguardUpdated:"Last check {ago}",
    supervisionPeerNever:"never",
    supervisionPeerConnected:"connected",
    supervisionPeerUnnamed:"peer",
    editSupervisionTitle:"Edit supervision",
    menuSupervision:"Edit supervision",
    tabWireguard:"WireGuard",
    wireguardShowPeers:"Show peers",
    wireguardHidden:"Peers hidden",
    wireguardInterface:"Interface",
    phWireguardInterface:"All interfaces",
    wireguardEditorHint:"Peers come from the wireguard field returned by the Linux agent.",
    wireguardLocalHint:"Local host: data/wireguard.dump (or WIREGUARD_DUMP_FILE) must contain “wg show all dump”, refreshed by a cron job or timer.",
    wireguardNoHost:"No monitored local or Linux agent host. Add one in the Hosts tab.",
    wireguardHelpIntro:"data/wireguard.dump must be regenerated on the host. Install the script and schedule its execution: see the installation guide.",
    wireguardHelpScript:"Download wireguard-dump.sh",
    wireguardHelpDoc:"Installation guide",
    hostTypeLocal:"Local",
    hostTypeLinux:"Linux agent",
    hostTypeProxmox:"Proxmox",
    hostMonitoringEnabled:"Monitoring enabled",
    hostMonitoringDisabled:"Monitoring disabled",
    hostMonitoringType:"Monitoring type",
    hostDiskPath:"Disk path",
    hostLocalHint:"Path mounted inside the container to read the host disk (root by default).",
    proxmoxUrl:"Proxmox URL",
    proxmoxNode:"Proxmox node",
    proxmoxTokenIdEnv:"Token ID",
    proxmoxTokenSecretEnv:"Token secret",
    metricsUrl:"Metrics URL",
    bearerTokenEnv:"Bearer token",
    tokenEnvHint:"Name of an environment variable, or the value itself.",
    phProxmoxUrl:"https://proxmox.exemple.lan:8006",
    phProxmoxNode:"pve",
    phMetricsUrl:"http://192.0.2.10:9100/metrics",
    phDiskPath:"/",
    phTokenEnv:"PROXMOX_TOKEN_ID",
  }
};

export function t(key){
  return UI_TEXT[state.language]?.[key] || UI_TEXT.fr[key] || key;
}

export function applyLanguage(){
  document.documentElement.lang=state.language;

  const editLabel=menuEditBtn.querySelector("span:nth-child(2)");
  if(editLabel) editLabel.textContent=t("editDashboard");

  const supervisionLabel=menuSupervisionBtn.querySelector("span:nth-child(2)");
  if(supervisionLabel) supervisionLabel.textContent=t("menuSupervision");

  const appearanceLabel=menuAppearanceBtn.querySelector("span:nth-child(2)");
  if(appearanceLabel) appearanceLabel.textContent=t("editTheme");

  const refreshLabel=menuRefreshBtn.querySelector("span:nth-child(2)");
  if(refreshLabel) refreshLabel.textContent=t("menuRefresh");

  appearanceTitle.textContent=t("editTheme");
  themeFieldLabel.textContent=t("theme");
  languageFieldLabel.textContent=t("language");
  usageFieldLabel.textContent=t("usageLabel");
  resetUsageBtn.querySelector("span").textContent=t("resetUsage");
  appearanceDoneBtn.textContent=t("close");
  appearanceCloseBtn.title=t("close");
  searchInput.placeholder=t("search");
  for(const [button,key] of [[hideWebLinksBtn,"hideWebLinks"],[restoreWebLinksBtn,"restoreWebLinks"]]){
    button.title=t(key);
    button.setAttribute("aria-label",t(key));
  }
  document.getElementById("supportLabel").textContent=t("support");

  const labels=[...topMenu.querySelectorAll(".top-menu-label")];
  if(labels[0]) labels[0].textContent=t("groupBy");

  const menuSpans=[
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

  editorTitle.textContent=t(modalBackdrop.dataset.mode==="supervision" ? "editSupervisionTitle" : "editDashboardTitle");
  closeBtn.title=t("close");
  editorSearch.placeholder=t("searchEditor");

  const editorLabels=[
    ["editorTabApplications","tabApplications"],
    ["editorTabCategories","tabCategories"],
    ["editorTabDashboards","tabDashboards"],
    ["editorTabHosts","tabHosts"],
    ["editorTabWireguard","tabWireguard"],
    ["editorTabWebLinks","tabWebLinks"],
    ["editorTabWidgets","tabWidgets"],
    ["editorTabImages","tabImages"],
    ["addServiceLabel","addApplication"],
    ["addCategoryLabel","addCategory"],
    ["addDashboardLabel","addDashboard"],
    ["addHostLabel","addHost"],
    ["addWebLinkLabel","addWebLink"],
    ["importConfigLabel","importBtn"],
    ["exportConfigLabel","exportBtn"],
    ["uploadPngLabel","importBtn"],
    ["manageUploadLabel","addImages"],
    ["manageDeleteLabel","deleteSelection"],
    ["widgetConfigSaveLabel","widgetConfigSaveLabel"]
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
  widgetConfigTitle.textContent=t("widgetConfigTitle");
  closeImageLibraryBtn.title=t("close");

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
    ["openModeFieldLabel","openModeFieldLabel"],
    ["openModeOptionSame","sameTab"],
    ["openModeOptionNew","newTab"],
    ["webLinksColorLabel","webLinksColorLabel"],
  ];
  appearanceLabels.forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=t(key);
  });

  // Les teintes sont choisies par pastilles : le nom sert d'etiquette, pas de texte.
  ["Dark","Red","Blue","Green","Orange","Purple"].forEach(name=>{
    const el=document.getElementById("webLinksColor"+name);
    if(!el) return;
    const label=t("webLinksColor"+name);
    el.title=label;
    el.setAttribute("aria-label",label);
  });

  const pageSwitch=document.getElementById("pageSwitchGroup");
  if(pageSwitch) pageSwitch.setAttribute("aria-label",t("pageSwitch"));

  if(applyThemeLabels){
    applyThemeLabels();
  }
  if(supervisionUpdater){
    supervisionUpdater();
  }
  if(pageSwitchUpdater){
    pageSwitchUpdater();
  }
}

let applyThemeLabels=null;

export function setThemeLabelsUpdater(fn){
  applyThemeLabels=fn;
}

let supervisionUpdater=null;

export function setSupervisionUpdater(fn){
  supervisionUpdater=fn;
}

let pageSwitchUpdater=null;

export function setPageSwitchUpdater(fn){
  pageSwitchUpdater=fn;
}

let collapseButtonUpdater=null;

export function setCollapseButtonUpdater(fn){
  collapseButtonUpdater=fn;
}
