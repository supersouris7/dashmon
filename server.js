// Taille du pool libuv définie avant tout usage async (DNS/fs). 16 threads
// étaient surdimensionnés : la majorité des requêtes attendent sur du réseau
// sortant (pas de blocage du pool). 4 suffisent et réduisent le delta libuv.
process.env.UV_THREADPOOL_SIZE=process.env.UV_THREADPOOL_SIZE||"4";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const httpClient = require("./lib/http");
const { WidgetCore } = require("./lib/widget-core");

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
// Sortie de `wg show all dump` deja ecrite sur disque pour un hote "local".
// Chemin fixe (surchargeable par l'administrateur) : la configuration web ne
// peut donc pas faire lire un fichier arbitraire au serveur.
const WIREGUARD_DUMP_FILE = process.env.WIREGUARD_DUMP_FILE || path.join(DATA_DIR, "wireguard.dump");
// Sortie JSON de `smartctl -j -a`, ecrite par deploy/smart-dump.sh pour les
// disques de l'hote local. Comme pour WireGuard, le chemin n'est jamais choisi
// depuis l'interface web.
const SMART_DUMP_FILE = process.env.SMART_DUMP_FILE || path.join(DATA_DIR, "smart.json");
const APT_UPDATES_REPORT_FILE = process.env.APT_UPDATES_REPORT_FILE || path.join(DATA_DIR, "apt-updates.json");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");
const ICONS_DIR = process.env.ICONS_DIR || path.join(DATA_DIR, "icons");
const THEMES_NATIVE_DIR = process.env.THEMES_NATIVE_DIR || path.join(PUBLIC_DIR, "themes");
const THEMES_CUSTOM_DIR = process.env.THEMES_CUSTOM_DIR || path.join(DATA_DIR, "themes");
const LOGIN_FILE = path.join(PUBLIC_DIR, "login.html");

// Version de release affichee dans le pied de page. Elle suit le tag plutot que
// le champ "version" du paquet, qui reste fige entre deux releases : sur une
// image construite depuis un tag v*, la CI passe DASHMON_RELEASE et le pied de
// page annonce la version publiee.
//
// Un build depuis main — l'image "unstable", celle de la preprod — ne peut pas
// pretendre etre une release, et afficher le numero du paquet serait doublement
// trompeur : fige a 1.0.0 entre deux releases, il laisserait croire que
// l'image tourne a jour alors qu'elle avance a chaque push. On affiche donc
// "unstable", et c'est le commit affiche a cote qui change a chaque build.
const RELEASE = (process.env.DASHMON_RELEASE || "").trim();
const APP_VERSION = /^v?\d+(\.\d+){0,2}([-.][0-9A-Za-z.-]+)?$/.test(RELEASE)
  ? (RELEASE.startsWith("v") ? RELEASE : "v" + RELEASE)
  : "unstable";
// SHA du commit qui a produit l'image (Dockerfile : ARG DASHMON_COMMIT, alimentee
// par la CI). Il est affiche a cote du numero de version pour verifier d'un coup
// d'oeil quelle version tourne apres un "docker pull".
// La valeur vient de l'environnement : elle est validee avant d'atteindre le
// HTML, et un SHA absent ou inattendu ("unknown" par defaut) fait disparaitre
// le suffixe plutot que d'afficher un marqueur trompeur.
const APP_COMMIT = (process.env.DASHMON_COMMIT || "").trim();
const APP_COMMIT_SHORT = /^[0-9a-f]{7,40}$/.test(APP_COMMIT) ? APP_COMMIT.slice(0, 7) : "";
// Le SHA vient de l'IMAGE. Si /app est monte depuis l'hote, le code execute
// n'est pas celui de l'image : afficher ce SHA decrit donc un depot qui n'est
// pas celui-la. Dans ce cas on ne montre que la version plutot qu'une etiquette
// fausse — c'etait exactement ce qui se passait, avec un commit centenaire
// alors que le code etait a jour.
const APP_CODE_MOUNTED = appIsMounted();
const APP_LABEL = APP_COMMIT_SHORT && !APP_CODE_MOUNTED
  ? APP_VERSION + " · " + APP_COMMIT_SHORT
  : APP_VERSION;
// Instant de demarrage : sert a distinguer "l'image est ancienne" de "le
// conteneur tourne depuis le dernier redemarrage sans avoir ete recree".
const STARTED_AT = new Date().toISOString();
// Intervalle de rafraichissement des mesures d'hotes, en secondes. Le client
// lit la valeur injectee dans le HTML ; le serveur s'en sert aussi comme duree
// de cache pour mutualiser les requetes. 60 s par defaut : la page supervision
// n'a pas besoin de plus fin, et cela menage les hotes modestes (Raspberry Pi).
const HOST_METRICS_INTERVAL = (()=>{
  const value = Number(process.env.HOST_METRICS_INTERVAL);
  if(!Number.isFinite(value) || value < 5) return 60000;
  return Math.min(value, 3600) * 1000;
})();
const INDEX_HTML = fs.readFileSync(INDEX_FILE, "utf8")
  .replace(/\{\{VERSION\}\}/g, APP_LABEL)
  .replace(/\{\{HOST_METRICS_INTERVAL\}\}/g, String(HOST_METRICS_INTERVAL));

app.disable("x-powered-by");
app.use(express.json({limit:"1mb",strict:true}));

const pngBody=express.raw({
  type:"image/png",
  limit:"10mb"
});

const INSECURE_TLS = process.env.DASHBOARD_INSECURE_TLS === "1";
const DASHMON_PASSWORD = process.env.DASHMON_PASSWORD || "";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
// Sans mot de passe, Dashmon ne doit pas devenir une interface d'administration
// accessible au reseau. Dans Docker, l'ecoute doit rester disponible pour le
// proxy et le port publie : un mot de passe y est donc obligatoire.
const RUNNING_IN_DOCKER = fs.existsSync("/.dockerenv");
if (RUNNING_IN_DOCKER && !DASHMON_PASSWORD) {
  throw new Error("DASHMON_PASSWORD est obligatoire dans Docker");
}
const DASHBOARD_BIND = DASHMON_PASSWORD ? "0.0.0.0" : "127.0.0.1";
// Delai maximal d'une sonde de statut, partage par le core et les plugins.
const STATUS_TIMEOUT = 4000;

function isSecureRequest(req) {
  return req.secure || req.get("x-forwarded-proto") === "https";
}

function cookieValue(req, name) {
  const prefix = name + "=";
  const match = String(req.get("Cookie") || "").split(";").map(value => value.trim())
    .find(value => value.startsWith(prefix));
  if (!match) return "";
  try { return decodeURIComponent(match.slice(prefix.length)); } catch (_error) { return ""; }
}

function sessionValue(expiresAt, nonce = crypto.randomBytes(18).toString("base64url")) {
  const expires = String(expiresAt);
  const signature = crypto.createHmac("sha256", DASHMON_PASSWORD)
    .update("dashmon-session:" + expires + ":" + nonce).digest("base64url");
  return expires + "." + nonce + "." + signature;
}

function validSession(req) {
  const value = cookieValue(req, "dashmon_session");
  const match = /^(\d{13})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!match || Number(match[1]) < Date.now()) return false;
  const expected = Buffer.from(sessionValue(match[1], match[2]));
  const received = Buffer.from(value);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function validBasicAuth(req) {
  const expected = "Basic " + Buffer.from("admin:" + DASHMON_PASSWORD).toString("base64");
  const received = Buffer.from(req.get("Authorization") || "");
  return received.length === Buffer.byteLength(expected)
    && received.length > 0
    && crypto.timingSafeEqual(received, Buffer.from(expected));
}

function setSessionCookie(req, res, expiresAt) {
  const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const attributes = [
    "dashmon_session=" + encodeURIComponent(sessionValue(expiresAt)),
    "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=" + seconds
  ];
  if (isSecureRequest(req)) attributes.push("Secure");
  res.set("Set-Cookie", attributes.join("; "));
}

