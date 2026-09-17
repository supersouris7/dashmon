// Agrandir le pool de threads avant tout usage async (DNS/fs) : évite la
// saturation de libuv quand des résolutions DNS upstream sont lentes.
process.env.UV_THREADPOOL_SIZE=process.env.UV_THREADPOOL_SIZE||"16";

const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const os = require("os");

const app = express();

function ts(){return new Date().toISOString().replace("T"," ").replace(/\.\d{3}Z$/,"")}

// Derrière un reverse proxy unique (nginx) : TRUST_PROXY=1 pour que req.ip,
// req.secure et le rate limiter utilisent l'adresse réelle du client.
const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;
if (TRUST_PROXY > 0) app.set("trust proxy", TRUST_PROXY);

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(DATA_DIR, "config.json");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");
const ICONS_DIR = process.env.ICONS_DIR || path.join(DATA_DIR, "icons");
const THEMES_NATIVE_DIR = process.env.THEMES_NATIVE_DIR || path.join(PUBLIC_DIR, "themes");
const THEMES_CUSTOM_DIR = process.env.THEMES_CUSTOM_DIR || path.join(DATA_DIR, "themes");

const APP_VERSION = require("./package.json").version;
const INDEX_HTML = fs.readFileSync(INDEX_FILE, "utf8").replace(/\{\{VERSION\}\}/g, APP_VERSION);

app.disable("x-powered-by");
app.use(express.json({limit:"1mb",strict:true}));

const pngBody=express.raw({
  type:"image/png",
  limit:"10mb"
});

const INSECURE_TLS = process.env.DASHBOARD_INSECURE_TLS === "1";
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

const TOKEN_ENV_ALLOWLIST = new Set([
  "PROXMOX_TOKEN_ID",
  "PROXMOX_TOKEN_SECRET",
  "LINUX_METRICS_TOKEN",
  ...String(process.env.DASHBOARD_TOKEN_ENVS||"").split(",")
    .map(s=>s.trim().toUpperCase())
    .filter(s=>/^[A-Z_][A-Z0-9_]*$/.test(s))
]);

if (!DASHBOARD_PASSWORD) {
  const populated=[...TOKEN_ENV_ALLOWLIST].filter(name=>process.env[name]);
  if (populated.length) {
    console.warn(`${ts()} ⚠ ATTENTION : Dashmon est lancé SANS mot de passe (DASHBOARD_PASSWORD vide) alors que des tokens sensibles sont chargés (${populated.join(", ")}).`);
    console.warn(`${ts()} ⚠ N'\u00e9ditez pas la config depuis des machines non fiables, et exposez Dashmon derrière un proxy HTTPS + mot de passe.`);
  }
}

app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  res.set("Content-Security-Policy", [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "font-src https://cdnjs.cloudflare.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; "));
  if (_req.secure || _req.get("x-forwarded-proto") === "https") {
    res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
});

app.use((_req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(_req.method)) {
    const origin = _req.get("Origin");
    if (origin) {
      const host = _req.get("Host") || "";
      let ok = false;
      try {
        const secure = _req.secure || _req.get("x-forwarded-proto") === "https";
        const o = new URL(origin);
        const hostNoPort = host.split(":")[0];
        const hostPort = host.split(":")[1] || (secure ? "443" : "80");
        const originPort = o.port || (o.protocol === "https:" ? "443" : "80");
        ok = o.hostname === hostNoPort && originPort === hostPort;
      } catch (_) {}
      if (!ok) {
        return res.status(403).json({ error: "Requête refusée (CSRF)" });
      }
    }
  }
  next();
});

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 60;

function rateLimit(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.ts > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { ts: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.set("Retry-After", String(Math.ceil((RATE_LIMIT_WINDOW - (now - entry.ts)) / 1000)));
    return res.status(429).json({ error: "Trop de requêtes, réessayez plus tard" });
  }
  next();
}

setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW * 2;
  for (const [ip, entry] of rateLimitStore) {
    if (entry.ts < cutoff) rateLimitStore.delete(ip);
  }
}, 300000).unref();

app.use("/api", rateLimit);

const GET_LIMIT_WINDOW = 60000;
const GET_LIMIT_MAX = 120;
const getLimitStore = new Map();

