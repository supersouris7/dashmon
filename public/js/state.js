// État global partagé, valeurs par défaut et normalisation de la configuration.
// Importe le registre des widgets : la config d'un widget est deduite du
// manifest publie par le serveur, plus d'une liste de champs ecrite ici.
import { normalizeWidgetConfig } from "./widget-registry.js";
import { formatCompactCount } from "./format.js";

export const DEFAULT_CATEGORIES = [
  {name:"Infrastructure",icon:"fa-solid fa-server"},
  {name:"Applications",icon:"fa-solid fa-cubes"},
  {name:"Administration",icon:"fa-solid fa-gear"}
];

// Un dashboard est un onglet nomme du tableau de bord. Chaque categorie est
// rattachee a un seul dashboard (dashboardId obligatoire) : c'est ce lien qui
// decide quelles sections apparaissent sur quel onglet. L'identifiant "main"
// est reserve au dashboard par defaut pour que la migration des configurations
// existantes soit stable.
export const DEFAULT_DASHBOARDS = [
  {id:"main", name:"Dashboard", icon:"fa-solid fa-grip"}
];

// Identifiant reserve : "supervision" est une page a part, jamais un dashboard.
export const RESERVED_DASHBOARD_IDS = Object.freeze(["supervision"]);

export const ICON_OPTIONS=[
  "fa-solid fa-folder",
  "fa-solid fa-folder-tree",
  "fa-solid fa-cubes",
  "fa-solid fa-cubes-stacked",
  "fa-solid fa-table-cells-large",
  "fa-solid fa-layer-group",
  "fa-solid fa-boxes-stacked",
  "fa-solid fa-boxes-packing",
  "fa-solid fa-gamepad",
  "fa-solid fa-house",
  "fa-solid fa-house-signal",
  "fa-solid fa-house-laptop",
  "fa-solid fa-lightbulb",
  "fa-solid fa-plug",
  "fa-solid fa-power-off",
  "fa-solid fa-bolt",
  "fa-solid fa-battery-full",
  "fa-solid fa-battery-three-quarters",
  "fa-solid fa-battery-half",
  "fa-solid fa-battery-quarter",
  "fa-solid fa-battery-empty",
  "fa-solid fa-gauge-high",
  "fa-solid fa-chart-line",
  "fa-solid fa-chart-column",
  "fa-solid fa-chart-pie",
  "fa-solid fa-area-chart",
  "fa-solid fa-eye",
  "fa-solid fa-bell",
  "fa-solid fa-shield-halved",
  "fa-solid fa-shield",
  "fa-solid fa-lock",
  "fa-solid fa-lock-open",
  "fa-solid fa-key",
  "fa-solid fa-screwdriver-wrench",
  "fa-solid fa-gear",
  "fa-solid fa-gears",
  "fa-solid fa-wrench",
  "fa-solid fa-hammer",
  "fa-solid fa-terminal",
  "fa-solid fa-code",
  "fa-solid fa-code-branch",
  "fa-solid fa-code-fork",
  "fa-solid fa-code-merge",
  "fa-solid fa-bug",
  "fa-solid fa-database",
  "fa-solid fa-hard-drive",
  "fa-solid fa-hard-drive",
  "fa-solid fa-server",
  "fa-solid fa-cloud",
  "fa-solid fa-cloud-arrow-up",
  "fa-solid fa-cloud-arrow-down",
  "fa-solid fa-cloud-upload-alt",
  "fa-solid fa-cloud-download-alt",
  "fa-solid fa-network-wired",
  "fa-solid fa-wifi",
  "fa-solid fa-globe",
  "fa-solid fa-link",
  "fa-solid fa-diagram-project",
  "fa-solid fa-share-nodes",
  "fa-solid fa-ethernet",
  "fa-solid fa-tower-broadcast",
  "fa-solid fa-satellite-dish",
  "fa-solid fa-rss",
  "fa-solid fa-film",
  "fa-solid fa-photo-film",
  "fa-solid fa-closed-captioning",
  "fa-solid fa-music",
  "fa-solid fa-tv",
  "fa-solid fa-video",
  "fa-solid fa-camera",
  "fa-solid fa-image",
  "fa-solid fa-book",
  "fa-solid fa-book-open",
  "fa-solid fa-file",
  "fa-solid fa-file-lines",
  "fa-solid fa-file-arrow-down",
  "fa-solid fa-file-arrow-up",
  "fa-solid fa-file-export",
  "fa-solid fa-download",
  "fa-solid fa-upload",
  "fa-solid fa-box-archive",
  "fa-solid fa-magnifying-glass",
  "fa-solid fa-user-shield",
  "fa-solid fa-users",
  "fa-solid fa-user",
  "fa-solid fa-user-gear",
  "fa-solid fa-user-lock",
  "fa-solid fa-calendar",
  "fa-solid fa-clipboard",
  "fa-solid fa-clipboard-check",
  "fa-solid fa-clipboard-list",
  "fa-solid fa-list-check",
  "fa-solid fa-clock",
  "fa-solid fa-stopwatch",
  "fa-solid fa-hourglass-half",
  "fa-solid fa-microchip",
  "fa-solid fa-computer",
  "fa-solid fa-desktop",
  "fa-solid fa-laptop",
  "fa-solid fa-laptop-code",
  "fa-solid fa-mobile-screen",
  "fa-solid fa-tablet-screen-button",
  "fa-solid fa-tablet",
  "fa-solid fa-memory",
  "fa-solid fa-print",
  "fa-solid fa-fax",
  "fa-solid fa-print",
  "fa-solid fa-floppy-disk",
  "fa-solid fa-object-group",
  "fa-solid fa-object-ungroup",
  "fa-solid fa-box",
  "fa-solid fa-box-open",
  "fa-solid fa-cube",
  "fa-solid fa-truck",
  "fa-solid fa-truck-fast",
  "fa-solid fa-warehouse",
  "fa-solid fa-store",
  "fa-solid fa-industry",
  "fa-solid fa-industry",
  "fa-solid fa-building",
  "fa-solid fa-city",
  "fa-solid fa-hospital",
  "fa-solid fa-location-dot",
  "fa-solid fa-map",
  "fa-solid fa-map-location-dot",
  "fa-solid fa-compass",
  "fa-solid fa-route",
  "fa-solid fa-anchor",
  "fa-solid fa-ship",
  "fa-solid fa-plane",
  "fa-solid fa-train",
  "fa-solid fa-bus",
  "fa-solid fa-car",
  "fa-solid fa-helicopter",
  "fa-solid fa-robot",
  "fa-solid fa-atom",
  "fa-solid fa-flask",
  "fa-solid fa-microscope",
  "fa-solid fa-tree",
  "fa-solid fa-leaf",
  "fa-solid fa-seedling",
  "fa-solid fa-snowflake",
  "fa-solid fa-fan",
  "fa-solid fa-wind",
  "fa-solid fa-sun",
  "fa-solid fa-moon",
  "fa-solid fa-temperature-half",
  "fa-solid fa-fire",
  "fa-solid fa-droplet",
  "fa-solid fa-tint",
  "fa-solid fa-water",
  "fa-solid fa-solar-panel",
  "fa-solid fa-trophy",
  "fa-solid fa-medal",
  "fa-solid fa-award",
  "fa-solid fa-gem",
  "fa-solid fa-star",
  "fa-solid fa-star-half-stroke",
  "fa-solid fa-heart",
  "fa-solid fa-thumbs-up",
  "fa-solid fa-thumbs-down",
  "fa-solid fa-credit-card",
  "fa-solid fa-money-bill",
  "fa-solid fa-coins",
  "fa-solid fa-cart-shopping",
  "fa-solid fa-bag-shopping",
  "fa-solid fa-tag",
  "fa-solid fa-tags",
  "fa-solid fa-barcode",
  "fa-solid fa-qrcode",
  "fa-solid fa-keyboard",
  "fa-solid fa-mouse",
  "fa-solid fa-headphones",
  "fa-solid fa-headset",
  "fa-solid fa-microphone",
  "fa-solid fa-phone",
  "fa-solid fa-envelope",
  "fa-solid fa-envelope-open",
  "fa-solid fa-paper-plane",
  "fa-solid fa-comments",
  "fa-solid fa-comment-dots",
  "fa-solid fa-message",
  "fa-solid fa-bell-slash",
  "fa-solid fa-arrow-rotate-right",
  "fa-solid fa-clock-rotate-left",
  "fa-solid fa-history",
  "fa-solid fa-wand-magic-sparkles",
  "fa-solid fa-pen",
  "fa-solid fa-pen-nib",
  "fa-solid fa-paintbrush",
  "fa-solid fa-palette",
  "fa-regular fa-sun",
  "fa-regular fa-moon",
  "fa-brands fa-raspberry-pi",
  "fa-brands fa-docker",
  "fa-brands fa-dharmachakra",
  "fa-brands fa-aws",
  "fa-brands fa-google",
  "fa-brands fa-google-drive",
  "fa-brands fa-microsoft",
  "fa-brands fa-windows",
  "fa-brands fa-linux",
  "fa-brands fa-ubuntu",
  "fa-brands fa-debian",
  "fa-brands fa-centos",
  "fa-brands fa-redhat",
  "fa-brands fa-fedora",
  "fa-brands fa-react",
  "fa-brands fa-vuejs",
  "fa-brands fa-angular",
  "fa-brands fa-java",
  "fa-brands fa-python",
  "fa-brands fa-node-js",
  "fa-brands fa-php",
  "fa-brands fa-golang",
  "fa-brands fa-html5",
  "fa-brands fa-css3-alt",
  "fa-brands fa-js",
  "fa-brands fa-npm",
  "fa-brands fa-yarn",
  "fa-brands fa-git",
  "fa-brands fa-github",
  "fa-brands fa-gitlab",
  "fa-brands fa-bitbucket",
  "fa-brands fa-stack-overflow",
  "fa-brands fa-codepen",
  "fa-brands fa-figma",
  "fa-brands fa-bootstrap",
  "fa-solid fa-wind",
  "fa-brands fa-wordpress",
  "fa-brands fa-joomla",
  "fa-brands fa-drupal",
  "fa-brands fa-magento",
  "fa-brands fa-discord",
  "fa-brands fa-slack",
  "fa-brands fa-telegram",
  "fa-brands fa-whatsapp",
  "fa-brands fa-signal-messenger",
  "fa-brands fa-youtube",
  "fa-brands fa-twitch",
  "fa-brands fa-twitter",
  "fa-brands fa-x-twitter",
  "fa-brands fa-facebook-f",
  "fa-brands fa-instagram",
  "fa-brands fa-tiktok",
  "fa-brands fa-linkedin-in",
  "fa-brands fa-reddit-alien",
  "fa-brands fa-mastodon",
  "fa-brands fa-pinterest-p",
  "fa-brands fa-snapchat",
  "fa-brands fa-threads",
  "fa-brands fa-bluesky",
  "fa-brands fa-dropbox",
  "fa-brands fa-cloudflare",
  "fa-brands fa-digital-ocean",
  "fa-solid fa-video",
  "fa-brands fa-android",
  "fa-brands fa-apple",
  "fa-brands fa-chrome",
  "fa-brands fa-firefox",
  "fa-brands fa-edge",
  "fa-brands fa-safari",
  "fa-brands fa-opera",
  "fa-brands fa-spotify"
];