// Allowlist des variables d'environnement citables comme source d'un token
// (tokenEnv / tokenIdEnv / tokenSecretEnv d'un hote supervise). Sans elle, un
// champ de configuration pourrait faire lire n'importe quelle variable du
// conteneur (DASHMON_MASTER_KEY, DASHMON_PASSWORD...) et l'envoyer a un hote
// distant. Le defaut couvre les tokens documentes ; DASHBOARD_TOKEN_ENVS,
// separee par des virgules, l'etend pour un agent maison.
const TOKEN_ENV_ALLOWLIST = new Set(
  ["PROXMOX_TOKEN_ID", "PROXMOX_TOKEN_SECRET", "LINUX_METRICS_TOKEN"]
    .concat(String(process.env.DASHBOARD_TOKEN_ENVS || "").split(","))
    .map(name => name.trim())
    .filter(Boolean)
);

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

app.use("/api/status", rateLimitGet);
// /api/host-metrics interroge des hôtes distants (Proxmox, agent Linux) : même
// plafond que /api/status pour qu'un onglet ne puisse pas arroser un hôte.
app.use("/api/host-metrics", rateLimitGet);

if (DASHMON_PASSWORD) {
  app.post("/login", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const expected = Buffer.from(DASHMON_PASSWORD);
    const received = Buffer.from(password);
    const ok = received.length === expected.length && crypto.timingSafeEqual(received, expected);
    if (!ok) return res.status(401).json({ error: "Authentification invalide" });
    setSessionCookie(req, res, Date.now() + SESSION_MAX_AGE);
    res.json({ ok: true });
  });

  app.post("/logout", rateLimit, (req, res) => {
    res.set("Cache-Control", "no-store");
    setSessionCookie(req, res, 0);
    res.json({ ok: true });
  });

  app.use("/api", (req, res, next) => {
    if (validSession(req) || validBasicAuth(req)) return next();
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

// Couleur de tuille : uniquement un hexadecimal, rien d'autre. La valeur part
// dans un attribut style du DOM, donc une couleur "fonctionnelle" (var(...),
// url(...)) serait un vecteur d'injection de CSS. "#" est refuse aussi : on
// n'accepte que la notation que le selecteur de l'editeur produit.
function sanitizeColor(value) {
  const s = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
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

// Secrets de widget chiffrés au repos : clé maîtresse en DASHMON_MASTER_KEY.
// Sans clé, repli sur le stockage en clair (warning au démarrage) pour rester
// utilisable sans configuration.
const MASTER_KEY=String(process.env.DASHMON_MASTER_KEY||"");
const MASTER_KEY_DERIVED=MASTER_KEY
  ? crypto.createHash("sha256").update(MASTER_KEY,"utf8").digest()
  : null;
const SECRET_PREFIX="aes1.";
if(!MASTER_KEY){
  console.warn(`${ts()} ⚠ DASHMON_MASTER_KEY absente : les mots de passe des widgets sont stockés EN CLAIR dans config.json.`);
}

function isEncryptedSecret(value){
  return typeof value==="string" && value.startsWith(SECRET_PREFIX);
}

function encryptSecret(value){
  if(MASTER_KEY_DERIVED===null) return String(value||"");
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",MASTER_KEY_DERIVED,iv);
  const enc=Buffer.concat([cipher.update(String(value||""),"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `${SECRET_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function decryptSecret(value){
  if(!isEncryptedSecret(value)) return String(value||"");
  if(MASTER_KEY_DERIVED===null) return "";
  try{
    const parts=value.slice(SECRET_PREFIX.length).split(".");
    if(parts.length!==3) return "";
    const iv=Buffer.from(parts[0],"base64");
    const tag=Buffer.from(parts[1],"base64");
    const data=Buffer.from(parts[2],"base64");
    const decipher=crypto.createDecipheriv("aes-256-gcm",MASTER_KEY_DERIVED,iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
  }catch(_error){
    return "";
  }
}

// Le core widgets charge le registre, dispatche les checks, gere le cache, les
// frequences, les secrets et la purge. Le core ne connait aucun widget nomme :
// ajouter un widget n'oblige donc jamais a modifier ce fichier.
const statusCache = {};
const widgetCore = new WidgetCore({
  root: ROOT,
  dataDir: DATA_DIR,
  log: message => console.log(`${ts()} ${message}`),
  decryptSecret,
  encryptSecret,
  sanitizeText,
  sanitizeUrl,
  statusCache
});
httpClient.configure({ insecure: INSECURE_TLS, timeout: STATUS_TIMEOUT });

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
      writeConfig({
        services:[],
        categories:[],
        dashboards:[{id:"main",name:"Dashboard",icon:"fa-solid fa-grip"}],
        hosts:[],
        collapsed:{},
        viewMode:"columns",
        openMode:"same",
        groupMode:"category",
        theme:"dark",
        webLinks:[],
        smallIcons:false
      });
    }
  }
}

ensureDataFiles();

function readConfig(){
  const config=JSON.parse(fs.readFileSync(CONFIG_FILE,"utf8"));
  // Les anciens reglages retires ne sont plus exposes ni recopies lors d'une
  // sauvegarde. Le fichier existant reste lisible sans migration destructive.
  for(const key of ["favicon","faviconEnabled","hostsDisplay","webLinksCollapsed"]){
    delete config[key];
  }
  return config;
}

// NOTE : aucun hôte d'exemple n'est injecté — la config est celle de
// l'utilisateur (vide à la première installation), adaptable à tout environnement.

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

  // Ne jamais ecraser une liste de liens existante : une liste vide (liens
  // supprimes volontairement) ou personnalisee doit etre respectee. On
  // n'ajoute les liens par defaut qu'a une installation qui n'a pas de champ.
  if(!Array.isArray(config.webLinks)) config.webLinks=DEFAULT_WEB_LINKS;
  config.webLinksSeedVersion=WEB_LINKS_SEED_VERSION;

  try {
    writeConfig(config);
  } catch (_error) {
    // Ne pas bloquer le démarrage si l'écriture de migration échoue.
  }
}

ensureWebLinksSeeded();

// Identifiants stables des hôtes : le widget Docker référence host.id pour
// survivre au renommage d'un serveur. Attribue un id aux hôtes qui n'en ont
// pas (ex. configs antérieures) et garantit leur unicité.
function ensureHostIds(){
  let config;
  try{
    config=readConfig();
  }catch(_error){
    return;
  }
  if(!Array.isArray(config.hosts)) return;

  let changed=false;
  const used=new Set();
  config.hosts.forEach(host=>{
    const current=String(host&&host.id||"").trim();
    if(!current || current.length>64 || used.has(current)){
      host.id="host-"+crypto.randomBytes(6).toString("hex");
      changed=true;
    }
    used.add(host.id);
  });
  if(changed){
    try{
      writeConfig(config);
    }catch(_error){}
  }
}

ensureHostIds();

app.get("/healthz",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json({ok:true});
});

// Quelle version tourne, reellement. Le pied de page de l'interface est une
// page HTML, donc passe par le cache du navigateur et par celui d'un eventuel
// reverse proxy : y lire la version peut montrer une valeur perimee alors que
// l'image, elle, est a jour. Cette route n'est qu'un objet JSON, jamais mise en
// cache, et elle renvoie aussi la valeur brute du SHA d'image : c'est le seul
// point de controle qui ne puisse pas mentir.
// Le dossier /app vient-il d'un montage de l'hote plutot que de l'image ?
// C'est la cause la plus frequente d'un deploiement ou "le code est a jour
// mais la version affichee reste ancienne" : l'image fournit les variables
// d'environnement (dont le SHA) tandis que le code vient du bind mount, donc
// un git pull sur l'hote change les fichiers sans changer l'etiquette.
// On ne renvoie qu'un booleen : les chemins de l'hote n'ont rien a faire dans
// une reponse d'API. La fonction est declaree ici mais appelee plus haut, pour
// construire le libelle du pied de page des le demarrage.
// Un chemin est-il un point de montage du noyau ? C'est ce qui distingue une
// donnee servie par un volume de ce qui n'est qu'un fichier de l'image. La
// fonction est declaree ici mais appelee plus haut, pour construire le libelle
// du pied de page des le demarrage.
function isMountedPath(target) {
  try {
    const info = fs.readFileSync("/proc/self/mountinfo", "utf8");
    return info.split("\n").some(line => {
      const parts = line.split(" ");
      return parts.length > 4 && parts[4] === target;
    });
  } catch (_error) {
    return null;
  }
}

function appIsMounted() {
  try {
    const info = fs.readFileSync("/proc/self/mountinfo", "utf8");
    return info.split("\n").some(line => {
      const parts = line.split(" ");
      return parts.length > 4 && (parts[4] === "/app" || parts[4].startsWith("/app/"));
    });
  } catch (_error) {
    return null;
  }
}

app.get("/api/version",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json({
    version:APP_VERSION,
    // Le commit de l'IMAGE. A lire avec appMounted : s'il vaut true, il
    // decrit une image qui ne fournit pas le code en cours d'execution.
    commit:APP_COMMIT || "",
    commitShort:APP_COMMIT_SHORT,
    // Le champ "version" du paquet n'est mis a jour qu'a la publication d'un
    // tag : sur une image "unstable" il reste fige, ce qui est sans rapport
    // avec l'etat reel du deploiement.
    packageVersion:require("./package.json").version,
    appMounted:APP_CODE_MOUNTED,
    // true quand /app/data est montee separement. C'est LA question qui decide
    // si l'on peut retirer le montage du code sans perdre la configuration :
    // si les donnees sont a l'interieur du montage /app, les retirer les met
    // hors du conteneur — elles restent sur le disque, mais plus rien ne les
    // sert. Volume et donnees sont donc deux choses distinctes a verifier.
    dataMounted:isMountedPath(DATA_DIR),
    // Reperage de l'emplacement des donnees, utile avant une intervention sur
    // les montages. Aucun chemin hote n'est renvoye : seulement une position
    // dans la hierarchie du conteneur.
    dataPath:DATA_DIR,
    startedAt:STARTED_AT
  });
});

// Publie la cle de statut calculee par le core, sans repasser par la
// serialisation complete : le client ne recompose donc jamais la cle, et les
// deux cotes ne peuvent pas diverger. Le champ n'est jamais persiste car
// buildConfigOutput() ne copie que les champs declares par le manifest.
function withCacheKeys(config){
  const services=Array.isArray(config.services) ? config.services : [];
  return {
    ...config,
    services:services.map(svc=>{
      if(!svc?.widget?.type) return svc;
      return {...svc,widget:{...svc.widget,key:widgetCore.cacheKey(svc)}};
    })
  };
}

app.get("/api/config",(_req,res)=>{
  try{
    res.set("Cache-Control","no-store");
    ensureHostIds();
    res.json(withCacheKeys(readConfig()));
  }catch(error){
    console.error("Lecture config:",error);
    res.status(500).json({error:"Lecture de config.json impossible"});
  }
});

// Registre des widgets installees : metadonnees publiques (schema de config,
// libelles, icone, periode). Ni code serveur, ni secret.
app.get("/api/widgets",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json(widgetCore.publicList());
});

