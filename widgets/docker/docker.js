"use strict";
// Read-only access to the Docker Engine API for the Docker widget. Requests
// only go through the server: the browser never gets the Docker socket nor any
// registry token.
//
// Connection mode, from the widget settings (widgets/docker/server.js builds a
// virtual host {monitoring:{docker}} from the widget):
//   - "local" (default): local Unix socket (DOCKER_SOCKET or /var/run/docker.sock).
//   - "tcp": HTTP(S) URL of a remote Docker API, typed by hand (unrelated to
//     the monitored hosts list).
//
// Image update detection (reliable, read-only, never pulls):
//   - local signal: if the local tag was re-pulled to a new image (e.g. by
//     watchtower), the container is not up to date (different ImageID).
//   - remote signal: the registry manifest digest (Docker Hub or a custom
//     registry) of the tag is compared with the digest of the running image.
//     Same digest: up to date. Different digest: update available.
//   - not verifiable (registry unreachable, 401/404, local-only image): counted
//     as up to date but listed in updated.unknown for the tooltip (never a false
//     "update available").
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const net = require("net");
const { isBlockedAddress, safeLookup } = require("../../lib/http/client");

const DOCKER_API_VERSION = process.env.DOCKER_API_VERSION || "v1.41";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const DOCKER_TIMEOUT = 4000;
const REGISTRY_TIMEOUT = 8000;
// Same switch as every other outgoing request (lib/http/client.js): it also
// applies to a Docker API reached over TCP, whose certificate is often
// self-signed.
const INSECURE_TLS = process.env.DASHBOARD_INSECURE_TLS === "1";
// In-memory cache of manifest digests per reference (repo@tag). Successes are
// kept REGISTRY_CACHE_MS; failures only 30 minutes, so a newly published tag
// is not missed.
const REGISTRY_CACHE_MS = Number(process.env.DASHMON_REGISTRY_CACHE_MS) || 6 * 60 * 60 * 1000;
const REGISTRY_NULL_CACHE_MS = 30 * 60 * 1000;
const MANIFEST_ACCEPT = [
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json"
].join(", ");

function dockerHostMode(host) {
  const docker = host && host.monitoring && host.monitoring.docker;
  return docker && docker.mode === "tcp" ? "tcp" : "local";
}

// tcp:// is the DOCKER_HOST notation and the one suggested by the editor: it
// means plain HTTP. The endpoint is appended to the base path of the URL,
// after the API version, as for the local socket; without it every request
// went to the daemon root, which answers 404.
function dockerTcpTarget(value, endpoint) {
  const target = new URL(
    String(value || "")
      .trim()
      .replace(/^tcp:\/\//i, "http://")
  );
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Connexion Docker TCP invalide");
  }
  const address = target.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(address) && isBlockedAddress(address)) {
    throw new Error("Adresse Docker link-local refusee");
  }
  if (endpoint) {
    const relative = new URL(endpoint, "http://docker.invalid");
    target.pathname =
      target.pathname.replace(/\/+$/, "") + "/" + DOCKER_API_VERSION + relative.pathname;
    target.search = relative.search;
  }
  return target;
}

// The image runs as the non-root user "node": without an extra group, the
// Docker socket (root:docker, mode 660) refuses the connection. EACCES/EPERM
// says nothing useful, so it is turned into a cause and a remedy.
function dockerSocketError(error) {
  if (!error || (error.code !== "EACCES" && error.code !== "EPERM")) return error;
  const hint =
    "Socket Docker inaccessible (" +
    error.code +
    ") : le conteneur n'appartient pas au groupe docker. Ajoutez group_add avec le gid de /var/run/docker.sock (stat -c '%g' /var/run/docker.sock).";
  return Object.assign(new Error(hint), { code: error.code });
}