function rateLimitGet(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = getLimitStore.get(ip);
  if (!entry || now - entry.ts > GET_LIMIT_WINDOW) {
    getLimitStore.set(ip, { ts: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > GET_LIMIT_MAX) {
    return res.status(429).json({ error: "Trop de requêtes, réessayez plus tard" });
  }
  next();
}

// /api/host-metrics déclenche des requêtes HTTP sortantes vers les hôtes :
// borné pour éviter d'être utilisé comme relais d'amplification (SSRF).
app.use("/api/host-metrics", rateLimitGet);
app.use("/api/status", rateLimitGet);

if (DASHBOARD_PASSWORD) {
  app.use("/api", (req, res, next) => {
    const auth = req.get("Authorization") || "";
    const expected = "Basic " + Buffer.from("admin:" + DASHBOARD_PASSWORD).toString("base64");
    if (auth === expected) return next();
    res.set("WWW-Authenticate", 'Basic realm="Dashmon"');
    res.status(401).json({ error: "Authentification requise" });
  });
}

app.use((_req,res,next)=>{
  const start=Date.now();
  res.on("finish",()=>{
    const ms=Date.now()-start;
    console.log(`${_req.method} ${_req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

function sanitizeText(value, max = 100) {
  return String(value || "").trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F<>]/g, "")
    .slice(0, max);
}

function sanitizeUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return "";
}

function sanitizeIconClass(icon) {
  const s = String(icon || "").trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9-]*( [a-z0-9][a-z0-9-]*)*$/.test(s) && s.length <= 80) return s;
  return "fa-solid fa-folder";
}

function sanitizeImagePath(p) {
  const s = String(p || "").trim();
  const m = s.match(/^icons\/([a-zA-Z0-9._-]+)\.png$/);
  return m ? `icons/${m[1]}.png` : "";
}

function ensureDataFiles(){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  fs.mkdirSync(ICONS_DIR,{recursive:true});
  fs.mkdirSync(THEMES_CUSTOM_DIR,{recursive:true});
  fs.mkdirSync(THEMES_NATIVE_DIR,{recursive:true});

  if(!fs.existsSync(CONFIG_FILE)){
    const bundled=path.join(ROOT,"config.json");
    if(fs.existsSync(bundled)){
      fs.copyFileSync(bundled,CONFIG_FILE);
    }else{
      fs.writeFileSync(CONFIG_FILE,JSON.stringify({
        services:[],
        categories:[],
        hosts:[],
        collapsed:{},
        viewMode:"columns",
        openMode:"same",
        groupMode:"category",
        theme:"dark",
        webLinks:[],
        webLinksCollapsed:false
      },null,2)+"\n","utf8");
    }
  }
}

ensureDataFiles();

function readConfig(){
  return JSON.parse(fs.readFileSync(CONFIG_FILE,"utf8"));
}

const DEFAULT_HOSTS = [
  {name:"Dashmon",icon:"fa-solid fa-gauge-high",monitoring:{enabled:true,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}},
  {name:"Proxmox",icon:"fa-solid fa-server",monitoring:{enabled:true,type:"proxmox",url:"https://proxmox.local",node:"pve",tokenEnv:"",tokenIdEnv:"PROXMOX_TOKEN_ID",tokenSecretEnv:"PROXMOX_TOKEN_SECRET"}},
  {name:"Linux",icon:"fa-brands fa-linux",monitoring:{enabled:true,type:"linux",url:"http://linux.local/metrics",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}},
  {name:"Serveur",icon:"fa-solid fa-server",monitoring:{enabled:true,type:"linux",url:"http://serveur.local/metrics",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:""}}
];
const HOSTS_SEED_VERSION = 1;

function ensureHostExamplesSeeded(){
  let config;
  try{
    config=readConfig();
  }catch(_error){
    return;
  }

  const currentVersion=Number(config.hostsSeedVersion||0);
  if(currentVersion>=HOSTS_SEED_VERSION) return;

  if(!Array.isArray(config.hosts)) config.hosts=[];

  // Corrige uniquement l'ancien exemple Proxmox connu.
  const proxmox=config.hosts.find(host=>host?.name==="Proxmox");
  if(proxmox?.monitoring){
    const oldUrl=String(proxmox.monitoring.url||"");
    if(!oldUrl || oldUrl==="https://proxmox.lan:8006" || oldUrl==="https://proxmox.local:8006"){
      proxmox.monitoring.url="https://proxmox.local";
    }
  }

  // Ajoute uniquement les exemples absents, sans écraser les hôtes personnalisés.
  const existingNames=new Set(config.hosts.map(host=>host?.name).filter(Boolean));
  for(const sample of DEFAULT_HOSTS){
    if(!existingNames.has(sample.name)){
      config.hosts.push(JSON.parse(JSON.stringify(sample)));
    }
  }

  config.hostsSeedVersion=HOSTS_SEED_VERSION;

  try{
    fs.writeFileSync(CONFIG_FILE,JSON.stringify(config,null,2)+"\n","utf8");
  }catch(_error){
    // Ne pas bloquer le démarrage si la migration ne peut pas être écrite.
  }
}

ensureHostExamplesSeeded();

const DEFAULT_WEB_LINKS = [{"name": "YouTube", "url": "https://www.youtube.com", "icon": "fa-brands fa-youtube"}, {"name": "Outlook", "url": "https://outlook.office.com", "icon": "fa-solid fa-envelope"}, {"name": "Google Drive", "url": "https://drive.google.com", "icon": "fa-brands fa-google-drive"}, {"name": "GitHub", "url": "https://github.com", "icon": "fa-brands fa-github"}];
const WEB_LINKS_SEED_VERSION = 2;

function ensureWebLinksSeeded(){
  let config;
  try {
    config=readConfig();
  } catch (_error) {
    return;
  }

  const currentVersion=Number(config.webLinksSeedVersion||0);

  if(currentVersion>=WEB_LINKS_SEED_VERSION) return;

  config.webLinks=DEFAULT_WEB_LINKS;
  config.webLinksCollapsed=false;
  config.webLinksSeedVersion=WEB_LINKS_SEED_VERSION;

  try {
    fs.writeFileSync(CONFIG_FILE,JSON.stringify(config,null,2)+"\n","utf8");
  } catch (_error) {
    // Ne pas bloquer le démarrage si l'écriture de migration échoue.
  }
}

ensureWebLinksSeeded();

app.get("/healthz",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json({ok:true});
});

app.get("/api/config",(_req,res)=>{
  try{
    res.set("Cache-Control","no-store");
    res.json(readConfig());
  }catch(error){
    console.error("Lecture config:",error);
    res.status(500).json({error:"Lecture de config.json impossible"});
  }
});

app.put("/api/config",(req,res)=>{
  try{
    const config=req.body;
    if(!config || typeof config!=="object" || Array.isArray(config)){
      return res.status(400).json({error:"Configuration invalide"});
    }

    const output={
      services:Array.isArray(config.services)
        ? config.services.slice(0,200).map(svc=>({
            name:sanitizeText(svc.name,100),
            host:sanitizeText(svc.host,100),
            category:sanitizeText(svc.category,100),
            url:sanitizeUrl(svc.url),
            icon:sanitizeImagePath(svc.icon),
            monitor:svc.monitor===false ? false : true
          }))
        : [],
      categories:Array.isArray(config.categories)
        ? config.categories.slice(0,50).map(cat=>({
            name:sanitizeText(cat.name,100),
            icon:sanitizeIconClass(cat.icon)
          }))
        : [],
      hosts:Array.isArray(config.hosts)
        ? config.hosts.slice(0,50).map(host=>{
            const tokenEnv=String(host.monitoring?.tokenEnv||"").trim();
            const tokenIdEnv=String(host.monitoring?.tokenIdEnv||"").trim();
            const tokenSecretEnv=String(host.monitoring?.tokenSecretEnv||"").trim();
            return {
              name:sanitizeText(host.name,100),
              icon:sanitizeIconClass(host.icon),
              monitoring:{
                enabled:host.monitoring?.enabled===true,
                type:["local","linux","proxmox"].includes(host.monitoring?.type)
                  ? host.monitoring.type : "local",
                url:sanitizeUrl(host.monitoring?.url||""),
                node:sanitizeText(host.monitoring?.node||"",50),
                tokenEnv:TOKEN_ENV_ALLOWLIST.has(tokenEnv) ? tokenEnv : "",
                tokenIdEnv:TOKEN_ENV_ALLOWLIST.has(tokenIdEnv) ? tokenIdEnv : "",
                tokenSecretEnv:TOKEN_ENV_ALLOWLIST.has(tokenSecretEnv) ? tokenSecretEnv : ""
              }
            };
          })
        : [],
      hostsSeedVersion:Number.isFinite(Number(config.hostsSeedVersion))
        ? Number(config.hostsSeedVersion) : HOSTS_SEED_VERSION,
      collapsed:config.collapsed && typeof config.collapsed==="object" && !Array.isArray(config.collapsed)
        ? config.collapsed : {},
      viewMode:["rows","columns","plain"].includes(config.viewMode) ? config.viewMode : "columns",
      openMode:config.openMode==="new" ? "new" : "same",
      groupMode:config.groupMode==="host" ? "host" : "category",
      theme:typeof config.theme==="string" && config.theme.trim() ? config.theme.trim() : "dark",
      language:config.language==="fr" ? "fr" : "en",
      sortMode:config.sortMode==="usage" ? "usage" : "alphabetical",
      usageCounts:config.usageCounts && typeof config.usageCounts==="object" && !Array.isArray(config.usageCounts)
        ? Object.fromEntries(
            Object.entries(config.usageCounts)
              .slice(0,500)
              .map(([key,value])=>{
                const n=Number(value);
                return [String(key).slice(0,200),Number.isFinite(n)&&n>=0 ? Math.floor(n) : 0];
              })
          )
        : {},
      webLinks:Array.isArray(config.webLinks)
        ? config.webLinks.slice(0,100).map(link=>({
            name:sanitizeText(link.name,100),
            url:sanitizeUrl(link.url),
            icon:sanitizeIconClass(link.icon)
          }))
        : [],
      webLinksCollapsed:config.webLinksCollapsed===true,
      webLinksSeedVersion:Number.isFinite(Number(config.webLinksSeedVersion))
        ? Number(config.webLinksSeedVersion) : 0
    };

    fs.writeFileSync(CONFIG_FILE,JSON.stringify(output,null,2)+"\n","utf8");
    res.json({ok:true});
  }catch(error){
    console.error("Écriture config:",error);
    res.status(500).json({error:"Écriture de config.json impossible"});
  }
});

app.get("/api/icons",(_req,res)=>{
  try{
    fs.mkdirSync(ICONS_DIR,{recursive:true});
    const files=fs.readdirSync(ICONS_DIR,{withFileTypes:true})
      .filter(entry=>entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map(entry=>entry.name)
      .sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
    res.set("Cache-Control","no-store");
    res.json(files);
  }catch(error){
    console.error("Lecture des images:",error);
    res.status(500).json({error:"Lecture des images impossible"});
  }
});

function parsePngSize(buffer){
  try{
    if(buffer.length<24) return {width:0,height:0};
    const w=buffer.readUInt32BE(16);
    const h=buffer.readUInt32BE(20);
    return {width:w,height:h};
  }catch(_error){
    return {width:0,height:0};
  }
}

app.post("/api/icons",pngBody,(req,res)=>{
  try{
    if(!Buffer.isBuffer(req.body) || req.body.length<8){
      return res.status(400).json({error:"Image PNG invalide"});
    }

    const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    if(!req.body.subarray(0,8).equals(signature)){
      return res.status(400).json({error:"Le fichier n'est pas un PNG valide"});
    }

    const {width,height}=parsePngSize(req.body);
    const MAX_IMG_DIM=8192;
    const MAX_IMG_PIXELS=64*1024*1024;
    if(!width || !height || width>MAX_IMG_DIM || height>MAX_IMG_DIM || width*height>MAX_IMG_PIXELS){
      return res.status(400).json({error:`Image trop grande (max ${MAX_IMG_DIM}×${MAX_IMG_DIM})`});
    }

    const requested=decodeURIComponent(req.get("X-File-Name")||"image.png");
    const base=path.basename(requested)
      .replace(/[^a-zA-Z0-9._-]+/g,"-")
      .replace(/^-+|-+$/g,"") || "image.png";

    const stem=path.parse(base).name || "image";
    let filename=`${stem}.png`;
    let counter=2;

    fs.mkdirSync(ICONS_DIR,{recursive:true});
    while(fs.existsSync(path.join(ICONS_DIR,filename))){
      filename=`${stem}-${counter++}.png`;
    }

    fs.writeFileSync(path.join(ICONS_DIR,filename),req.body);
    res.status(201).json({ok:true,file:filename});
  }catch(error){
    console.error("Import image:",error);
    res.status(500).json({error:"Import de l'image impossible"});
  }
});

app.delete("/api/icons/:file",(req,res)=>{
  try{
    const requested=decodeURIComponent(req.params.file||"");
    const filename=path.basename(requested);

    if(!filename || filename!==requested || !filename.toLowerCase().endsWith(".png")){
      return res.status(400).json({error:"Nom d'image invalide"});
    }

    const target=path.join(ICONS_DIR,filename);
    if(!fs.existsSync(target)){
      return res.status(404).json({error:"Image introuvable"});
    }

    fs.unlinkSync(target);
    res.json({ok:true,file:filename});
  }catch(error){
    console.error("Suppression image:",error);
    res.status(500).json({error:"Suppression de l'image impossible"});
  }
});

app.use("/icons",express.static(ICONS_DIR,{dotfiles:"deny",index:false}));

const THEME_REQUIRED_VARS=["bg","surface","surface-2","surface-3","border","text","muted","accent","danger","shadow"];

function sanitizeThemeId(raw){
  return String(raw||"").trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

function normalizeThemeObject(input){
  if(!input || typeof input!=="object" || Array.isArray(input)) return null;
  const id=sanitizeThemeId(input.id||input.name);
  if(!id) return null;

  const variables=input.variables||{};
  const clean={};
  for(const key of THEME_REQUIRED_VARS){
    const value=variables[key];
    if(typeof value==="string" && value.trim()) clean[key]=value.trim();
  }
  if(Object.keys(clean).length!==THEME_REQUIRED_VARS.length) return null;

  return {
    id,
    name:String(input.name||id).trim().slice(0,80),
    author:String(input.author||"").trim().slice(0,80),
    description:String(input.description||"").trim().slice(0,300),
    version:String(input.version||"1.0.0").trim().slice(0,20),
    variables:clean,
    css:typeof input.css==="string" ? input.css : ""
  };
}

function readThemeFile(dir,id){
  try{
    const target=path.join(dir,id+".json");
    if(!fs.existsSync(target)) return null;
    const theme=JSON.parse(fs.readFileSync(target,"utf8"));
    return normalizeThemeObject({...theme,id});
  }catch(_error){
    return null;
  }
}

function listThemeFiles(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true})
    .filter(entry=>entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map(entry=>path.parse(entry.name).name)
    .sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
}

app.get("/api/themes",(_req,res)=>{
  try{
    const native=listThemeFiles(THEMES_NATIVE_DIR)
      .map(id=>readThemeFile(THEMES_NATIVE_DIR,id))
      .filter(Boolean);
    const custom=listThemeFiles(THEMES_CUSTOM_DIR)
      .map(id=>readThemeFile(THEMES_CUSTOM_DIR,id))
      .filter(Boolean);
    res.set("Cache-Control","no-store");
    res.json({native,custom});
  }catch(error){
    console.error("Lecture des thèmes:",error);
    res.status(500).json({error:"Lecture des thèmes impossible"});
  }
});

app.get("/api/themes/:id/export",(req,res)=>{
  try{
    const id=sanitizeThemeId(req.params.id);
    if(!id) return res.status(400).json({error:"Identifiant de thème invalide"});

    const theme=readThemeFile(THEMES_NATIVE_DIR,id) || readThemeFile(THEMES_CUSTOM_DIR,id);
    if(!theme) return res.status(404).json({error:"Thème introuvable"});

    res.set("Content-Disposition",`attachment; filename="theme-${id}.json"`);
    res.set("Content-Type","application/json");
    res.send(JSON.stringify(theme,null,2)+"\n");
  }catch(error){
    console.error("Export de thème:",error);
    res.status(500).json({error:"Export du thème impossible"});
  }
});

app.post("/api/themes/import",(req,res)=>{
  try{
    const normalized=normalizeThemeObject(req.body);
    if(!normalized) return res.status(400).json({error:"Thème invalide : id et les 10 variables requises sont obligatoires"});

    if(normalized.css && normalized.css.length > 65536){
      return res.status(400).json({error:"CSS trop volumineux (max 64 Ko)"});
    }

    const nativeConflict=fs.existsSync(path.join(THEMES_NATIVE_DIR,normalized.id+".json"));
    if(nativeConflict){
      return res.status(409).json({error:`L'identifiant « ${normalized.id} » est réservé par un thème natif`});
    }

    const target=path.join(THEMES_CUSTOM_DIR,normalized.id+".json");
    fs.writeFileSync(target,JSON.stringify(normalized,null,2)+"\n","utf8");

    res.status(201).json({ok:true,file:`${normalized.id}.json`});
  }catch(error){
    console.error("Import thème:",error);
    res.status(500).json({error:"Import du thème impossible"});
  }
});

app.delete("/api/themes/:id",(req,res)=>{
  try{
    const id=sanitizeThemeId(req.params.id);
    if(!id) return res.status(400).json({error:"Identifiant de thème invalide"});

    if(fs.existsSync(path.join(THEMES_NATIVE_DIR,id+".json"))){
      return res.status(403).json({error:"Impossible de supprimer un thème natif"});
    }

    const target=path.join(THEMES_CUSTOM_DIR,id+".json");
    if(!fs.existsSync(target)){
      return res.status(404).json({error:"Thème introuvable"});
    }

    fs.unlinkSync(target);
    res.json({ok:true});
  }catch(error){
    console.error("Suppression thème:",error);
    res.status(500).json({error:"Suppression du thème impossible"});
  }
});

app.get("/",(_req,res)=>res.type("html").send(INDEX_HTML));
app.use(express.static(PUBLIC_DIR));

const statusCache = {};
const STATUS_INTERVAL = 60000;
const STATUS_TIMEOUT = 4000;

function checkService(service){
  return new Promise(resolve=>{
    if(!service.url || service.monitor===false) return resolve();

    let target;
    try{
      target=new URL(service.url);
    }catch(_error){
      statusCache[service.url]={state:"down",ms:0,error:"URL invalide"};
      return resolve();
    }

    if(target.protocol!=="http:" && target.protocol!=="https:"){
      statusCache[target.href]={state:"down",ms:0,error:"Protocole non supporté"};
      return resolve();
    }

    const client=target.protocol==="https:" ? https : http;
    const started=Date.now();

    const options={
      method:"GET",
      timeout:STATUS_TIMEOUT,
      rejectUnauthorized:!INSECURE_TLS,
      agent:false,
      family:4,
      headers:{
        "User-Agent":"Dashmon-Status/1.0",
        "Connection":"close"
      }
    };

    const req=client.request(target,options,res=>{
      res.resume();
      statusCache[target.href]={
        state:"up",
        ms:Date.now()-started,
        code:res.statusCode
      };
      resolve();
    });

    req.on("timeout",()=>req.destroy(new Error("timeout")));
    req.on("error",error=>{
      statusCache[target.href]={
        state:"down",
        ms:Date.now()-started,
        error:error.message==="timeout" ? "timeout" : error.message
      };
      resolve();
    });

    req.end();
  });
}

async function refreshStatuses(){
  let config;
  try{
    config=readConfig();
  }catch(_error){
    return;
  }

  const services=Array.isArray(config.services) ? config.services : [];
  // Purge les entrées dont l'URL n'est plus surveillée.
  const active=new Set(services.map(s=>sanitizeUrl(s.url)).filter(Boolean));
  for(const key of Object.keys(statusCache)){
    if(!active.has(key) && !active.has(key.replace(/\/$/,""))){
      delete statusCache[key];
    }
  }
  // Checks par lots de 3 espacés : évite les rafales de connexions en gardant
  // un cycle de rafraîchissement raisonnable.
  for(let i=0;i<services.length;i+=3){
    await Promise.all(services.slice(i,i+3).map(checkService));
    await new Promise(resolve=>setTimeout(resolve,150));
  }
}

function readCpuTimes(){
  return os.cpus().reduce((acc,cpu)=>{
    const times=cpu.times||{};
    acc.idle+=Number(times.idle||0);
    acc.total+=Object.values(times).reduce((sum,value)=>sum+Number(value||0),0);
    return acc;
  },{idle:0,total:0});
}

let previousCpuTimes=readCpuTimes();

function getLocalMetrics(){
  const current=readCpuTimes();
  const idleDelta=current.idle-previousCpuTimes.idle;
  const totalDelta=current.total-previousCpuTimes.total;
  previousCpuTimes=current;

  const cpu=totalDelta>0 ? (1-(idleDelta/totalDelta))*100 : 0;
  const totalMem=os.totalmem();
  const freeMem=os.freemem();
  const ram=totalMem>0 ? ((totalMem-freeMem)/totalMem)*100 : 0;

  return {
    cpu:Math.max(0,Math.min(100,cpu)),
    ram:Math.max(0,Math.min(100,ram))
  };
}

function getEnvValue(name,fallbackName){
  const candidates=[String(name||"").trim(),String(fallbackName||"").trim()];
  for(const candidate of candidates){
    if(candidate && TOKEN_ENV_ALLOWLIST.has(candidate)){
      return process.env[candidate]||"";
    }
  }
  return "";
}

function requestJsonMetrics(urlValue,tokenEnv){
  return new Promise((resolve,reject)=>{
    if(!urlValue) return reject(new Error("URL de métriques manquante"));

    let target;
    try{
      target=new URL(urlValue);
    }catch(_error){
      return reject(new Error("URL de métriques invalide"));
    }

    const headers={Accept:"application/json"};
    const token=getEnvValue(tokenEnv);
    if(token) headers.Authorization=`Bearer ${token}`;

    const client=target.protocol==="http:" ? http : https;
    const req=client.request(target,{
      method:"GET",
      headers,
      rejectUnauthorized:!INSECURE_TLS,
      timeout:4000
    },response=>{
      let body="";
      response.setEncoding("utf8");
      response.on("data",chunk=>{
        body+=chunk;
        if(body.length>512*1024) req.destroy(new Error("Réponse trop volumineuse"));
      });
      response.on("end",()=>{
        if(response.statusCode<200 || response.statusCode>=300){
          return reject(new Error(`Métriques HTTP ${response.statusCode}`));
        }
        try{
          const data=JSON.parse(body);
          const cpu=Number(data.cpu);
          const ram=Number(data.ram);
          if(!Number.isFinite(cpu) || !Number.isFinite(ram)){
            return reject(new Error("Le JSON doit contenir cpu et ram en pourcentage"));
          }
          resolve({
            cpu:Math.max(0,Math.min(100,cpu)),
            ram:Math.max(0,Math.min(100,ram))
          });
        }catch(error){
          reject(error.message?.includes("cpu et ram") ? error : new Error("Réponse métriques JSON invalide"));
        }
      });
    });
    req.on("timeout",()=>req.destroy(new Error("timeout")));
    req.on("error",reject);
    req.end();
  });
}

function getProxmoxMetrics(host){
  return new Promise((resolve,reject)=>{
    const urlValue=(host.monitoring?.url||"").trim();
    const node=(host.monitoring?.node||"").trim();
    const tokenId=getEnvValue(host.monitoring?.tokenIdEnv,"PROXMOX_TOKEN_ID");
    const tokenSecret=getEnvValue(host.monitoring?.tokenSecretEnv,"PROXMOX_TOKEN_SECRET");

    if(!urlValue) return reject(new Error("URL Proxmox manquante"));
    if(!node) return reject(new Error("Nœud Proxmox manquant"));
    if(!tokenId || !tokenSecret) return reject(new Error("Token Proxmox non configuré"));

    let target;
    try{
      const base=urlValue.replace(/\/+$/,"");
      target=new URL(`${base}/api2/json/nodes/${encodeURIComponent(node)}/status`);
    }catch(_error){
      return reject(new Error("URL Proxmox invalide"));
    }

    const client=target.protocol==="http:" ? http : https;
    const req=client.request(target,{
      method:"GET",
      headers:{
        Authorization:`PVEAPIToken=${tokenId}=${tokenSecret}`,
        Accept:"application/json"
      },
      rejectUnauthorized:!INSECURE_TLS,
      timeout:4000
    },response=>{
      let body="";
      response.setEncoding("utf8");
      response.on("data",chunk=>{
        body+=chunk;
        if(body.length>1024*1024) req.destroy(new Error("Réponse trop volumineuse"));
      });
      response.on("end",()=>{
        if(response.statusCode<200 || response.statusCode>=300){
          return reject(new Error(`Proxmox HTTP ${response.statusCode}`));
        }
        try{
          const payload=JSON.parse(body);
          const data=payload?.data||{};
          const cpu=Number(data.cpu)*100;
          const memory=data.memory||{};
          const used=Number(memory.used);
          const total=Number(memory.total);
          const ram=total>0 ? (used/total)*100 : NaN;

          if(!Number.isFinite(cpu) || !Number.isFinite(ram)){
            return reject(new Error("Métriques Proxmox incomplètes"));
          }

          resolve({
            cpu:Math.max(0,Math.min(100,cpu)),
            ram:Math.max(0,Math.min(100,ram))
          });
        }catch(_error){
          reject(new Error("Réponse Proxmox invalide"));
        }
      });
    });

    req.on("timeout",()=>req.destroy(new Error("timeout")));
    req.on("error",reject);
    req.end();
  });
}

app.get("/api/host-metrics",async(_req,res)=>{
  let config;
  try{
    config=readConfig();
  }catch(error){
    return res.status(500).json({error:"Lecture de config.json impossible"});
  }

  const hosts=Array.isArray(config.hosts)
    ? config.hosts.filter(host=>host?.monitoring?.enabled===true)
    : [];

  const localMetrics=getLocalMetrics();

  const results=await Promise.all(hosts.map(async host=>{
    try{
      const allowedTypes=["local","linux","proxmox"];
      const type=allowedTypes.includes(host.monitoring?.type) ? host.monitoring.type : "local";
      let metrics;
      if(type==="proxmox"){
        metrics=await getProxmoxMetrics(host);
      }else if(type==="linux"){
        metrics=await requestJsonMetrics(
          (host.monitoring?.url||"").trim(),
          (host.monitoring?.tokenEnv||"").trim()
        );
      }else{
        metrics=localMetrics;
      }
      return {
        name:host.name||"Hôte",
        type,
        ok:true,
        cpu:metrics.cpu,
        ram:metrics.ram
      };
    }catch(error){
      return {
        name:host.name||"Hôte",
        type:host.monitoring?.type||"local",
        ok:false,
        error:error.message
      };
    }
  }));

  res.set("Cache-Control","no-store");
  res.json({hosts:results});
});

app.get("/api/status",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json(statusCache);
});

app.use((_req,res)=>{
  res.status(404).json({error:"Route inconnue"});
});

app.use((err,_req,res,_next)=>{
  if(err?.type==="entity.parse.failed"){
    return res.status(400).json({error:"Corps JSON invalide"});
  }
  if(err?.type==="entity.too.large"){
    return res.status(413).json({error:"Fichier trop volumineux"});
  }
  console.error("Erreur serveur:",err.message);
  res.status(500).json({error:"Erreur interne"});
});

// Filet de sécurité : toute exception/réjection échappée est journalisée
// (sinon Node sort en silence et Docker ne voit qu'un restart).
process.on("uncaughtException",error=>{
  console.error(`${ts()} Uncaught exception :`,error);
  process.exit(1);
});
process.on("unhandledRejection",reason=>{
  console.error(`${ts()} Unhandled rejection :`,reason);
  process.exit(1);
});

let httpServer;

function shutdownGraceful(signal){
  console.log(`${ts()} ${signal} reçu, arrêt propre…`);
  clearInterval(statusTimer);
  httpServer.close(()=>{
    console.log(`${ts()} Serveur arrêté proprement.`);
    process.exit(0);
  });
  setTimeout(()=>{
    console.error(`${ts()} Arrêt forcé (délai dépassé).`);
    process.exit(1);
  },10000).unref();
}

process.on("SIGTERM",()=>shutdownGraceful("SIGTERM"));
process.on("SIGINT",()=>shutdownGraceful("SIGINT"));

setTimeout(refreshStatuses,500);
const statusTimer=setInterval(refreshStatuses,STATUS_INTERVAL);

httpServer=app.listen(PORT,"0.0.0.0",()=>{
  console.log(`${ts()} Dashmon : http://0.0.0.0:${PORT}`);
});