// Code client d'un widget, servi depuis le dossier du widget. Le nom de fichier
// vient exclusivement du manifest valide par le registre : aucune traversée de
// chemin possible et aucun fichier serveur exposé.
app.get("/widget-client/:id.js",(req,res)=>{
  const asset=widgetCore.clientAsset(req.params.id,"js");
  if(!asset) return res.status(404).type("text/plain").send("Introuvable");
  res.set("Cache-Control","public, max-age=300");
  res.type("text/javascript").send(asset.body);
});

app.get("/widget-client/:id.css",(req,res)=>{
  const asset=widgetCore.clientAsset(req.params.id,"css");
  if(!asset) return res.status(404).type("text/plain").send("Introuvable");
  res.set("Cache-Control","public, max-age=300");
  res.type("text/css").send(asset.body);
});

// Un widget installe est serialise depuis son manifest (chiffrement des secrets
// compris) ; un widget inconnu est conserve tel quel, pour ne pas perdre sa
// config si le plugin est momentanement absent.
function serializeWidget(widget){
  if(!widget?.type) return null;
  return widgetCore.has(widget.type)
    ? widgetCore.sanitizeWidget(widget)
    : widgetCore.preserveWidget(widget);
}

// Compteurs du bandeau "Liens web" : un lien peut afficher un chiffre public
// (etoiles GitHub, pulls Docker Hub, abonnes YouTube) a cote de son nom. Les
// types autorises sont exactement les widgets capables de fournir ce chiffre.
// Doit rester identique a public/js/state.js (LINK_COUNTER_TYPES).
const WEB_LINK_COUNTER_TYPES=new Set(["github","dockerhub","youtube"]);

// La cible (depot ou chaine) est obligatoire : un compteur sans cible ne peut
// rien mesurer. Un type inconnu est refuse, le lien reste alors sans compteur.
function sanitizeLinkCounter(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const type=typeof raw.type==="string" ? raw.type.trim() : "";
  if(!WEB_LINK_COUNTER_TYPES.has(type)) return null;
  const target=sanitizeText(raw.target,200);
  if(!target) return null;
  return {type,target};
}

// Tuiles speciales acceptees : une seule active a la fois, d'ou un objet unique.
// Doit rester identique a public/js/state.js (SPECIAL_TILE_TYPES).
const SPECIAL_TILE_TYPES=new Set(["fortune"]);

// Le type inconnu est refuse (la tuile disparait) ; la categorie est obligatoire
// et retombe sur la premiere categorie, ou "Autres" s'il n'y en a aucune.
function sanitizeSpecialTile(raw,categories){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const type=typeof raw.type==="string" ? raw.type : "";
  if(!SPECIAL_TILE_TYPES.has(type)) return null;
  const names=(categories||[]).map(cat=>sanitizeText(cat.name,100)).filter(Boolean);
  const category=sanitizeText(raw.category,100) || names[0] || "Autres";
  return {type,category};
}

// Supervision d'un hote : la source des metriques (local = la machine qui
// heberge Dashmon, linux = un agent HTTP JSON, proxmox = l'API PVE). Les champs
// token portent soit le nom d'une variable d'environnement, soit une valeur
// saisie. Un nom n'est relu que s'il figure dans TOKEN_ENV_ALLOWLIST : un champ
// de configuration ne peut donc pas exposer une variable sensible du conteneur.
const HOST_MONITORING_TYPES = new Set(["local", "linux", "proxmox"]);

