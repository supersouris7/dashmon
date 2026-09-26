"use strict";
// Accès en lecture seule à l'API Docker Engine pour le widget Docker.
// Les requêtes passent uniquement par le backend : le frontend ne reçoit
// jamais le socket Docker ni de jetons d'accès au registre.
//
// Mode de connexion déterminé par la configuration de l'hôte (host.monitoring.docker) :
//   - "local" (défaut) : socket Unix local (DOCKER_SOCKET ou /var/run/docker.sock).
//   - "tcp"            : URL d'une API Docker distante (ajout futur, sans modifier
//                        le modèle du widget qui ne référence que l'identifiant de l'hôte).
//
// Détection des mises à jour d'images (fiable, lecture seule, aucun pull) :
//   - signal local : si le len tag local a été re-pullé vers une nouvelle image
//     (ex. watchtower), le conteneur n'est pas à jour (ImageID différent).
//   - signal distant : la digest du manifest du registre (Docker Hub ou
//     registre custom) pour le tag est comparée à la digest de l'image exécutée.
//     Digest égale -> à jour. Digest différente -> mise à jour disponible.
//   - non vérifiable (registre injoignable, 401/404, image locale uniquement) :
//     compté optimistiquement "à jour" mais tracé dans updated.unknown pour le
//     tooltip (jamais de faux "mise à jour disponible").
const http = require("http");
const https = require("https");
const crypto = require("crypto");

const DOCKER_API_VERSION = process.env.DOCKER_API_VERSION || "v1.41";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const DOCKER_TIMEOUT = 4000;
const REGISTRY_TIMEOUT = 8000;
const INSECURE_REGISTRY_TLS = process.env.DASHBOARD_INSECURE_TLS === "1";
// Cache mmoire des digests de manifest par référence (repo@tag). Les succès
// sont conservés REGISTRY_CACHE_MS ; les échecs seulement 30 min pour ne pas
// rater un tag venant d'être publié.
const REGISTRY_CACHE_MS = Number(process.env.DASHMON_REGISTRY_CACHE_MS) || 6 * 60 * 60 * 1000;
const REGISTRY_NULL_CACHE_MS = 30 * 60 * 1000;
const MANIFEST_ACCEPT = [
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json"
].join(", ");

function dockerHostMode(host){
  const docker = host && host.monitoring && host.monitoring.docker;
  return docker && docker.mode === "tcp" ? "tcp" : "local";
}

function dockerRequest(host, endpoint, timeout){
  const tcp = dockerHostMode(host) === "tcp";
  const timeoutMs = Number.isFinite(timeout) ? timeout : DOCKER_TIMEOUT;
  return new Promise((resolve, reject)=>{
    const started = Date.now();
    let req;

    const onResponse = response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) {
          try { req.destroy(); } catch (_error) {}
        }
      });
      response.on("end", () => {
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          const message = dockerErrorBody(body, status);
          reject(Object.assign(new Error(message), { status, ms: Date.now() - started }));
          return;
        }
        let parsed = null;
        try {
          parsed = body.trim() ? JSON.parse(body) : null;
        } catch (_error) {}
        resolve(parsed);
      });
    };

    try {
      if (tcp) {
        const target = new URL(String(host && host.monitoring && host.monitoring.docker && host.monitoring.docker.url || ""));
        if (target.protocol !== "http:" && target.protocol !== "https:") {
          return reject(new Error("Connexion Docker TCP invalide"));
        }
        req = (target.protocol === "https:" ? https : http).request(target, {
          method: "GET",
          timeout: timeoutMs,
          headers: { "Accept": "application/json" }
        }, onResponse);
      } else {
        req = http.request({
          method: "GET",
          timeout: timeoutMs,
          socketPath: DOCKER_SOCKET,
          path: "/" + DOCKER_API_VERSION + (endpoint || ""),
          headers: { "Accept": "application/json" }
        }, onResponse);
      }
    } catch (error) {
      return reject(error);
    }

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function dockerErrorBody(body, status){
  try {
    const parsed = JSON.parse(body);
    if (parsed && parsed.message) return String(parsed.message).slice(0, 200);
  } catch (_error) {}
  return "Docker HTTP " + status;
}