// Pas d'hôte ni de service d'exemple : la configuration est celle de
// l'utilisateur, adaptable à tout environnement (vide à la première install).
export const DEFAULT_HOSTS=[];
export const DEFAULT_SERVICES = [];

export const DEFAULT_WEB_LINKS=[
  {"name":"YouTube","url":"https://www.youtube.com","icon":"fa-brands fa-youtube"},
  {"name":"Outlook","url":"https://outlook.office.com","icon":"fa-solid fa-envelope"},
  {"name":"Google Drive","url":"https://drive.google.com","icon":"fa-brands fa-google-drive"},
  {"name":"GitHub","url":"https://github.com","icon":"fa-brands fa-github"}
];

// Libellé stable (indépendant de la langue) pour le groupe des services sans
// hôte : les clefs collapsed reposent dessus. Affiché via t("noHost").
export const FALLBACK_HOST="Sans hôte";

export const WEB_LINK_COLORS=Object.freeze({
  dark:"#272c33",
  red:"#d63b3b",
  blue:"#1868e0",
  green:"#0b8337",
  orange:"#b35a05",
  purple:"#7a3fc9"
});

export function normalizeWebLinksColor(value){
  if(value==="pastel-red") return "red";
  return Object.hasOwn(WEB_LINK_COLORS,value) ? value : "dark";
}