function dockerRequest(host, endpoint, timeout) {
  const tcp = dockerHostMode(host) === "tcp";
  const timeoutMs = Number.isFinite(timeout) ? timeout : DOCKER_TIMEOUT;
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let req;

    const onResponse = response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) {
          try {
            req.destroy();
          } catch (_error) {}
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
        const target = dockerTcpTarget(
          host && host.monitoring && host.monitoring.docker && host.monitoring.docker.url,
          endpoint
        );
        req = (target.protocol === "https:" ? https : http).request(
          target,
          {
            method: "GET",
            timeout: timeoutMs,
            rejectUnauthorized: !INSECURE_TLS,
            lookup: safeLookup,
            family: 4,
            headers: { Accept: "application/json" }
          },
          onResponse
        );
      } else {
        req = http.request(
          {
            method: "GET",
            timeout: timeoutMs,
            socketPath: DOCKER_SOCKET,
            path: "/" + DOCKER_API_VERSION + (endpoint || ""),
            headers: { Accept: "application/json" }
          },
          onResponse
        );
      }
    } catch (error) {
      return reject(error);
    }

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", error => reject(tcp ? error : dockerSocketError(error)));
    req.end();
  });
}

function dockerErrorBody(body, status) {
  try {
    const parsed = JSON.parse(body);
    if (parsed && parsed.message) return String(parsed.message).slice(0, 200);
  } catch (_error) {}
  return "Docker HTTP " + status;
}

// --- Parsing an image reference (pure) ---
// "nginx:latest" -> {registry:"", repo:"nginx", tag:"latest"}
// "ghcr.io/owner/app:1.0" -> {registry:"ghcr.io", repo:"owner/app", tag:"1.0"}
// "192.0.2.10:5000/app" -> {registry:"192.0.2.10:5000", repo:"app", tag:"latest"}
// "nginx@sha256:abc" -> {pinned:true}
function parseImageRef(ref) {
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

function isDockerHub(registry) {
  return (
    registry === "" ||
    registry === "docker.io" ||
    registry === "registry-1.docker.io" ||
    registry === "index.docker.io"
  );
}

// Real host for manifest requests (Docker Hub -> registry-1.docker.io).
function registryEndpoint(parsed, protocol) {
  if (isDockerHub(parsed.registry)) {
    return { hub: true, protocol: "https:", host: "registry-1.docker.io" };
  }
  return { hub: false, protocol, host: parsed.registry };
}

// --- Local classification (pure) ---
// Status per container:
//   "pinned":        referenced by digest (immutable) -> up to date.
//   "update":        the local tag points to another image (watchtower) -> update.
//   "local-current": the container runs the current image of the local tag -> ask the registry.
//   "unresolved":    tag missing from the local images -> ask the registry.
function classifyDockerContainers(containers, images) {
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
    const imageId = typeof container.ImageID === "string" ? container.ImageID : "";
    if (ref.includes("@")) {
      out.push({ ref, status: "pinned", repoDigests, imageId });
      return;
    }
    const current = tagById.get(ref);
    if (current && current !== imageId) {
      out.push({ ref, status: "update", repoDigests, imageId });
      return;
    }
    out.push({
      ref,
      status: current ? "local-current" : "unresolved",
      repoDigests,
      imageId
    });
  });
  return out;
}

// Local summary "without registry" (fallback, tests). Unverified containers
// are counted as up to date and listed in unknown.
function computeDockerSummary(containers, images) {
  const list = Array.isArray(containers) ? containers : [];
  const total = list.length;
  const active = list.filter(container => container && container.State === "running").length;
  const classified = classifyDockerContainers(list, images);
  let updated = 0;
  let unknown = 0;
  for (const item of classified) {
    if (item.status === "pinned") {
      updated++;
      continue;
    }
    if (item.status === "update") continue;
    updated++;
    unknown++;
  }
  return { total, active, updated, unknown };
}

// --- Registry access (read-only) ---
function registryTarget(protocol, host) {
  const target = new URL(String(protocol || "") + "//" + String(host || ""));
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Registre Docker invalide");
  }
  const address = target.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(address) && isBlockedAddress(address)) {
    throw new Error("Adresse de registre link-local refusee");
  }
  return { target, address };
}