// --- Parse d'une référence d'image (pur) ---
// "nginx:latest" -> {registry:"", repo:"nginx", tag:"latest"}
// "ghcr.io/owner/app:1.0" -> {registry:"ghcr.io", repo:"owner/app", tag:"1.0"}
// "192.168.1.10:5000/app" -> {registry:"192.168.1.10:5000", repo:"app", tag:"latest"}
// "nginx@sha256:abc" -> {pinned:true}
function parseImageRef(ref){
  const raw = String(ref || "").trim();
  let name = raw;
  let pinned = false;
  let digest = "";
  const at = raw.lastIndexOf("@");
  if (at >= 0) {
    pinned = true;
    digest = raw.slice(at + 1);
    name = raw.slice(0, at);
  }
  let tag = "latest";
  if (!pinned) {
    const slash = name.lastIndexOf("/");
    const colon = name.lastIndexOf(":");
    if (colon > slash) {
      tag = name.slice(colon + 1);
      name = name.slice(0, colon);
    }
  }
  let registry = "";
  let repo = name;
  const firstSlash = name.indexOf("/");
  if (firstSlash >= 0) {
    const first = name.slice(0, firstSlash);
    if (first === "localhost" || first.includes(".") || first.includes(":")) {
      registry = first;
      repo = name.slice(firstSlash + 1);
    }
  }
  return { registry, repo, tag, pinned, digest };
}

function isDockerHub(registry){
  return registry === "" || registry === "docker.io"
    || registry === "registry-1.docker.io" || registry === "index.docker.io";
}

// Hôte réel pour les requêtes manifest (Docker Hub -> registry-1.docker.io).
function registryEndpoint(parsed, protocol){
  if (isDockerHub(parsed.registry)) {
    return { hub: true, protocol: "https:", host: "registry-1.docker.io" };
  }
  return { hub: false, protocol, host: parsed.registry };
}

// --- Classification locale (pure) ---
// statut par conteneur :
//   "pinned"        : référence par digest (immuable) -> à jour.
//   "update"        : le tag local pointe vers une autre image (watchtower) -> mise à jour.
//   "local-current" : le conteneur exécute l'image actuelle du tag local -> verdict registre.
//   "unresolved"    : tag absent des images locales -> verdict registre.
function classifyDockerContainers(containers, images){
  const tagById = new Map();
  const imageByImageId = new Map();
  (Array.isArray(images) ? images : []).forEach(image => {
    const id = image && typeof image.Id === "string" ? image.Id : "";
    if (!id) return;
    if (imageByImageId.has(id)) return;
    imageByImageId.set(id, image);
    (Array.isArray(image.RepoTags) ? image.RepoTags : []).forEach(tag => {
      if (typeof tag === "string" && tag && tag !== "<none>:<none>") {
        tagById.set(tag, id);
      }
    });
  });

  const out = [];
  (Array.isArray(containers) ? containers : []).forEach(container => {
    if (!container) return;
    const ref = typeof container.Image === "string" ? container.Image : "";
    const image = imageByImageId.get(container.ImageID || "");
    const repoDigests = Array.isArray(image && image.RepoDigests)
      ? image.RepoDigests.map(value => String(value || "")).filter(Boolean)
      : [];
    if (ref.includes("@")) {
      out.push({ ref, status: "pinned", repoDigests });
      return;
    }
    const current = tagById.get(ref);
    if (current && current !== container.ImageID) {
      out.push({ ref, status: "update", repoDigests });
      return;
    }
    out.push({
      ref,
      status: current ? "local-current" : "unresolved",
      repoDigests
    });
  });
  return out;
}

// Résumé local "sans registre" (retombée / tests). Les conteneurs non vérifiés
// sont comptés optimistiquement "à jour" et tracés dans unknown.
function computeDockerSummary(containers, images){
  const list = Array.isArray(containers) ? containers : [];
  const total = list.length;
  const active = list.filter(container => container && container.State === "running").length;
  const classified = classifyDockerContainers(list, images);
  let updated = 0;
  let unknown = 0;
  for (const item of classified) {
    if (item.status === "pinned") { updated++; continue; }
    if (item.status === "update") continue;
    updated++;
    unknown++;
  }
  return { total, active, updated, unknown };
}

// --- Accès au registre (lecture seule) ---
function bareHost(host){
  const match = /^(.*?)(?::\d+)?$/.exec(host);
  return match ? match[1] : host;
}