// Le texte du bandeau est toujours blanc : les teintes ci-dessus sont choisies
// assez soutenues pour rester lisibles dessus.
export function webLinksColors(value){
  return {background:WEB_LINK_COLORS[normalizeWebLinksColor(value)],foreground:"#ffffff"};
}

export const state = {
  services: [],
  categories: [],
  dashboards: [],
  hosts: [],
  replication: {role:"primary",instanceName:"Dashmon",secondaries:[]},
  collapsed: {},
  supervisionSmartExpanded: [],
  supervisionHostExpanded: [],
  supervisionAptExpanded: [],
  viewMode: "columns",
  page: "dashboard",
  dashboardId: "main",
  supervisionInstanceId: "local",
  openMode: "same",
  groupMode: "category",
  theme: "dark",
  language: "en",
  sortMode: "alphabetical",
  usageCounts: {},
  webLinks: [],
  webLinksColor: "dark",
  webLinksHidden: false,
  webLinksSeedVersion: 0,
  smallIcons: false,
  editServices: [],
  editCategories: [],
  editDashboards: [],
  editHosts: [],
  editWebLinks: [],
  specialTile: null,
  editSpecialTile: null,
  serviceStatus: {},
  statusTimer: null,
  // Dernier releve de supervision des hotes (voir server.js /api/host-metrics)
  // et son minuteur de rafraichissement, actif seulement sur la page dediee.
  hostMetrics: null,
  hostMetricsError: false,
  hostMetricsTimer: null,
  themes: { native: [], custom: [] }
};

