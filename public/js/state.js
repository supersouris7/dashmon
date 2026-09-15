// État global partagé, valeurs par défaut et normalisation de la configuration.
export const DEFAULT_CATEGORIES = [
  {name:"Infrastructure",icon:"fa-solid fa-server"},
  {name:"Applications",icon:"fa-solid fa-cubes"},
  {name:"Administration",icon:"fa-solid fa-gear"}
];

export const ICON_OPTIONS=[
  "fa-solid fa-folder",
  "fa-solid fa-folder-tree",
  "fa-solid fa-cubes",
  "fa-solid fa-table-cells-large",
  "fa-solid fa-layer-group",
  "fa-solid fa-boxes-stacked",
  "fa-solid fa-gamepad",
  "fa-solid fa-house",
  "fa-solid fa-house-signal",
  "fa-solid fa-lightbulb",
  "fa-solid fa-plug",
  "fa-solid fa-power-off",
  "fa-solid fa-gauge-high",
  "fa-solid fa-chart-line",
  "fa-solid fa-chart-column",
  "fa-solid fa-eye",
  "fa-solid fa-bell",
  "fa-solid fa-shield-halved",
  "fa-solid fa-lock",
  "fa-solid fa-key",
  "fa-solid fa-screwdriver-wrench",
  "fa-solid fa-gear",
  "fa-solid fa-wrench",
  "fa-solid fa-terminal",
  "fa-solid fa-code",
  "fa-solid fa-database",
  "fa-solid fa-hard-drive",
  "fa-solid fa-server",
  "fa-solid fa-cloud",
  "fa-solid fa-cloud-arrow-up",
  "fa-solid fa-cloud-arrow-down",
  "fa-solid fa-network-wired",
  "fa-solid fa-wifi",
  "fa-solid fa-globe",
  "fa-solid fa-link",
  "fa-solid fa-diagram-project",
  "fa-solid fa-share-nodes",
  "fa-solid fa-ethernet",
  "fa-solid fa-film",
  "fa-solid fa-photo-film",
  "fa-solid fa-music",
  "fa-solid fa-tv",
  "fa-solid fa-book",
  "fa-solid fa-file",
  "fa-solid fa-file-lines",
  "fa-solid fa-download",
  "fa-solid fa-upload",
  "fa-solid fa-box-archive",
  "fa-solid fa-magnifying-glass",
  "fa-solid fa-user-shield",
  "fa-solid fa-users",
  "fa-solid fa-calendar",
  "fa-solid fa-clock",
  "fa-solid fa-microchip",
  "fa-solid fa-computer",
  "fa-solid fa-desktop",
  "fa-solid fa-laptop",
  "fa-solid fa-memory",
  "fa-solid fa-box",
  "fa-solid fa-box-open",
  "fa-solid fa-cube",
  "fa-brands fa-raspberry-pi",
  "fa-brands fa-docker",
  "fa-brands fa-windows",
  "fa-brands fa-linux",
  "fa-brands fa-ubuntu",
  "fa-brands fa-debian",
  "fa-brands fa-centos",
  "fa-brands fa-redhat",
  "fa-brands fa-fedora",
  "fa-brands fa-youtube",
  "fa-solid fa-envelope",
  "fa-brands fa-google-drive",
  "fa-brands fa-github"
];

export const DEFAULT_HOSTS=[
  {name:"Dashboard",icon:"fa-solid fa-gauge-high",monitoring:{enabled:true,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}},
  {name:"Proxmox",icon:"fa-solid fa-server",monitoring:{enabled:true,type:"proxmox",url:"https://proxmox.local",node:"pve",tokenEnv:"",tokenIdEnv:"PROXMOX_TOKEN_ID",tokenSecretEnv:"PROXMOX_TOKEN_SECRET"}},
  {name:"Linux",icon:"fa-brands fa-linux",monitoring:{enabled:true,type:"linux",url:"http://linux.local/metrics",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}},
  {name:"Serveur",icon:"fa-solid fa-server",monitoring:{enabled:true,type:"linux",url:"http://serveur.local/metrics",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}}
];

export const DEFAULT_SERVICES = [
  {name:"Portainer",host:"Dashboard",category:"Infrastructure",url:"https://portainer.local",icon:"icons/portainer.png",monitor:true},
  {name:"Proxmox",host:"Proxmox",category:"Infrastructure",url:"https://proxmox.local",icon:"icons/proxmox.png",monitor:true},
  {name:"AdGuard Home",host:"Linux",category:"Infrastructure",url:"http://adguard.local",icon:"icons/adguard-home.png",monitor:true},
  {name:"Jellyfin",host:"Serveur",category:"Applications",url:"http://jellyfin.local",icon:"icons/jellyfin.png",monitor:true},
  {name:"Home Assistant",host:"Serveur",category:"Applications",url:"http://homeassistant.local",icon:"icons/home-assistant.png",monitor:true},
  {name:"Routeur",host:"",category:"Administration",url:"http://192.168.1.1",icon:"icons/router.png",monitor:true}
];

export const DEFAULT_WEB_LINKS=[
  {"name":"YouTube","url":"https://www.youtube.com","icon":"fa-brands fa-youtube"},
  {"name":"Outlook","url":"https://outlook.office.com","icon":"fa-solid fa-envelope"},
  {"name":"Google Drive","url":"https://drive.google.com","icon":"fa-brands fa-google-drive"},
  {"name":"GitHub","url":"https://github.com","icon":"fa-brands fa-github"}
];

export const state = {
  services: [],
  categories: [],
  hosts: [],
  collapsed: {},
  viewMode: "columns",
  openMode: "same",
  groupMode: "category",
  theme: "dark",
  language: "fr",
  sortMode: "alphabetical",
  usageCounts: {},
  webLinks: [],
  webLinksCollapsed: false,
  webLinksSeedVersion: 0,
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

export function normalizeConfig(cfg={}){
  const normalizedServices=Array.isArray(cfg.services)
    ? clone(cfg.services)
    : clone(DEFAULT_SERVICES);
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
      monitor:svc.monitor===false ? false : true
    })),
    categories:(Array.isArray(cfg.categories) ? clone(cfg.categories) : clone(DEFAULT_CATEGORIES))
      .map(cat=>({
        name:sanitizeText(cat.name,100),
        icon:sanitizeIconClass(cat.icon)
      })),
    hosts:Array.isArray(cfg.hosts) && cfg.hosts.length
      ? cfg.hosts.map(host=>({
          name:sanitizeText(host.name,100),
          icon:sanitizeIconClass(host.icon),
          monitoring:{
            enabled:host.monitoring?.enabled===true,
            type:["local","linux","proxmox"].includes(host.monitoring?.type) ? host.monitoring.type : "local",
            url:sanitizeUrl(host.monitoring?.url||""),
            node:sanitizeText(host.monitoring?.node||"",50),
            tokenEnv:sanitizeText(host.monitoring?.tokenEnv||"",50),
            tokenIdEnv:sanitizeText(host.monitoring?.tokenIdEnv||"",50),
            tokenSecretEnv:sanitizeText(host.monitoring?.tokenSecretEnv||"",50)
          }
        }))
      : (derivedHosts.length ? derivedHosts : clone(DEFAULT_HOSTS)).map(host=>({
          ...host,
          monitoring:host.monitoring || {enabled:false,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}
        })),
    collapsed:cfg.collapsed && typeof cfg.collapsed==="object" && !Array.isArray(cfg.collapsed) ? cfg.collapsed : {},
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
    webLinksSeedVersion:Number.isFinite(Number(cfg.webLinksSeedVersion)) ? Number(cfg.webLinksSeedVersion) : 0
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