function registryRequest(protocol, host, path, headers, timeout){
  return new Promise((resolve, reject)=>{
    const client = protocol === "https:" ? https : http;
    const started = Date.now();
    const req = client.request({
      host,
      method: "GET",
      path,
      headers: Object.assign({ "User-Agent": "Dashmon-Registry/1.0" }, headers || {}),
      timeout: timeout || REGISTRY_TIMEOUT,
      rejectUnauthorized: !INSECURE_REGISTRY_TLS,
      servername: protocol === "https:" ? bareHost(host) : undefined
    }, response => {
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > 8 * 1024 * 1024) {
          try { req.destroy(); } catch (_error) {}
        }
      });
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
        ms: Date.now() - started
      }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function registryToken(parsed, endpoint){
  const scope = "repository:" + parsed.repo + ":pull";
  try {
    const tokenPath = endpoint.hub
      ? "/token?service=registry.docker.io&scope=" + encodeURIComponent(scope)
      : "/token?service=registry&scope=" + encodeURIComponent(scope);
    const host = endpoint.hub ? "auth.docker.io" : endpoint.host;
    const response = await registryRequest(endpoint.protocol, host, tokenPath, {});
    if (response.status < 200 || response.status >= 300) return null;
    const body = JSON.parse(response.body.toString("utf8"));
    return body.token || body.access_token || null;
  } catch (_error) {
    return null;
  }
}

async function registryManifestDigest(ref, host){
  const parsed = parseImageRef(ref);
  if (parsed.pinned || !parsed.repo) throw new Error("Référence non vérifiable au registre");
  const endpoint = registryEndpoint(parsed, "https:");
  const token = await registryToken(parsed, endpoint);
  const headers = { "Accept": MANIFEST_ACCEPT };
  if (token) headers.Authorization = "Bearer " + token;
  const path = "/v2/" + parsed.repo + "/manifests/" + encodeURIComponent(parsed.tag);

  const candidates = endpoint.hub
    ? [[ "https:", "registry-1.docker.io" ]]
    : [[ "https:", endpoint.host ], [ "http:", endpoint.host ]];
  let lastError = new Error("registry unreachable");
  for (const [ protocol, hostname ] of candidates) {
    try {
      const response = await registryRequest(protocol, hostname, path, headers);
      if (response.status < 200 || response.status >= 300) {
        lastError = new Error("HTTP " + response.status);
        continue;
      }
      const digestHeader = String(response.headers["docker-content-digest"] || "");
      if (digestHeader) return digestHeader;
      return "sha256:" + crypto.createHash("sha256").update(response.body).digest("hex");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const registryDigestCache = new Map();

function cachedDigest(ref){
  const hit = registryDigestCache.get(ref);
  if (!hit) return { hit: false, digest: null };
  const ttl = hit.digest ? REGISTRY_CACHE_MS : REGISTRY_NULL_CACHE_MS;
  if (Date.now() - hit.ts < ttl) return { hit: true, digest: hit.digest };
  return { hit: false, digest: null };
}

async function resolveRegistryDigests(host, refs){
  const map = new Map();
  const unique = Array.isArray(refs) ? [...new Set(refs.filter(Boolean))] : [];
  const pending = [];
  for (const ref of unique) {
    const entry = cachedDigest(ref);
    if (entry.hit) map.set(ref, entry.digest);
    else pending.push(ref);
  }
  for (const ref of pending) {
    let digest = null;
    try {
      digest = await registryManifestDigest(ref, host);
    } catch (_error) {}
    registryDigestCache.set(ref, { digest, ts: Date.now() });
    map.set(ref, digest);
  }
  return map;
}

// Résumé complet : signaux locaux + verdict du registre distant.
async function computeLiveDockerSummary(host, containers, images){
  const list = Array.isArray(containers) ? containers : [];
  const total = list.length;
  const active = list.filter(container => container && container.State === "running").length;
  const classified = classifyDockerContainers(list, images);

  const refs = [];
  for (const item of classified) {
    if ((item.status === "local-current" || item.status === "unresolved") && !item.ref.includes("@")) {
      refs.push(item.ref);
    }
  }
  const digests = await resolveRegistryDigests(host, refs);

  let updated = 0;
  let unknown = 0;
  for (const item of classified) {
    if (item.status === "pinned") { updated++; continue; }
    if (item.status === "update") continue;
    const remote = item.ref ? digests.get(item.ref) : null;
    if (!remote) {
      updated++;
      unknown++;
      continue;
    }
    if (!item.repoDigests.length) {
      updated++;
      unknown++;
      continue;
    }
    const hasRemoteDigest = item.repoDigests.some(value => value.split("@").pop() === remote);
    if (hasRemoteDigest) updated++;
  }
  return { total, active, updated, unknown };
}

module.exports = {
  dockerRequest,
  dockerHostMode,
  parseImageRef,
  classifyDockerContainers,
  computeDockerSummary,
  computeLiveDockerSummary,
  resolveRegistryDigests,
  registryManifestDigest,
  DOCKER_API_VERSION,
  DOCKER_SOCKET
};