export function clone(value){
  return typeof structuredClone==="function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function normalize(v){
  return (v||"").toString().trim().toLowerCase();
}

export function compareNames(a,b){
  return (a||"").localeCompare(b||"","fr",{sensitivity:"base"});
}

export function isTypingTarget(target){
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
}

function sanitizeText(value, max = 100) {
  return String(value || "").trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F<>]/g, "")
    .slice(0, max);
}

export function sanitizeUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return "";
}

const ICON_SAFE_RE = /^[a-z0-9][a-z0-9-]*( [a-z0-9][a-z0-9-]*)*$/;

export function sanitizeIconClass(icon) {
  const s = String(icon || "").trim().toLowerCase();
  if (ICON_SAFE_RE.test(s) && s.length <= 80) return s;
  return "fa-solid fa-folder";
}

// Palette de couleurs de tuile. Dix teintes espacees dans le cercle
// chromatique : deux categories voisines n'ont pas deux teintes voisins, ce
// qui rend la lecture d'un tableau de bord immediate. La premiere entree,
// vide, signifie "pas de couleur" — une categorie sans couleur reste sur le
// fond du theme, comme aujourd'hui.
export const TILE_COLORS = [
  "",
  "#7eaaee",
  "#06d6a0",
  "#ffd166",
  "#ef476f",
  "#a78bfa",
  "#f78c6b",
  "#06b6d4",
  "#c3e88d",
  "#ff6b9d",
  "#94a3b8"
];

const COLOR_RE = /^#[0-9a-f]{6}$/;

// Meme regle que le serveur : la valeur finit dans un attribut style, donc
// seules les 6 positions hexadecimales passent. On refuse "#abc" pour que la
// palette affichee et la valeur enregistree aient toujours la meme forme.
export function sanitizeTileColor(value) {
  const s = String(value == null ? "" : value).trim().toLowerCase();
  return COLOR_RE.test(s) ? s : "";
}