function registryRequest(protocol, host, path, headers, timeout) {
  return new Promise((resolve, reject) => {
    let target;
    let address;
    try {
      ({ target, address } = registryTarget(protocol, host));
    } catch (error) {
      return reject(error);
    }
    const client = target.protocol === "https:" ? https : http;
    const started = Date.now();
    const req = client.request(
      {
        hostname: target.hostname,
        port: target.port || undefined,
        method: "GET",
        path,
        headers: Object.assign({ "User-Agent": "Dashmon-Registry/1.0" }, headers || {}),
        timeout: timeout || REGISTRY_TIMEOUT,
        family: 4,
        rejectUnauthorized: !INSECURE_TLS,
        lookup: safeLookup,
        servername: target.protocol === "https:" && !net.isIP(address) ? target.hostname : undefined
      },
      response => {
        const chunks = [];
        let size = 0;
        response.on("data", chunk => {
          chunks.push(chunk);
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            try {
              req.destroy();
            } catch (_error) {}
          }
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
            ms: Date.now() - started
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function parseAuthChallenge(header) {
  const match = /^Bearer\s+(.*)$/i.exec(header || "");
  if (!match) return null;
  const fields = {};
  for (const part of match[1].split(/\s*,\s*/)) {
    const kv = /^([^=]+)="([^"]*)"$/.exec(part);
    if (kv) fields[kv[1]] = kv[2];
  }
  if (!fields.realm) return null;
  return fields;
}

async function tokenFromChallenge(parsed, header) {
  const fields = parseAuthChallenge(header);
  if (!fields) return null;
  try {
    const url = new URL(fields.realm);
    const query = new URLSearchParams();
    if (fields.service) query.set("service", fields.service);
    query.set("scope", fields.scope || "repository:" + parsed.repo + ":pull");
    const tokenPath = url.pathname + "?" + query.toString();
    const response = await registryRequest(url.protocol, url.host, tokenPath, {});
    if (response.status < 200 || response.status >= 300) return null;
    const body = JSON.parse(response.body.toString("utf8"));
    return body.token || body.access_token || null;
  } catch (_error) {
    return null;
  }
}

async function registryManifestDigest(ref, host, platform) {
  const parsed = parseImageRef(ref);
  if (parsed.pinned || !parsed.repo) throw new Error("Référence non vérifiable au registre");
  const endpoint = registryEndpoint(parsed, "https:");
  const path = "/v2/" + parsed.repo + "/manifests/" + encodeURIComponent(parsed.tag);

  const attempt = async (protocol, hostname, reqPath, token) => {
    let headers = { Accept: MANIFEST_ACCEPT };
    if (token) headers.Authorization = "Bearer " + token;
    let response = await registryRequest(protocol, hostname, reqPath, headers);
    if (!token && (response.status === 401 || response.status === 403)) {
      const newToken = await tokenFromChallenge(parsed, response.headers["www-authenticate"]);
      if (newToken) {
        response = await registryRequest(protocol, hostname, reqPath, {
          Accept: MANIFEST_ACCEPT,
          Authorization: "Bearer " + newToken
        });
        token = newToken;
      }
    }
    return { response, token };
  };

  const candidates = endpoint.hub
    ? [["https:", "registry-1.docker.io"]]
    : [
        ["https:", endpoint.host],
        ["http:", endpoint.host]
      ];
  let lastError = new Error("registry unreachable");
  for (const [protocol, hostname] of candidates) {
    try {
      const main = await attempt(protocol, hostname, path, null);
      if (main.response.status < 200 || main.response.status >= 300) {
        lastError = new Error("HTTP " + main.response.status);
        continue;
      }
      const digestHeader = String(main.response.headers["docker-content-digest"] || "");
      const digest =
        digestHeader ||
        "sha256:" + crypto.createHash("sha256").update(main.response.body).digest("hex");
      let configDigest = null;
      try {
        const json = JSON.parse(main.response.body.toString("utf8"));
        if (Array.isArray(json && json.manifests)) {
          // Multi-arch index: pick the artefact matching the os/arch pair.
          const target =
            platform && platform.os && platform.architecture
              ? { os: platform.os, architecture: platform.architecture }
              : null;
          const entry = target
            ? json.manifests.find(
                value =>
                  value &&
                  value.platform &&
                  value.platform.os === target.os &&
                  value.platform.architecture === target.architecture
              )
            : null;
          if (entry) {
            const child = await attempt(
              protocol,
              hostname,
              "/v2/" + parsed.repo + "/manifests/" + entry.digest,
              main.token
            );
            if (child.response.status >= 200 && child.response.status < 300) {
              const childJson = JSON.parse(child.response.body.toString("utf8"));
              configDigest =
                childJson && childJson.config && typeof childJson.config.digest === "string"
                  ? childJson.config.digest
                  : null;
            }
          }
        } else if (json && json.config && typeof json.config.digest === "string") {
          configDigest = json.config.digest;
        }
      } catch (_error) {}
      return { digest, configDigest };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const registryDigestCache = new Map();

function cachedResolved(ref) {
  const hit = registryDigestCache.get(ref);
  if (!hit) return { hit: false, resolved: null };
  const ttl = hit.digest ? REGISTRY_CACHE_MS : REGISTRY_NULL_CACHE_MS;
  if (Date.now() - hit.ts < ttl) return { hit: true, resolved: hit };
  return { hit: false, resolved: null };
}

function platformForRef(ref, images) {
  const list = Array.isArray(images) ? images : [];
  const image = list.find(
    item => item && Array.isArray(item.RepoTags) && item.RepoTags.some(tag => tag === ref)
  );
  if (image && typeof image.Architecture === "string") {
    return { os: image.Os || "linux", architecture: image.Architecture };
  }
  return null;
}

async function resolveRegistryDigests(host, refs, images) {
  const map = new Map();
  const unique = Array.isArray(refs) ? [...new Set(refs.filter(Boolean))] : [];
  const pending = [];
  for (const ref of unique) {
    const entry = cachedResolved(ref);
    if (entry.hit) map.set(ref, entry.resolved);
    else pending.push(ref);
  }
  for (const ref of pending) {
    let resolved = null;
    try {
      resolved = await registryManifestDigest(ref, host, platformForRef(ref, images));
    } catch (_error) {}
    registryDigestCache.set(ref, resolved || { digest: null, configDigest: null, ts: Date.now() });
    map.set(ref, registryDigestCache.get(ref));
  }
  return map;
}

// Full summary: local signals plus the remote registry verdict.
async function computeLiveDockerSummary(host, containers, images) {
  const list = Array.isArray(containers) ? containers : [];
  const total = list.length;
  const active = list.filter(container => container && container.State === "running").length;
  const classified = classifyDockerContainers(list, images);

  const refs = [];
  for (const item of classified) {
    if (
      (item.status === "local-current" || item.status === "unresolved") &&
      item.ref &&
      !item.ref.includes("@")
    ) {
      refs.push(item.ref);
    }
  }
  const resolved = await resolveRegistryDigests(host, refs, images);

  let updated = 0;
  let unknown = 0;
  for (const item of classified) {
    if (item.status === "pinned") {
      updated++;
      continue;
    }
    if (item.status === "update") continue;
    const remote = item.ref ? resolved.get(item.ref) : null;
    // No usable remote digest: no proof -> counted up to date, and traced.
    if (!remote || !remote.digest) {
      updated++;
      unknown++;
      continue;
    }
    if (item.repoDigests.length) {
      const hasRemoteDigest = item.repoDigests.some(
        value => value.split("@").pop() === remote.digest
      );
      updated += hasRemoteDigest ? 1 : 0;
      continue;
    }
    // Image without RepoDigest: compare the manifest config digest (which
    // equals the local image ID) to decide for real.
    if (remote.configDigest) {
      updated += item.imageId === remote.configDigest ? 1 : 0;
      continue;
    }
    updated++;
    unknown++;
  }
  return { total, active, updated, unknown };
}

module.exports = {
  dockerRequest,
  dockerSocketError,
  dockerHostMode,
  dockerTcpTarget,
  registryTarget,
  parseImageRef,
  classifyDockerContainers,
  computeDockerSummary,
  computeLiveDockerSummary,
  resolveRegistryDigests,
  registryManifestDigest,
  DOCKER_API_VERSION,
  DOCKER_SOCKET
};
