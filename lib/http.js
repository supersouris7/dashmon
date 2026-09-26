"use strict";
// Helpers HTTP partages par le core et les plugins.
//
// Objectif : un widget tiers ne doit jamais reimplementer de client HTTP.
// Meme timeouts, meme plafond de corps de reponse, meme politique TLS, meme
// famille IPv4 que le reste de Dashmon.

const http = require("http");
const https = require("https");

const MAX_BODY = 2 * 1024 * 1024;
// Plafond dur : un plugin qui lit une page HTML (YouTube rend 2 a 3 Mo de
// JavaScript) peut demander plus que MAX_BODY, mais jamais au-dela de cette
// limite, pour qu'un tiers ne puisse pas faire tenir un gros corps en memoire
// sans arret.
const MAX_BODY_LIMIT = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT = 4000;

// resolveInsecureTls est injecte par le core (DASHBOARD_INSECURE_TLS) pour
// que la configuration reste centralisee dans server.js.
let insecureTls = false;
let defaultTimeout = DEFAULT_TIMEOUT;

function configure({ insecure = false, timeout = DEFAULT_TIMEOUT } = {}) {
  insecureTls = insecure === true;
  if (Number.isFinite(timeout) && timeout > 0) defaultTimeout = timeout;
}

function isInsecureTls() {
  return insecureTls;
}

function getTimeout(override) {
  return Number.isFinite(override) && override > 0 ? override : defaultTimeout;
}

// Plafond de corps de la requete : le defaut protege, un plugin qui lit une
// page HTML peut l'augmenter, et la borne dure est appliquee dans tous les cas.
function getMaxBody(override) {
  if (!Number.isFinite(override) || override <= 0) return MAX_BODY;
  return Math.min(Math.round(override), MAX_BODY_LIMIT);
}

// Requete JSON entrante/sortante. Rejette avec une Error porteuse de .status
// (code HTTP) et .body (payload brut) pour permettre les retries des plugins.
function apiRequest(baseUrl, apiPath, options = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      const joined = apiPath ? `${String(baseUrl).replace(/\/+$/, "")}${apiPath}` : String(baseUrl);
      target = new URL(joined);
    } catch (_error) {
      return reject(new Error("URL invalide"));
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return reject(new Error("Protocole non supporté"));
    }

    const method = options.method || "GET";
    const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.basic) {
      headers.Authorization = "Basic " + Buffer.from(
        String(options.basic.user || "") + ":" + String(options.basic.password || ""),
        "utf8"
      ).toString("base64");
    }

    const client = target.protocol === "https:" ? https : http;
    const maxBody = getMaxBody(options.maxBody);
    const req = client.request(target, {
      method,
      headers,
      rejectUnauthorized: !insecureTls,
      timeout: getTimeout(options.timeout),
      // IPv4 explicite : les registres / APIs avec un AAAA non joignable
      // provoquaient un blocage de plusieurs secondes.
      family: 4
    }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
        if (body.length > maxBody) req.destroy(new Error("Réponse trop volumineuse"));
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch (_error) {}
          const payload = parsed && typeof parsed === "object" ? parsed : {};
          const message = payload.message || payload.Message || payload.error || payload.Error;
          const error = new Error(
            (message ? String(message).slice(0, 200) : "") || `HTTP ${response.statusCode}`
          );
          error.status = response.statusCode;
          error.body = body.slice(0, 2000);
          return reject(error);
        }
        // raw : le plugin veut le texte (une page HTML) et le code HTTP, pas un
        // JSON. Sans cette option, une reponse non-JSON valait null.
        if (options.raw) {
          return resolve({ status: response.statusCode, body, headers: response.headers });
        }
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (_error) {}
        resolve(parsed);
      });
    });

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Sonde HTTP "est-ce que ca repond ?" (pastille d'etat d'un service simple).
function httpProbe(url, timeout) {
  return new Promise(resolve => {
    let target;
    try {
      target = new URL(String(url || ""));
    } catch (_error) {
      return resolve({ ok: false, ms: 0, error: "URL invalide" });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return resolve({ ok: false, ms: 0, error: "Protocole non supporté" });
    }
    const client = target.protocol === "https:" ? https : http;
    const started = Date.now();
    const req = client.request(target, {
      method: "GET",
      timeout: getTimeout(timeout),
      rejectUnauthorized: !insecureTls,
      agent: false,
      family: 4,
      headers: { "User-Agent": "Dashmon-Status/1.0", Connection: "close" }
    }, res => {
      res.resume();
      resolve({ ok: true, ms: Date.now() - started, code: res.statusCode });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", error => resolve({
      ok: false,
      ms: Date.now() - started,
      error: error.message === "timeout" ? "timeout" : error.message
    }));
    req.end();
  });
}

module.exports = { apiRequest, httpProbe, configure, isInsecureTls, getTimeout, getMaxBody, MAX_BODY, MAX_BODY_LIMIT };
