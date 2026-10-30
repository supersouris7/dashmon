"use strict";
// Outgoing HTTP helpers shared by the core and the plugins.
//
// A widget must never reimplement an HTTP client: every outgoing request gets
// the same timeouts, response size cap, TLS policy and IPv4 family.

const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");

const MAX_BODY = 2 * 1024 * 1024;
// Hard cap: a plugin reading an HTML page (YouTube serves 2 to 3 MB of
// JavaScript) may ask for more than MAX_BODY, never beyond this limit, so a
// third party cannot keep a huge body in memory.
const MAX_BODY_LIMIT = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT = 4000;

// Set by configure() from DASHBOARD_INSECURE_TLS, so the setting is read in
// one place (lib/config/settings.js).
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

// Response size cap: the default protects, a plugin reading an HTML page can
// raise it, and the hard cap always applies.
function getMaxBody(override) {
  if (!Number.isFinite(override) || override <= 0) return MAX_BODY;
  return Math.min(Math.round(override), MAX_BODY_LIMIT);
}

// Dashmon monitors LAN services on purpose, so private and loopback ranges
// are allowed. Link-local addresses have no usual monitoring target and
// include cloud metadata services: they are refused.
function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 0 || (first === 169 && second === 254);
  }
  if (family === 6) {
    const normalized = String(address).toLowerCase();
    if (/^fe[89ab][0-9a-f]:/.test(normalized) || normalized === "::") return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return !!(mapped && isBlockedAddress(mapped[1]));
  }
  return true;
}

function blockedAddressError() {
  const error = new Error("Adresse link-local refusee");
  error.code = "EHOSTUNREACH";
  return error;
}

function literalAddress(hostname) {
  const value = String(hostname || "").replace(/^\[|\]$/g, "");
  return net.isIP(value) ? value : "";
}

// DNS resolution is done here rather than by the HTTP client: the connection
// then uses the checked address, even if the name is rebound in between.
function safeLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const family = Number(options && options.family) || 0;
  dns.lookup(hostname, { all: true, family, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    const blocked = addresses.find(entry => isBlockedAddress(entry.address));
    if (blocked) {
      return callback(blockedAddressError());
    }
    const first = addresses[0];
    if (!first) return callback(new Error("Adresse introuvable"));
    callback(null, first.address, first.family);
  });
}

// JSON request. Rejects with an Error carrying .status (HTTP code) and .body
// (raw payload) so that plugins can retry.
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
    const address = literalAddress(target.hostname);
    if (address && isBlockedAddress(address)) {
      return reject(blockedAddressError());
    }

    const method = options.method || "GET";
    // An explicit User-Agent is required by some public APIs: GitHub answers
    // 403 to any request without one. The caller can override it through
    // options.headers.
    const headers = Object.assign(
      { Accept: "application/json", "User-Agent": "Dashmon/1.0" },
      options.headers || {}
    );
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.basic) {
      headers.Authorization =
        "Basic " +
        Buffer.from(
          String(options.basic.user || "") + ":" + String(options.basic.password || ""),
          "utf8"
        ).toString("base64");
    }

    const client = target.protocol === "https:" ? https : http;
    const maxBody = getMaxBody(options.maxBody);
    const req = client.request(
      target,
      {
        method,
        headers,
        rejectUnauthorized: !insecureTls,
        timeout: getTimeout(options.timeout),
        lookup: safeLookup,
        // Explicit IPv4: registries and APIs with an unreachable AAAA record caused
        // several seconds of delay.
        family: 4
      },
      response => {
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
            // "msg" is the convention of several self-hosted APIs (Uptime Kuma answers
            // { status: "fail", msg: ... }). Without it, a useful 404 such as
            // "Status Page Not Found" became a bare "HTTP 404".
            const message =
              payload.message ||
              payload.Message ||
              payload.msg ||
              payload.error ||
              payload.Error ||
              payload.detail;
            const error = new Error(
              (message ? String(message).slice(0, 200) : "") || `HTTP ${response.statusCode}`
            );
            error.status = response.statusCode;
            error.body = body.slice(0, 2000);
            return reject(error);
          }
          // raw: the plugin wants the text (an HTML page) and the HTTP code, not JSON.
          // Without this option a non-JSON response would be null.
          if (options.raw) {
            return resolve({ status: response.statusCode, body, headers: response.headers });
          }
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch (_error) {}
          resolve(parsed);
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// "Does it answer?" HTTP probe: the status pill of a plain service.
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
    const address = literalAddress(target.hostname);
    if (address && isBlockedAddress(address)) {
      return resolve({ ok: false, ms: 0, error: "Adresse link-local refusee" });
    }
    const client = target.protocol === "https:" ? https : http;
    const started = Date.now();
    const req = client.request(
      target,
      {
        method: "GET",
        timeout: getTimeout(timeout),
        rejectUnauthorized: !insecureTls,
        agent: false,
        lookup: safeLookup,
        family: 4,
        headers: { "User-Agent": "Dashmon-Status/1.0", Connection: "close" }
      },
      res => {
        res.resume();
        const code = res.statusCode || 0;
        // The probe must not confuse "the server answered" with "the service
        // works". A 502 from nginx means the application behind it is down: the host
        // answers, the service does not, and a green pill would be a false positive.
        // Conversely a 401 or 403 proves the target is reachable and running: a page
        // behind authentication stays green, otherwise every protected dashboard
        // would be in permanent alarm.
        return code >= 500
          ? resolve({ ok: false, ms: Date.now() - started, code, error: "HTTP " + code })
          : resolve({ ok: true, ms: Date.now() - started, code });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", error =>
      resolve({
        ok: false,
        ms: Date.now() - started,
        error: error.message === "timeout" ? "timeout" : error.message
      })
    );
    req.end();
  });
}

module.exports = {
  apiRequest,
  httpProbe,
  configure,
  isInsecureTls,
  getTimeout,
  getMaxBody,
  isBlockedAddress,
  safeLookup,
  MAX_BODY,
  MAX_BODY_LIMIT
};