function sanitizeHostMonitoring(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return undefined;
  const type = HOST_MONITORING_TYPES.has(raw.type) ? raw.type : "local";
  const monitoring = {
    enabled: raw.enabled === true,
    type,
    url: sanitizeUrl(raw.url || ""),
    node: sanitizeText(raw.node, 50),
    path: sanitizeText(raw.path, 200),
    tokenEnv: sanitizeText(raw.tokenEnv, 100),
    tokenIdEnv: sanitizeText(raw.tokenIdEnv, 100),
    tokenSecretEnv: sanitizeText(raw.tokenSecretEnv, 100)
  };
  // Preferences d'affichage WireGuard : uniquement conservees si elles disent
  // quelque chose (section masquee ou interface filtree), pour ne pas alourdir
  // la configuration avec les valeurs par defaut.
  const wgRaw = raw.wireguard && typeof raw.wireguard === "object" && !Array.isArray(raw.wireguard)
    ? raw.wireguard : null;
  if(wgRaw){
    const wireguard = {
      enabled: wgRaw.enabled !== false,
      interface: sanitizeText(wgRaw.interface, 50)
    };
    if(!wireguard.enabled || wireguard.interface) monitoring.wireguard = wireguard;
  }
  const smartRaw = raw.smart && typeof raw.smart === "object" && !Array.isArray(raw.smart)
    ? raw.smart : null;
  if(smartRaw){
    const disks = Array.isArray(smartRaw.disks)
      ? [...new Set(smartRaw.disks.map(value=>sanitizeText(value,100)).filter(Boolean))].slice(0,20)
      : [];
    const smart = { enabled: smartRaw.enabled !== false, disks };
    if(!smart.enabled || smart.disks.length) monitoring.smart = smart;
  }
  if(raw.aptUpdates && typeof raw.aptUpdates==="object" && !Array.isArray(raw.aptUpdates)){
    const aptUpdates={enabled:raw.aptUpdates.enabled!==false};
    if(!aptUpdates.enabled) monitoring.aptUpdates=aptUpdates;
  }
  // Un hote sans supervision activee et sans aucun parametre ne garde pas un
  // objet vide dans config.json : la config reste lisible.
  const meaningful = monitoring.url || monitoring.node || monitoring.path
    || monitoring.tokenEnv || monitoring.tokenIdEnv || monitoring.tokenSecretEnv
    || monitoring.wireguard || monitoring.smart || monitoring.aptUpdates;
  if(!monitoring.enabled && !meaningful) return undefined;
  return monitoring;
}

function buildConfigOutput(config){
  // Dashboards et categories partagent un lien obligatoire : une categorie
  // appartient a un dashboard. On resout donc d'abord la liste des dashboards
  // (toujours au moins un), puis on y rattache chaque categorie. Un
  // identifiant de dashboard vide, reserve ("supervision") ou duplique est
  // regenere, comme pour les hotes.
  const dashboards=(Array.isArray(config.dashboards) ? config.dashboards : [])
    .slice(0,20)
    .map(d=>({
      id:sanitizeText(d && d.id,64),
      name:sanitizeText(d && d.name,100),
      icon:sanitizeIconClass(d && d.icon)
    }))
    .filter(d=>d.name)
    .reduce((list,d)=>{
      let id=d.id;
      const reserved=id==="supervision";
      if(!id || reserved || list.some(item=>item.id===id)){
        id="dashboard-"+crypto.randomBytes(4).toString("hex");
      }
      list.push({id,name:d.name,icon:d.icon});
      return list;
    },[]);
  if(!dashboards.length){
    dashboards.push({id:"main",name:"Dashboard",icon:"fa-solid fa-grip"});
  }
  const dashboardIds=new Set(dashboards.map(d=>d.id));
  const categories=Array.isArray(config.categories)
    ? config.categories.slice(0,50).map(cat=>({
        name:sanitizeText(cat.name,100),
        icon:sanitizeIconClass(cat.icon),
        color:sanitizeColor(cat.color),
        dashboardId:dashboardIds.has(sanitizeText(cat.dashboardId,64)) ? sanitizeText(cat.dashboardId,64) : dashboards[0].id
      }))
    : [];
  return {
      services:Array.isArray(config.services)
        ? config.services.slice(0,200).map(svc=>({
            name:sanitizeText(svc.name,100),
            host:sanitizeText(svc.host,100),
            category:sanitizeText(svc.category,100),
            url:sanitizeUrl(svc.url),
            icon:sanitizeImagePath(svc.icon),
            monitor:svc.monitor===false ? false : svc.monitor==="soft" ? "soft" : true,
            widget:serializeWidget(svc.widget)
          }))
        : [],
      categories,
      dashboards,
      // Tuile speciale unique du tableau de bord, placee dans une categorie.
      // Le type est verifie contre la liste blanche ; la categorie est
      // obligatoire, on retombe sur la premiere definie faute de mieux.
      specialTile:sanitizeSpecialTile(config.specialTile,categories),
      hosts:Array.isArray(config.hosts)
        ? config.hosts.slice(0,50).map(host=>{
            return {
              id:sanitizeText(host.id,64) || "host-"+crypto.randomBytes(6).toString("hex"),
              name:sanitizeText(host.name,100),
              icon:sanitizeIconClass(host.icon),
              color:sanitizeColor(host.color),
              monitoring:sanitizeHostMonitoring(host.monitoring)
            };
          })
        : [],
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
            icon:sanitizeIconClass(link.icon),
            counter:sanitizeLinkCounter(link.counter)
          }))
        : [],
      webLinksSeedVersion:Number.isFinite(Number(config.webLinksSeedVersion))
        ? Number(config.webLinksSeedVersion) : 0,
      webLinksColor:config.webLinksColor==="pastel-red" ? "red"
        : ["dark","red","blue","green","orange","purple"].includes(config.webLinksColor)
          ? config.webLinksColor : "dark",
      smallIcons:config.smallIcons===true
  };
}

