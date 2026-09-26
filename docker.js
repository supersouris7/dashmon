"use strict";
// Accès en lecture seule à l'API Docker Engine pour le widget Docker.
// Les requêtes passent uniquement par le backend : le frontend ne reçoit
// jamais le socket Docker ni de jetons d'accès.
//
// Mode de connexion déterminé par la configuration de l'hôte (host.monitoring.docker) :
//   - "local" (défaut) : socket Unix local (DOCKER_SOCKET ou /var/run/docker.sock).
//   - "tcp"            : URL d'une API Docker distante (ajout futur, sans modifier
//                        le modèle du widget qui ne référence que l'identifiant de l'hôte).
const http = require("http");
const https = require("https");

const DOCKER_API_VERSION = process.env.DOCKER_API_VERSION || "v1.41";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const DOCKER_TIMEOUT = 4000;

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

// Résumé pur (testable) : comptage des conteneurs et de la fraîcheur des images.
// Un conteneur est "à jour" quand l'image locale associée à son tag est
// exactement l'image qu'il exécute (ImageID identique). Si le tag a été
// re-pullé (ex. watchtower) vers une nouvelle image, le conteneur n'est pas à jour.
function computeDockerSummary(containers, images){
  const list = Array.isArray(containers) ? containers : [];
  const imageList = Array.isArray(images) ? images : [];
  const total = list.length;
  const active = list.filter(container => container && container.State === "running").length;

  const tagById = new Map();
  imageList.forEach(image => {
    const id = image && typeof image.Id === "string" ? image.Id : "";
    if (!id) return;
    (Array.isArray(image.RepoTags) ? image.RepoTags : []).forEach(tag => {
      if (typeof tag === "string" && tag && tag !== "<none>:<none>") {
        tagById.set(tag, id);
      }
    });
  });

  let updated = 0;
  for (const container of list) {
    if (!container) continue;
    const tag = typeof container.Image === "string" ? container.Image : "";
    const currentId = tagById.get(tag);
    if (currentId && container.ImageID === currentId) updated++;
  }

  return { total, active, updated };
}

module.exports = {
  dockerRequest,
  dockerHostMode,
  computeDockerSummary,
  DOCKER_API_VERSION,
  DOCKER_SOCKET
};