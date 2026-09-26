// État global partagé, valeurs par défaut et normalisation de la configuration.
// Importe le registre des widgets : la config d'un widget est deduite du
// manifest publie par le serveur, plus d'une liste de champs ecrite ici.
import { normalizeWidgetConfig } from "./widget-registry.js";

export const DEFAULT_CATEGORIES = [
  {name:"Infrastructure",icon:"fa-solid fa-server"},
  {name:"Applications",icon:"fa-solid fa-cubes"},
  {name:"Administration",icon:"fa-solid fa-gear"}
];

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
  "fa-solid fa-hard-drives",
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
  "fa-solid fa-scanner",
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
  "fa-solid fa-factory",
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
  "fa-brands fa-kubernetes",
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
  "fa-brands fa-tailwind",
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
  "fa-brands fa-zoom",
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

export const DEFAULT_BANNER_URL="https://github.com/supersouris7";
export const DEFAULT_FAVICON="/logo.png";

// Libellé stable (indépendant de la langue) pour le groupe des services sans
// hôte : les clefs collapsed reposent dessus. Affiché via t("noHost").
export const FALLBACK_HOST="Sans hôte";

export const state = {
  services: [],
  categories: [],
  hosts: [],
  collapsed: {},
  viewMode: "columns",
  openMode: "same",
  groupMode: "category",
  theme: "dark",
  language: "en",
  sortMode: "alphabetical",
  usageCounts: {},
  webLinks: [],
  webLinksCollapsed: false,
  webLinksSeedVersion: 0,
  smallIcons: false,
  hostsDisplay: "name",
  bannerIcon: true,
  bannerUrl: DEFAULT_BANNER_URL,
  favicon: "",
  faviconEnabled: true,
  editServices: [],
  editCategories: [],
  editHosts: [],
  editWebLinks: [],
  serviceStatus: {},
  hostMetricsData: [],
  statusTimer: null,
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

function sanitizeImagePath(p) {
  const s = String(p || "").trim();
  const m = s.match(/^icons\/([a-zA-Z0-9._-]+)\.png$/);
  return m ? `icons/${m[1]}.png` : "";
}

// Doit rester identique à server.js (sanitizeFavicon) pour éviter des
// divergences à l'enregistrement (le serveur écraserait sinon le champ).
export const MAX_FAVICON_BYTES=350000;

function sanitizeFavicon(value){
  const s=String(value||"").trim();
  if(!s || s.length>MAX_FAVICON_BYTES) return "";
  return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(s) ? s : "";
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

export function normalizeConfig(cfg={}){
  const normalizedServices=Array.isArray(cfg.services)
    ? clone(cfg.services)
    : [];
  const derivedHosts=[...new Set(
    normalizedServices.map(service=>(service.host||"").trim()).filter(Boolean)
  )].map(name=>({name,icon:"fa-solid fa-server"}));
  return {
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
    categories:(Array.isArray(cfg.categories) ? clone(cfg.categories) : clone(DEFAULT_CATEGORIES))
      .map(cat=>({
        name:sanitizeText(cat.name,100),
        icon:sanitizeIconClass(cat.icon)
      })),
    hosts:Array.isArray(cfg.hosts) && cfg.hosts.length
      ? cfg.hosts.map(host=>({
          id:sanitizeText(host.id,64),
          name:sanitizeText(host.name,100),
          icon:sanitizeIconClass(host.icon),
          monitoring:{
            enabled:host.monitoring?.enabled===true,
            type:["local","linux","proxmox"].includes(host.monitoring?.type) ? host.monitoring.type : "local",
            url:sanitizeUrl(host.monitoring?.url||""),
            node:sanitizeText(host.monitoring?.node||"",50),
            tokenEnv:sanitizeText(host.monitoring?.tokenEnv||"",50),
            tokenIdEnv:sanitizeText(host.monitoring?.tokenIdEnv||"",50),
            tokenSecretEnv:sanitizeText(host.monitoring?.tokenSecretEnv||"",50),
            tokenId:sanitizeText(host.monitoring?.tokenId||"",2000),
            tokenSecret:sanitizeText(host.monitoring?.tokenSecret||"",2000)
          }
        }))
      : derivedHosts.map(host=>({
          ...host,
          id:host.id||"host-"+Math.random().toString(36).slice(2,10),
          monitoring:host.monitoring || {enabled:false,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:"",tokenId:"",tokenSecret:""}
        })),
    collapsed:normalizeCollapsed(cfg.collapsed),
    viewMode:["rows","columns","plain"].includes(cfg.viewMode) ? cfg.viewMode : "columns",
    openMode:cfg.openMode==="new" ? "new" : "same",
    groupMode:cfg.groupMode==="host" ? "host" : "category",
    theme:typeof cfg.theme==="string" && cfg.theme.trim() ? cfg.theme.trim() : "dark",
    language:cfg.language==="en" ? "en" : "fr",
    sortMode:cfg.sortMode==="usage" ? "usage" : "alphabetical",
    usageCounts:cfg.usageCounts && typeof cfg.usageCounts==="object" && !Array.isArray(cfg.usageCounts) ? cfg.usageCounts : {},
    webLinks:(Array.isArray(cfg.webLinks) ? clone(cfg.webLinks) : clone(DEFAULT_WEB_LINKS))
      .map(link=>({
        name:sanitizeText(link.name,100),
        url:sanitizeUrl(link.url),
        icon:sanitizeIconClass(link.icon)
      })),
    webLinksCollapsed:cfg.webLinksCollapsed===true,
    webLinksSeedVersion:Number.isFinite(Number(cfg.webLinksSeedVersion)) ? Number(cfg.webLinksSeedVersion) : 0,
    smallIcons:cfg.smallIcons===true,
    hostsDisplay:cfg.hostsDisplay==="icon" ? "icon" : "name",
    bannerIcon:cfg.bannerIcon!==false,
    bannerUrl:sanitizeUrl(cfg.bannerUrl||"") || DEFAULT_BANNER_URL,
    favicon:sanitizeFavicon(cfg.favicon),
    faviconEnabled:cfg.faviconEnabled!==false
  };
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