function writeConfig(output){
  const payload=JSON.stringify(output,null,2)+"\n";
  const temporary=`${CONFIG_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try{
    fs.writeFileSync(temporary,payload,"utf8");
    fs.renameSync(temporary,CONFIG_FILE);
  }finally{
    try{ fs.unlinkSync(temporary); }catch(_error){}
  }
}

app.put("/api/config",(req,res)=>{
  try{
    const config=req.body;
    if(!config || typeof config!=="object" || Array.isArray(config)){
      return res.status(400).json({error:"Configuration invalide"});
    }
    writeConfig(buildConfigOutput(config));
    res.json({ok:true});
  }catch(error){
    console.error("Écriture config:",error);
    res.status(500).json({error:"Écriture de config.json impossible"});
  }
});

app.patch("/api/config",(req,res)=>{
  try{
    const patch=req.body;
    if(!patch || typeof patch!=="object" || Array.isArray(patch)){
      return res.status(400).json({error:"Correctif de configuration invalide"});
    }
    const config=readConfig();
    for(const key of Object.keys(patch)){
      config[key]=patch[key];
    }
    writeConfig(buildConfigOutput(config));
    res.json({ok:true});
  }catch(error){
    console.error("Écriture config (patch):",error);
    res.status(500).json({error:"Écriture de config.json impossible"});
  }
});

// Incrément du compteur d'utilisation depuis un clic. Route légère (petit corps)
// compatible avec la navigation de page (sendBeacon/keepalive) ; écriture
// synchrone pour rester atomique face aux PUT /api/config simultanés.
app.post("/api/usage",(req,res)=>{
  try{
    const key=req.body && typeof req.body.key==="string" ? req.body.key.trim() : "";
    if(!key || key.length>200) return res.status(400).json({error:"Clé invalide"});

    const config=readConfig();
    config.usageCounts=config.usageCounts && typeof config.usageCounts==="object" && !Array.isArray(config.usageCounts)
      ? config.usageCounts : {};
    const n=Number(config.usageCounts[key]);
    config.usageCounts[key]=Number.isFinite(n)&&n>=0 ? Math.floor(n)+1 : 1;

    writeConfig(config);
    res.json({ok:true});
  }catch(error){
    console.error("Incrément usage:",error);
    res.status(500).json({error:"Incrément du compteur impossible"});
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
      console.warn(`${ts()} Import image rejeté : corps vide ou trop court`);
      return res.status(400).json({error:"Image PNG invalide"});
    }

    const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    if(!req.body.subarray(0,8).equals(signature)){
      console.warn(`${ts()} Import image rejeté : signature PNG absente`);
      return res.status(400).json({error:"Le fichier n'est pas un PNG valide"});
    }

    const {width,height}=parsePngSize(req.body);
    const MAX_IMG_DIM=8192;
    const MAX_IMG_PIXELS=64*1024*1024;
    if(!width || !height || width>MAX_IMG_DIM || height>MAX_IMG_DIM || width*height>MAX_IMG_PIXELS){
      console.warn(`${ts()} Import image rejeté : PNG trop grand (${width}×${height})`);
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
    console.log(`${ts()} Image importée : ${filename} (${req.body.length} octets)`);
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
    console.log(`${ts()} Image supprimée : ${filename}`);
    res.json({ok:true,file:filename});
  }catch(error){
    console.error("Suppression image:",error);
    res.status(500).json({error:"Suppression de l'image impossible"});
  }
});

app.use("/icons",express.static(ICONS_DIR,{dotfiles:"deny",index:false,maxAge:"5m"}));

const THEME_REQUIRED_VARS=["bg","surface","surface-2","surface-3","border","text","muted","accent","danger","shadow"];
const THEME_OPTIONAL_VARS=["success","error"];

function sanitizeThemeId(raw){
  return String(raw||"").trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

// Doit rester identique à public/js/themes.js (sanitizeVarValue) : sans blocage
// identique, une valeur comme `red} body{display:none` casserait la règle
// [data-theme] injectée et s'appliquerait à tous les visiteurs.
function sanitizeVarValue(value){
  return String(value||"").trim()
    .replace(/[\{\}\;\n\r\"\'\<\>\\]/g,"")
    .slice(0,200);
}

function sanitizeThemeCss(css){
  const s=String(css||"").slice(0,65536);
  let out=s.replace(/<\s*\/?style/gi,"");
  out=out.replace(/@(import|charset|font-face)\b/gi,"");
  out=out.replace(/url\s*\(/gi,"none");
  out=out.replace(/(expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:)/gi,"");
  return out;
}

function normalizeThemeObject(input){
  if(!input || typeof input!=="object" || Array.isArray(input)) return null;
  const id=sanitizeThemeId(input.id||input.name);
  if(!id) return null;

  const variables=input.variables||{};
  const clean={};
  for(const key of THEME_REQUIRED_VARS){
    const value=variables[key];
    if(typeof value==="string" && value.trim()) clean[key]=sanitizeVarValue(value);
  }
  if(Object.keys(clean).length!==THEME_REQUIRED_VARS.length) return null;

  // Variables sémantiques optionnelles (couleurs de statut) : sinon le thème
  // hérite des défauts CSS (--success/--error).
  for(const key of THEME_OPTIONAL_VARS){
    const value=variables[key];
    if(typeof value==="string" && value.trim()) clean[key]=sanitizeVarValue(value).slice(0,40);
  }

  return {
    id,
    name:String(input.name||id).trim().slice(0,80),
    author:String(input.author||"").trim().slice(0,80),
    description:String(input.description||"").trim().slice(0,300),
    version:String(input.version||"1.0.0").trim().slice(0,20),
    variables:clean,
    css:sanitizeThemeCss(typeof input.css==="string" ? input.css : "")
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
    if(!normalized){
      console.warn(`${ts()} Import thème rejeté : JSON invalide ou variables manquantes`);
      return res.status(400).json({error:"Thème invalide : id et les 10 variables requises sont obligatoires"});
    }

    if(normalized.css && normalized.css.length > 65536){
      console.warn(`${ts()} Import thème rejeté : CSS trop volumineux (${normalized.css.length} octets)`);
      return res.status(400).json({error:"CSS trop volumineux (max 64 Ko)"});
    }

    const nativeConflict=fs.existsSync(path.join(THEMES_NATIVE_DIR,normalized.id+".json"));
    if(nativeConflict){
      console.warn(`${ts()} Import thème rejeté : « ${normalized.id} » réservé par un thème natif`);
      return res.status(409).json({error:`L'identifiant « ${normalized.id} » est réservé par un thème natif`});
    }

    const target=path.join(THEMES_CUSTOM_DIR,normalized.id+".json");
    fs.writeFileSync(target,JSON.stringify(normalized,null,2)+"\n","utf8");

    console.log(`${ts()} Thème importé : ${normalized.id}.json`);
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
    console.log(`${ts()} Thème supprimé : ${id}.json`);
    res.json({ok:true});
  }catch(error){
    console.error("Suppression thème:",error);
    res.status(500).json({error:"Suppression du thème impossible"});
  }
});

app.get("/login",(req,res)=>{
  if (!DASHMON_PASSWORD || validSession(req) || validBasicAuth(req)) return res.redirect("/");
  res.set("Cache-Control","no-store");
  res.sendFile(LOGIN_FILE);
});

app.get(["/","/index.html"],(req,res)=>{
  if (DASHMON_PASSWORD && !validSession(req) && !validBasicAuth(req)) return res.redirect("/login");
  // La page doit toujours etre revalidee : elle porte le libelle de version du
  // pied de page et les references des scripts. Sans cet en-tete, un
  // navigateur garde le HTML en cache et affiche une version perimee alors que
  // les scripts, eux, sont bien charges a jour. Les routes API sont deja en
  // no-store pour la meme raison.
  res.set("Cache-Control","no-store");
  res.type("html").send(INDEX_HTML);
});
app.use(express.static(PUBLIC_DIR));

const STATUS_INTERVAL = 60000;

// Frequence de re-verification et cle de cache : deleguees au registre, qui lit
// la periode declaree dans le manifest.json de chaque widget.
function checkInterval(svc){
  return widgetCore.interval(svc);
}
function serviceCacheKey(svc){
  return widgetCore.cacheKey(svc);
}

// Un service est couvert par un plugin : son widget s'il en a un, sinon le
// plugin qui revendique le slot "link" (les liens web). Le core n'a plus de
// sonde codee en dur, donc ajouter un type de lien est une question de plugin.
async function checkService(service){
  if(widgetCore.handles(service)){
    await widgetCore.check(service);
    return;
  }
  // Aucun plugin ne sait surveiller ce service (widget d'un plugin absent, ou
  // plugin de lien non installé) : on ne publie rien plutot qu'un faux etat.
  if(!service.url || service.monitor===false) return;
  if(service.widget?.type) return;
  console.warn(`${ts()} Aucun plugin ne surveille ${service.url} — lien non contrôlé`);
}

// Service virtuel pour un lien web porteur d'un compteur : le bandeau emprunte
// le backend du widget correspondant (github/dockerhub/youtube), donc le core
// ne connait aucun nouveau type de sonde. Le chiffre atterrit dans statusCache
// sous la cle de l'URL du lien, que le client relit pour l'afficher.
function linkCounterService(link){
  const counter=link && link.counter;
  const url=link && sanitizeUrl(link.url);
  if(!counter || !url) return null;
  if(counter.type==="github") return {url,widget:{type:"github",repo:counter.target,metric:"stars"}};
  if(counter.type==="dockerhub") return {url,widget:{type:"dockerhub",repo:counter.target}};
  if(counter.type==="youtube") return {url,widget:{type:"youtube",username:counter.target}};
  return null;
}

function linkCounterServices(config){
  const links=Array.isArray(config.webLinks) ? config.webLinks : [];
  return links.map(linkCounterService).filter(Boolean);
}

let statusRefreshInflight=null;
let statusRefreshForced=false;

async function refreshStatuses(force=false){
  // Un cycle peut inclure plusieurs sondes lentes. Les minuteurs et le bouton
  // manuel partagent donc le meme travail; un clic manuel demande un cycle force
  // juste apres le cycle courant au lieu d'ouvrir une seconde salve en parallele.
  if(statusRefreshInflight){
    if(force) statusRefreshForced=true;
    return statusRefreshInflight;
  }

  const refresh=(async()=>{
    let shouldForce=force;
    do{
      statusRefreshForced=false;
      await refreshStatusesCycle(shouldForce);
      shouldForce=statusRefreshForced;
    }while(shouldForce);
  })();
  statusRefreshInflight=refresh;
  try{
    await refresh;
  }finally{
    if(statusRefreshInflight===refresh) statusRefreshInflight=null;
  }
}