// Toute categorie et tout hote porte une couleur, meme si l'utilisateur n'a
// rien choisi : une tuile sans couleur se confondait avec une section non
// configuree. L'affectation se fait ici, a la normalisation, et non dans
// l'editeur — sinon le liseret resterait absent tant que l'on n'aurait pas
// ouvert les reglages, et la valeur risquerait de ne jamais etre enregistree.
//
// On prend la premiere teinte libre, dans l'ordre. La palette epuisee (plus de
// dix elements colores), on reboucle sur les deja utilisees : mieux vaut une
// couleur partagee qu'une section sans couleur du tout.
export function assignTileColors(items, used) {
  const taken = used instanceof Set ? used : new Set(used || []);
  for (const item of Array.isArray(items) ? items : []) {
    const current = sanitizeTileColor(item && item.color);
    if (current && !taken.has(current)) {
      item.color = current;
      taken.add(current);
      continue;
    }
    // Soit aucune couleur, soit une couleur deja attribuee ailleurs : on
    // cherche la prochaine libre.
    const free = TILE_COLORS.filter(color => color && !taken.has(color))[0];
    const assigned = free || TILE_COLORS.find(color => color) || "";
    if (item) item.color = assigned;
    if (assigned) taken.add(assigned);
  }
  return taken;
}

function sanitizeImagePath(p) {
  const s = String(p || "").trim();
  const m = s.match(/^icons\/([a-zA-Z0-9._-]+)\.png$/);
  return m ? `icons/${m[1]}.png` : "";
}

function normalizeCollapsed(collapsed){
  if(!collapsed || typeof collapsed!=="object" || Array.isArray(collapsed)) return {};
  const out={...collapsed};
  // Nettoyage legacy : les clefs sans préfixe (category:X, host:X tels quels)
  // sont dupliquées par les clefs préfixées qui priment ; on les retire.
  for(const key of Object.keys(out)){
    if(!key.startsWith("category:") && !key.startsWith("host:")){
      if(out[`category:${key}`]!==undefined || out[`host:${key}`]!==undefined){
        delete out[key];
      }
    }
  }
  return out;
}

// Préférences d'affichage : elles décrivent la façon dont CET écran regarde le
// tableau de bord, pas la configuration elle-même. Elles sont donc stockées
// côté navigateur (voir view-prefs.js) et normalisées ici, avec exactement les
// mêmes règles que la config serveur, pour qu'une valeur briculée dans le
// navigateur ne puisse pas casser le rendu.
export const VIEW_PREF_KEYS=Object.freeze([
  "viewMode","sortMode","groupMode","openMode",
  "smallIcons","collapsed","webLinksHidden","page","dashboardId","supervisionInstanceId",
  "supervisionSmartExpanded","supervisionHostExpanded","supervisionAptExpanded"
]);

// Les tuiles depliees sont stockees comme une liste de cles (instance + hote),
// jamais comme une structure libre : un stockage bricole ne peut donc pas
// injecter de HTML ou faire grossir le fichier sans limite.
function normalizeExpandedKeys(value){
  if(!Array.isArray(value)) return [];
  const out=[];
  for(const item of value){
    if(typeof item!=="string") continue;
    const key=item.trim().slice(0,200);
    if(!key || out.includes(key)) continue;
    out.push(key);
    if(out.length>=200) break;
  }
  return out;
}

export function normalizeViewPrefs(cfg={}){
  return {
    viewMode:["rows","columns","plain"].includes(cfg.viewMode) ? cfg.viewMode : "columns",
    openMode:cfg.openMode==="new" ? "new" : "same",
    groupMode:cfg.groupMode==="host" ? "host" : "category",
    sortMode:cfg.sortMode==="usage" ? "usage" : "alphabetical",
    page:cfg.page==="supervision" ? "supervision" : "dashboard",
    // Dashboard actif : la valeur est validee plus tard contre la liste des
    // dashboards de la config (ici on ne connait que la preference brute).
    dashboardId:typeof cfg.dashboardId==="string" && cfg.dashboardId.trim() ? cfg.dashboardId.trim().slice(0,64) : "",
    supervisionInstanceId:typeof cfg.supervisionInstanceId==="string" && cfg.supervisionInstanceId.trim()
      ? cfg.supervisionInstanceId.trim().slice(0,200) : "local",
    smallIcons:cfg.smallIcons===true,
    webLinksHidden:cfg.webLinksHidden===true,
    collapsed:normalizeCollapsed(cfg.collapsed),
    supervisionSmartExpanded:normalizeExpandedKeys(cfg.supervisionSmartExpanded),
    supervisionHostExpanded:normalizeExpandedKeys(cfg.supervisionHostExpanded),
    supervisionAptExpanded:normalizeExpandedKeys(cfg.supervisionAptExpanded)
  };
}