async function refreshStatusesCycle(force){
  let config;
  try{
    config=readConfig();
  }catch(_error){
    return;
  }

  const services=Array.isArray(config.services) ? config.services : [];
  // Les liens web porteurs d'un compteur sont surveilles comme des services
  // virtuels : meme boucle, meme cache, meme purge. Sans quoi leur entree de
  // statut serait purgee a chaque cycle et le compteur disparaitrait du bandeau.
  const monitored=services.concat(linkCounterServices(config));
  // Purge des entrées de cache devenues orphelines et des mémoires internes
  // des widgets (jetons, historiques) : chaque widget purge ce qu'il veut via
  // son hook purge(), le core ne connaît aucun widget.
  widgetCore.purge(monitored);
  const candidates=force ? monitored : monitored.filter(svc=>{
    const cache=statusCache[serviceCacheKey(svc)];
    return !(cache && cache.lastCheck && (Date.now()-cache.lastCheck) < checkInterval(svc));
  });
  // Les widgets a cle de configuration (Docker, par exemple) peuvent etre
  // affiches plusieurs fois. Une seule sonde suffit par cle et evite de frapper
  // la meme API ou le meme registre en parallele.
  const due=[];
  const seen=new Set();
  for(const svc of candidates){
    const key=serviceCacheKey(svc);
    if(seen.has(key)) continue;
    seen.add(key);
    due.push(svc);
  }
  // Checks par lots de 3 espacés : évite les rafales de connexions en gardant
  // un cycle de rafraîchissement raisonnable.
  for(let i=0;i<due.length;i+=3){
    await Promise.all(due.slice(i,i+3).map(svc=>checkService(svc)));
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  // Marque la dernière vérification de chaque service traité.
  due.forEach(svc=>{
    const cache=statusCache[serviceCacheKey(svc)];
    if(cache) cache.lastCheck=Date.now();
  });
}

// --- Supervision des hotes ------------------------------------------------
// CPU, RAM, temperature et disque d'un hote. Trois sources :
//   local   : la machine qui heberge le conteneur (os, /sys, statfs) ;
//   linux   : un agent HTTP renvoyant un JSON { cpu, ram, temperature, disk } ;
//   proxmox : l'API PVE (token) ; le noeud en ligne est auto-detecte.
// Chaque valeur est un pourcentage 0..100, sauf la temperature en degres. Une
// metrique indisponible vaut null (affichee "—") : zero est une mesure, son
// absence n'en est pas une, et les confondre ferait croire a un hote au repos.

function clampPercent(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return null;
  return Math.max(0,Math.min(100,n));
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

// CPU par difference entre deux lectures : os.cpus() ne donne que des compteurs
// cumules, la charge instantanee nait donc du delta entre deux appels.
function localCpuPercent(){
  const current=readCpuTimes();
  const idleDelta=current.idle-previousCpuTimes.idle;
  const totalDelta=current.total-previousCpuTimes.total;
  previousCpuTimes=current;
  if(!(totalDelta>0)) return null;
  return clampPercent((1-(idleDelta/totalDelta))*100);
}

function localRamPercent(){
  const total=os.totalmem();
  const free=os.freemem();
  if(!(total>0)) return null;
  return clampPercent(((total-free)/total)*100);
}

// Capteur thermique lu dans /sys : thermal_zone* (millidegres) ou hwmon. On
// retient la valeur plausible la plus haute. Tout est enclos : sur un noyau ou
// un conteneur sans /sys expose, la fonction renvoie null sans bruit.
function localTemperature(){
  const readings=[];
  const readDir=dir=>{
    try{ return fs.readdirSync(dir); }catch(_error){ return []; }
  };
  const push=file=>{
    try{
      const raw=Number(fs.readFileSync(file,"utf8").trim());
      if(!Number.isFinite(raw)) return;
      // Les capteurs se lisent en millidegres (52000 = 52 °C). Un nombre deja
      // en degres ne depasse pas 200 : c'est ce seuil qui distingue les deux.
      const celsius=Math.abs(raw)>200 ? raw/1000 : raw;
      if(celsius>0 && celsius<150) readings.push(celsius);
    }catch(_error){}
  };
  for(const zone of readDir("/sys/class/thermal")){
    if(/^thermal_zone\d+$/.test(zone)) push(`/sys/class/thermal/${zone}/temp`);
  }
  for(const hw of readDir("/sys/class/hwmon")){
    for(const entry of readDir(`/sys/class/hwmon/${hw}`)){
      if(/^temp\d+_input$/.test(entry)) push(`/sys/class/hwmon/${hw}/${entry}`);
    }
  }
  if(!readings.length) return null;
  return Math.round(Math.max(...readings)*10)/10;
}

// Pourcentage occupe du systeme de fichiers porte par "path". Par defaut la
// racine du conteneur ; pour lire le disque reel de l'hote, il faut monter son
// systeme de fichiers dans le conteneur et pointer ce chemin dessus (voir
// deploy/DEPLOYMENT.md). bavail (et non bfree) exclut l'espace reserve root,
// comme le fait "df".
function localDiskPercent(target){
  const value=String(target||"").trim()||"/";
  try{
    const stats=fs.statfsSync(value);
    const total=Number(stats.blocks);
    const available=Number(stats.bavail);
    if(!(total>0)) return null;
    return clampPercent(((total-available)/total)*100);
  }catch(_error){
    return null;
  }
}

// Lecture d'un token : un nom present dans l'allowlist designe une variable
// d'environnement, toute autre valeur est un secret colle dans l'editeur et
// utilise tel quel. Un nom hors allowlist ne peut donc pas faire exfiltrer une
// variable sensible du conteneur.
function resolveTokenValue(name){
  const candidate=String(name||"").trim();
  if(!candidate) return "";
  if(TOKEN_ENV_ALLOWLIST.has(candidate)) return String(process.env[candidate]||"");
  return candidate;
}

function envToken(name,fallbackName){
  const direct=resolveTokenValue(name);
  if(direct) return direct;
  const fallback=String(fallbackName||"").trim();
  return TOKEN_ENV_ALLOWLIST.has(fallback) ? String(process.env[fallback]||"") : "";
}

function pickPercent(...candidates){
  for(const candidate of candidates){
    const n=Number(candidate);
    if(Number.isFinite(n)) return clampPercent(n);
  }
  return null;
}

function pickTemperature(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return null;
  return Math.round(n*10)/10;
}

// WireGuard via l'agent Linux : l'agent renvoie les pairs qu'il a lus (par
// exemple avec "wg show all dump"). On accepte une interface unique, une liste
// d'interfaces, ou { interfaces: [...] }. Tout ce qui s'affiche est du texte :
// les valeurs sont bornees et normalisees ici, jamais interpretees comme du
// HTML. Un agent qui n'envoie pas le champ reste simplement sans section.
const WG_MAX_INTERFACES=10;
const WG_MAX_PEERS=200;

// Dernier handshake : nombre de secondes epoch, millisecondes epoch (les
// valeurs > 1e12 ne peuvent pas etre des secondes), ou date ISO. Toute valeur
// douteuse devient null : "jamais" est une information, une fausse date non.
function handshakeSeconds(value){
  if(value===null || value===undefined || value==="") return null;
  let n=Number(value);
  if(!Number.isFinite(n)){
    const parsed=Date.parse(String(value));
    if(!Number.isFinite(parsed)) return null;
    n=parsed/1000;
  }else if(n>1e12){
    n=n/1000;
  }
  if(!Number.isFinite(n) || n<=0) return null;
  return Math.floor(n);
}

function normalizeWireguardPeer(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  // Un compteur absent vaut null ("—"), pas zero : zero octet est une mesure.
  const byteCount=value=>{
    if(value===null || value===undefined || value==="") return null;
    const n=Number(value);
    return Number.isFinite(n)&&n>=0 ? Math.floor(n) : null;
  };
  const peer={
    name:sanitizeText(raw.name || raw.publicKey || raw.public_key,80),
    endpoint:sanitizeText(raw.endpoint,120),
    latestHandshake:handshakeSeconds(
      raw.latestHandshake !== undefined ? raw.latestHandshake : raw.latest_handshake
    ),
    rx:byteCount(raw.rx),
    tx:byteCount(raw.tx)
  };
  if(typeof raw.connected==="boolean") peer.connected=raw.connected;
  return peer;
}

function normalizeWireguardInterface(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const peers=(Array.isArray(raw.peers) ? raw.peers : [])
    .slice(0,WG_MAX_PEERS)
    .map(normalizeWireguardPeer)
    .filter(Boolean);
  return {
    interface:sanitizeText(raw.interface || raw.name || raw.iface,50),
    peers
  };
}

function normalizeWireguard(raw){
  if(!raw || typeof raw!=="object") return null;
  let list;
  if(Array.isArray(raw)) list=raw;
  else if(Array.isArray(raw.interfaces)) list=raw.interfaces;
  else list=[raw];
  const interfaces=list.slice(0,WG_MAX_INTERFACES)
    .map(normalizeWireguardInterface)
    .filter(Boolean);
  return interfaces.length ? interfaces : null;
}

// Hote "local" : les pairs viennent d'un fichier contenant la sortie de
// `wg show all dump`, depose par un cron/timer sur l'hote et monte dans le
// conteneur. Aucune capability n'est necessaire, et le format ne contient pas de
// nom de pair : la cle publique sert de nom. Un fichier absent ou illisible est
// simplement ignore (pas de section WireGuard sur la carte). Un fichier vide
// reste une releve valide : la carte indique alors qu'aucun pair n'est declare.
function readWireguardDump(){
  let stat;
  try{
    stat=fs.statSync(WIREGUARD_DUMP_FILE);
  }catch(_error){
    return null;
  }
  if(!stat.isFile() || stat.size>1_000_000) return null;
  let text;
  try{
    text=fs.readFileSync(WIREGUARD_DUMP_FILE,"utf8");
  }catch(_error){
    return null;
  }
  const byInterface=new Map();
  for(const line of text.split(/\r?\n/)){
    if(!line) continue;
    const fields=line.split("\t");
    const name=fields[0]||"";
    if(!name) continue;
    // Une ligne d'interface a 5 champs, une ligne de pair en a 9.
    if(fields.length>=9){
      const entry=byInterface.get(name) || {interface:name,peers:[]};
      byInterface.set(name,entry);
      const handshake=Number(fields[5]);
      entry.peers.push({
        name:fields[1],
        endpoint:fields[3]==="(none)" ? "" : fields[3],
        latestHandshake:Number.isFinite(handshake)&&handshake>0 ? handshake : null,
        rx:fields[6],
        tx:fields[7]
      });
    }else if(!byInterface.has(name)){
      byInterface.set(name,{interface:name,peers:[]});
    }
  }
  // L'heure de derniere modification du fichier date le dernier cron : c'est
  // l'info "dernier releve" affichee par la page supervision.
  const fetchedAt=Math.floor(stat.mtimeMs/1000);
  return {
    interfaces:normalizeWireguard([...byInterface.values()])||[],
    fetchedAt:Number.isFinite(fetchedAt)&&fetchedAt>0 ? fetchedAt : null
  };
}

// Le script SMART conserve le JSON brut de smartctl : les noms de modele et les
// compteurs restent exploitables sans exposer le numero de serie du disque.
function smartNumber(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0 ? Math.floor(n) : null;
}

function smartAttribute(raw,id){
  const table=Array.isArray(raw?.ata_smart_attributes?.table) ? raw.ata_smart_attributes.table : [];
  const attribute=table.find(item=>Number(item?.id)===id);
  return smartNumber(attribute?.raw?.value);
}

function normalizeSmartDisk(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const device=sanitizeText(raw.device?.name || raw.name,100);
  if(!device) return null;
  const nvme=raw.nvme_smart_health_information_log||{};
  const temperature=smartNumber(raw.temperature?.current ?? nvme.temperature);
  const powerOnHours=smartNumber(raw.power_on_time?.hours ?? nvme.power_on_hours);
  const smartErrors=smartNumber(raw.ata_smart_error_log?.summary?.count ?? nvme.num_err_log_entries);
  return {
    device,
    model:sanitizeText(raw.model_name || raw.model_family || raw.device?.type,100),
    passed:typeof raw.smart_status?.passed==="boolean" ? raw.smart_status.passed : null,
    temperature,
    powerOnHours,
    reallocated:smartAttribute(raw,5),
    pending:smartAttribute(raw,197),
    uncorrectable:smartAttribute(raw,198),
    sataCrc:smartAttribute(raw,199),
    smartErrors,
    loadCycle:smartAttribute(raw,193)
  };
}

function readSmartDump(){
  let stat;
  try{
    stat=fs.statSync(SMART_DUMP_FILE);
  }catch(_error){
    return null;
  }
  if(!stat.isFile() || stat.size>2_000_000) return null;
  let source;
  try{
    source=JSON.parse(fs.readFileSync(SMART_DUMP_FILE,"utf8"));
  }catch(_error){
    return null;
  }
  const rawDisks=Array.isArray(source?.disks) ? source.disks : [];
  const disks=rawDisks.map(normalizeSmartDisk).filter(Boolean).slice(0,20);
  if(!disks.length) return null;
  const updatedAt=smartNumber(source.updatedAt);
  const fetchedAt=updatedAt || Math.floor(stat.mtimeMs/1000);
  return { disks, fetchedAt:Number.isFinite(fetchedAt)&&fetchedAt>0 ? fetchedAt : null };
}

function readAptUpdatesReport(){
  let stat;
  try{ stat=fs.statSync(APT_UPDATES_REPORT_FILE); }catch(_error){ return null; }
  if(!stat.isFile() || stat.size>100000) return null;
  let raw;
  try{ raw=JSON.parse(fs.readFileSync(APT_UPDATES_REPORT_FILE,"utf8")); }catch(_error){ return null; }
  if(!raw || (raw.status!=="success" && raw.status!=="failed")) return null;
  return {
    status:raw.status,
    updated:smartNumber(raw.updated)||0,
    rebootRequired:raw.rebootRequired===true,
    rebootRequested:raw.rebootRequested===true,
    finishedAt:smartNumber(raw.finishedAt)||Math.floor(stat.mtimeMs/1000)
  };
}

// Contrat de l'agent Linux : un JSON simple, chaque champ facultatif. Un champ
// absent ou invalide devient null plutot qu'un zero trompeur.
function normalizeMetricsPayload(data){
  const source=data && typeof data==="object" ? data : {};
  return {
    cpu:pickPercent(source.cpu),
    ram:pickPercent(source.ram),
    temperature:pickTemperature(source.temperature === undefined ? source.temp : source.temperature),
    disk:pickPercent(source.disk),
    wireguard:normalizeWireguard(source.wireguard)
  };
}

async function readHttpMetrics(host){
  const url=String(host.monitoring?.url||"").trim();
  if(!url) throw new Error("URL de mesures manquante");
  const token=resolveTokenValue(host.monitoring?.tokenEnv);
  const data=await httpClient.apiRequest(url,"",{ token:token||undefined });
  return normalizeMetricsPayload(data);
}

function proxmoxRequest(base,tokenId,tokenSecret,apiPath){
  return httpClient.apiRequest(base,apiPath,{
    headers:{ Authorization:`PVEAPIToken=${tokenId}=${tokenSecret}` }
  });
}

async function getProxmoxMetrics(host){
  const base=String(host.monitoring?.url||"").trim().replace(/\/+$/,"");
  if(!base) throw new Error("URL Proxmox manquante");
  const tokenId=envToken(host.monitoring?.tokenIdEnv,"PROXMOX_TOKEN_ID");
  const tokenSecret=envToken(host.monitoring?.tokenSecretEnv,"PROXMOX_TOKEN_SECRET");
  if(!tokenId || !tokenSecret) throw new Error("Token Proxmox non configure");

  let node=String(host.monitoring?.node||"").trim();
  let nodes=[];
  try{
    const list=await proxmoxRequest(base,tokenId,tokenSecret,"/api2/json/nodes");
    nodes=Array.isArray(list?.data) ? list.data : [];
  }catch(_error){
    nodes=[];
  }
  // Noeud : celui configure s'il existe encore, sinon le premier en ligne, sinon
  // "pve" (l'API tranchera). Un noeud renomme ne bloque donc pas la mesure.
  const online=nodes.filter(entry=>entry?.status==="online");
  const configured=nodes.some(entry=>String(entry.node||"")===node) ? node : "";
  node=configured || (online.length ? String(online[0].node||"").trim() : "") || "pve";

  const payload=await proxmoxRequest(base,tokenId,tokenSecret,
    `/api2/json/nodes/${encodeURIComponent(node)}/status`);
  const data=payload?.data||{};
  const memory=data.memory||{};
  const rootfs=data.rootfs||{};
  const memTotal=Number(memory.total);
  const memUsed=Number(memory.used);
  const diskTotal=Number(rootfs.total);
  const diskUsed=Number(rootfs.used);
  return {
    cpu:clampPercent(Number(data.cpu)*100),
    ram:memTotal>0 ? clampPercent((memUsed/memTotal)*100) : null,
    // PVE n'expose pas la temperature d'un noeud via son API JSON : la valeur
    // reste indisponible plutot que d'etre inventee.
    temperature:null,
    disk:diskTotal>0 ? clampPercent((diskUsed/diskTotal)*100) : null
  };
}

const HOST_METRICS_TTL=HOST_METRICS_INTERVAL;
let hostMetricsCache={ts:0,payload:null};
let hostMetricsInflight=null;

app.get("/api/host-metrics",async(_req,res)=>{
  res.set("Cache-Control","no-store");

  if(hostMetricsCache.payload && Date.now()-hostMetricsCache.ts < HOST_METRICS_TTL){
    return res.json(hostMetricsCache.payload);
  }
  // Deduplication : plusieurs navigateurs simultanes partagent une seule salve
  // de mesures plutot que d'interroger chaque hote une fois par onglet.
  if(hostMetricsInflight){
    try{ return res.json(await hostMetricsInflight); }
    catch(_error){ return res.status(500).json({error:"Lecture des mesures impossible"}); }
  }

  let config;
  try{
    config=readConfig();
  }catch(_error){
    return res.status(500).json({error:"Lecture de config.json impossible"});
  }

  const hosts=(Array.isArray(config.hosts) ? config.hosts : [])
    .filter(host=>host?.monitoring?.enabled===true);

  // Les mesures locales sont lues une seule fois : deux hotes "local" designent
  // la meme machine, on ne consomme donc le delta CPU qu'une fois par requete.
  const localCpu=localCpuPercent();
  const localRam=localRamPercent();
  const localTemp=localTemperature();
  const localDump=readWireguardDump();
  const localSmart=readSmartDump();
  const localAptUpdates=hosts.some(host=>host.monitoring?.enabled && host.monitoring.type==="local" && host.monitoring.aptUpdates?.enabled!==false)
    ? readAptUpdatesReport()
    : null;

  const refresh=Promise.all(hosts.map(async host=>{
    const type=HOST_MONITORING_TYPES.has(host.monitoring?.type) ? host.monitoring.type : "local";
    try{
      let metrics;
      let wireguardFetchedAt=null;
      let smartFetchedAt=null;
      if(type==="proxmox") metrics=await getProxmoxMetrics(host);
      else if(type==="linux") metrics=await readHttpMetrics(host);
      else {
        // Le dump local est le meme pour tous les hotes "local" : on le lit une
        // fois et on date chaque copie de l'heure du fichier.
        metrics={
          cpu:localCpu, ram:localRam, temperature:localTemp, disk:localDiskPercent(host.monitoring?.path),
          wireguard:localDump?.interfaces||null, smart:localSmart?.disks||null,
          aptUpdates:localAptUpdates
        };
        wireguardFetchedAt=localDump?.fetchedAt||null;
        smartFetchedAt=localSmart?.fetchedAt||null;
      }
      return {
        id:sanitizeText(host.id,64),
        name:sanitizeText(host.name,100)||"Hote",
        type,
        ok:true,
        cpu:metrics.cpu,
        ram:metrics.ram,
        temperature:metrics.temperature,
        disk:metrics.disk,
        wireguard:metrics.wireguard||null,
        wireguardFetchedAt,
        smart:metrics.smart||null,
        smartFetchedAt,
        aptUpdates:metrics.aptUpdates||null
      };
    }catch(error){
      return {
        id:sanitizeText(host.id,64),
        name:sanitizeText(host.name,100)||"Hote",
        type,
        ok:false,
        error:error.message
      };
    }
  })).then(results=>({hosts:results}));

  hostMetricsInflight=refresh;
  try{
    const payload=await refresh;
    hostMetricsCache={ts:Date.now(),payload};
    res.json(payload);
  }catch(error){
    console.error("Refresh mesures:",error);
    res.status(500).json({error:"Lecture des mesures impossible"});
  }finally{
    if(hostMetricsInflight===refresh) hostMetricsInflight=null;
  }
});

app.get("/api/status",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json(statusCache);
});

// Rafraîchissement manuel forcé de tous les statuts/pastilles/widgets.
app.post("/api/refresh",async (_req,res)=>{
  res.set("Cache-Control","no-store");
  try{
    await refreshStatuses(true);
  }catch(_error){}
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
  const bye=()=>{
    console.log(`${ts()} Serveur arrêté proprement.`);
    process.exit(0);
  };
  if(httpServer) httpServer.close(bye);
  else bye();
  setTimeout(()=>{
    console.error(`${ts()} Arrêt forcé (délai dépassé).`);
    process.exit(1);
  },10000).unref();
}

process.on("SIGTERM",()=>shutdownGraceful("SIGTERM"));
process.on("SIGINT",()=>shutdownGraceful("SIGINT"));

// Le registre doit etre charge avant l'ecoute HTTP et avant tout cycle de
// statut : sinon /api/widgets pourrait repondre une liste vide au tout premier
// chargement du navigateur, et le core ignorerait les types qu'il ne connait
// pas encore.
let widgetsReady=false;

async function start(){
  try{
    await widgetCore.load();
  }catch(error){
    console.error(`${ts()} Registre de widgets illisible : ${error.message}`);
  }
  // Les liens web sont des services sans widget : ils sont surveilles par le
  // plugin qui revendique le slot "link". Sans lui, plus rien ne les controle,
  // autant le dire au demarrage plutot que de laisser des tuiles grises.
  if(!widgetCore.linkPlugin()){
    console.warn(`${ts()} Aucun plugin de lien (defaultFor: "link") : les liens web ne seront pas contrôlés`);
  }
  widgetsReady=true;
  httpServer=app.listen(PORT,DASHBOARD_BIND,()=>{
    console.log(`${ts()} Dashmon : http://${DASHBOARD_BIND}:${PORT}`);
  });
  await refreshStatuses();
}

start().catch(error=>{
  console.error(`${ts()} Demarrage impossible :`,error);
  process.exit(1);
});

const statusTimer=setInterval(()=>{
  if(widgetsReady) refreshStatuses();
},STATUS_INTERVAL);