// Tuiles speciales du tableau de bord : une seule peut etre active a la fois,
// d'ou un objet unique et non une liste. "fortune" est la seule pour l'instant.
export const SPECIAL_TILE_TYPES=Object.freeze(["fortune"]);

// La categorie est obligatoire : sans valeur, on retombe sur la premiere
// categorie definie, ou "Autres" s'il n'y en a aucune. Une tuile speciale dont
// le type n'est pas reconnu est ignoree plutot que rendue n'importe comment.
export function normalizeSpecialTile(raw,categories){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const type=typeof raw.type==="string" ? raw.type : "";
  if(!SPECIAL_TILE_TYPES.includes(type)) return null;
  const names=(Array.isArray(categories) ? categories : [])
    .map(cat=>cat && cat.name)
    .filter(Boolean);
  const category=sanitizeText(raw.category,100) || names[0] || "Autres";
  return {type,category};
}

// Compteurs du bandeau "Liens web" : un lien peut afficher un chiffre public
// (etoiles GitHub, pulls Docker Hub, abonnes YouTube) a cote de son nom. Les
// types autorises sont exactement les widgets capables de fournir ce chiffre.
// Doit rester identique a server.js (WEB_LINK_COUNTER_TYPES).
export const LINK_COUNTER_TYPES=Object.freeze(["github","dockerhub","youtube"]);

// La cible (depot ou chaine) est obligatoire : un compteur sans cible ne peut
// rien mesurer, on l'ignore plutot que d'afficher un chiffre trompeur.
export function normalizeLinkCounter(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const type=typeof raw.type==="string" ? raw.type.trim() : "";
  if(!LINK_COUNTER_TYPES.includes(type)) return null;
  const target=sanitizeText(raw.target,200);
  if(!target) return null;
  return {type,target};
}

// Champ de l'entree de statut ou se trouve le chiffre a afficher, par type de
// compteur. C'est le contrat des backends widgets correspondants : GitHub
// publie "value" (la metrique choisie), Docker Hub "pulls", YouTube
// "subscribers". Renvoie null quand le chiffre n'est pas disponible.
export function linkCounterValue(counter,status){
  if(!counter || !status || status.ok!==true) return null;
  const field=counter.type==="dockerhub" ? "pulls" : counter.type==="youtube" ? "subscribers" : "value";
  const value=Number(status[field]);
  return Number.isFinite(value) ? value : null;
}

// Le bandeau reste etroit : au-dela de 999 on compacte avec un suffixe, k pour
// les milliers et M pour les millions, plutot qu'une longue suite de chiffres.
// 109 reste "109", 3000 devient "3k", 64600000 devient "64.6M".
export function compactCount(value){
  return formatCompactCount(value);
}

// Dashboards : on garantit toujours au moins un onglet. Un identifiant manquant
// ou reserve recoit un identifiant genere, et les doublons sont ecartes pour
// que state.dashboardId ne designe qu'une seule entree. Le dashboard par
// defaut "main" est recree quand aucun n'est declare.
function normalizeDashboards(raw){  const seen=new Set();
  const list=(Array.isArray(raw) ? raw : []).map(item=>({
    id:sanitizeText(item && item.id,64),
    name:sanitizeText(item && item.name,100),
    icon:sanitizeIconClass(item && item.icon)
  })).filter(item=>item.name).map(item=>{
    let id=item.id;
    if(!id || RESERVED_DASHBOARD_IDS.includes(id) || seen.has(id)) id="dashboard-"+Math.random().toString(36).slice(2,10);
    seen.add(id);
    return {id,name:item.name,icon:item.icon||"fa-solid fa-grip"};
  });
  if(!list.length) return clone(DEFAULT_DASHBOARDS);
  return list;
}

// Supervision locale : les autres machines sont interrogees par leurs agents.
export const HOST_MONITORING_TYPES=Object.freeze(["local"]);

export function normalizeHostMonitoring(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  if(raw.type==="proxmox") return null;
  const type=HOST_MONITORING_TYPES.includes(raw.type) ? raw.type : "local";
  return {
    enabled:raw.enabled===true,
    type,
    url:sanitizeUrl(raw.url),
    node:sanitizeText(raw.node,50),
    path:sanitizeText(raw.path,200),
    tokenIdEnv:sanitizeText(raw.tokenIdEnv,100),
    tokenSecretEnv:sanitizeText(raw.tokenSecretEnv,100),
    wireguard:type === "local" ? normalizeWireguardPrefs(raw.wireguard) : {enabled:true,interface:""},
    smart:normalizeSmartPrefs(raw.smart),
    aptUpdates:normalizeAptUpdatesPrefs(raw.aptUpdates)
  };
}

// Preference d'affichage des pairs WireGuard d'un hote. Absente, la section
// reste visible des que le dump local contient des donnees ; un filtre d'interface
// facultatif permet de n'afficher qu'un tunnel.
export function normalizeWireguardPrefs(raw){
  const src=(raw && typeof raw==="object" && !Array.isArray(raw)) ? raw : {};
  return {
    enabled:src.enabled!==false,
    interface:sanitizeText(src.interface,50)
  };
}

// Preference SMART : section visible par defaut, avec un filtre facultatif de
// noms de peripheriques (`/dev/sda`, `/dev/nvme0`, ...).
export function normalizeSmartPrefs(raw){
  const src=(raw && typeof raw==="object" && !Array.isArray(raw)) ? raw : {};
  const disks=Array.isArray(src.disks)
    ? [...new Set(src.disks.map(value=>sanitizeText(value,100)).filter(Boolean))].slice(0,20)
    : [];
  return {enabled:src.enabled!==false,disks};
}

export function normalizeAptUpdatesPrefs(raw){
  const src=(raw && typeof raw==="object" && !Array.isArray(raw)) ? raw : {};
  return {enabled:src.enabled!==false};
}

export function normalizeConfig(cfg={}){
  const normalizedServices=Array.isArray(cfg.services)
    ? clone(cfg.services)
    : [];
  const derivedHosts=[...new Set(
    normalizedServices.map(service=>(service.host||"").trim()).filter(Boolean)
  )].map(name=>({name,icon:"fa-solid fa-server"}));
  // Dashboards : liste ordonnee qui alimente les onglets. Un identifiant vide,
  // duplique ou reserve ("supervision") est remplace par un identifiant genere.
  const normalizedDashboards=normalizeDashboards(cfg.dashboards);
  const dashboardIds=new Set(normalizedDashboards.map(d=>d.id));
  const defaultDashboardId=normalizedDashboards[0].id;
  const normalizedCategories=(Array.isArray(cfg.categories) ? clone(cfg.categories) : clone(DEFAULT_CATEGORIES))
    .map(cat=>({
      name:sanitizeText(cat.name,100),
      icon:sanitizeIconClass(cat.icon),
      color:sanitizeTileColor(cat.color),
      dashboardId:dashboardIds.has(sanitizeText(cat.dashboardId,64)) ? sanitizeText(cat.dashboardId,64) : defaultDashboardId
    }));
  const normalized={
    ...normalizeViewPrefs(cfg),
    services:normalizedServices.map(svc=>({
      name:sanitizeText(svc.name,100),
      host:sanitizeText(svc.host,100),
      category:sanitizeText(svc.category,100),
      url:sanitizeUrl(svc.url),
      icon:sanitizeImagePath(svc.icon),
      monitor:svc.monitor===false ? false : svc.monitor==="soft" ? "soft" : true,
      // Normalisation pilotee par le schema du widget (manifest). Un widget
      // inconnu est conserve tel quel : on ne perd jamais des reglages.
      widget:normalizeWidgetConfig(svc.widget)
    })),
    categories:normalizedCategories,
    dashboards:normalizedDashboards,
    // Tuile speciale unique du tableau de bord (phrase du jour...), placee dans
    // une categorie. Absente = aucune.
    specialTile:normalizeSpecialTile(cfg.specialTile,normalizedCategories),
    hosts:Array.isArray(cfg.hosts) && cfg.hosts.length
      ? cfg.hosts.map(host=>({
          id:sanitizeText(host.id,64),
          name:sanitizeText(host.name,100),
          icon:sanitizeIconClass(host.icon),
          color:sanitizeTileColor(host.color),
          monitoring:normalizeHostMonitoring(host.monitoring)
        }))
      : derivedHosts.map(host=>({
          ...host,
          id:host.id||"host-"+Math.random().toString(36).slice(2,10)
       })),
    replication:{
      role:"primary",
      instanceName:sanitizeText(cfg.replication?.instanceName,100)||"Dashmon",
      secondaries:Array.isArray(cfg.replication?.secondaries)
        ? [...new Set(cfg.replication.secondaries.map(value=>sanitizeUrl(value)).filter(Boolean))].slice(0,20) : [],
      agentNames:cfg.replication?.agentNames && typeof cfg.replication.agentNames==="object" && !Array.isArray(cfg.replication.agentNames)
        ? Object.fromEntries(Object.entries(cfg.replication.agentNames).map(([url,name])=>[sanitizeUrl(url),sanitizeText(name,100)]).filter(([url,name])=>url && name)) : {}
    },
    theme:typeof cfg.theme==="string" && cfg.theme.trim() ? cfg.theme.trim() : "dark",
    language:cfg.language==="en" ? "en" : "fr",
    usageCounts:cfg.usageCounts && typeof cfg.usageCounts==="object" && !Array.isArray(cfg.usageCounts) ? cfg.usageCounts : {},
    webLinks:(Array.isArray(cfg.webLinks) ? clone(cfg.webLinks) : clone(DEFAULT_WEB_LINKS))
      .map(link=>({
        name:sanitizeText(link.name,100),
        url:sanitizeUrl(link.url),
        icon:sanitizeIconClass(link.icon),
        counter:normalizeLinkCounter(link.counter)
      })),
    webLinksSeedVersion:Number.isFinite(Number(cfg.webLinksSeedVersion)) ? Number(cfg.webLinksSeedVersion) : 0,
    webLinksColor:normalizeWebLinksColor(cfg.webLinksColor)
  };
  // Categories et hotes ont chacun LEUR palette : une couleur d'hote peut
  // legitimement etre la meme qu'une couleur de categorie. Les deux listes
  // sont donc traitees separement, sans ensemble partage — lier les deux
  // forcerait a changer une couleur d'un cote des que l'autre evolue.
  assignTileColors(normalized.categories,new Set());
  assignTileColors(normalized.hosts,new Set());
  return normalized;
}

export function serviceUsageKey(service){
  return service.url || `${service.name||""}|${service.host||""}|${service.category||""}`;
}

export function compareServices(a,b){
  if(state.sortMode==="usage"){
    const usageA=Number(state.usageCounts[serviceUsageKey(a)]||0);
    const usageB=Number(state.usageCounts[serviceUsageKey(b)]||0);
    if(usageA!==usageB) return usageB-usageA;
  }
  return normalize(a.name).localeCompare(normalize(b.name),"fr");
}

export function getCategory(name){
  return state.categories.find(c=>c.name===name) || {name,icon:"fa-solid fa-folder"};
}

// Dashboard par identifiant. Un identifiant inconnu (preference d'un autre
// navigateur, dashboard supprime) retombe sur le premier dashboard, qui existe
// toujours.
export function getDashboard(id){
  return state.dashboards.find(d=>d.id===id) || state.dashboards[0] || DEFAULT_DASHBOARDS[0];
}
