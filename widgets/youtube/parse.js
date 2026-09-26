"use strict";
// Utilitaires du widget YouTube, isoles pour etre testes sans reseau.

const CHANNEL_ID = /^UC[\w-]{22}$/;

// Accepte "@pseudo", "pseudo", une URL de chaine, un identifiant UC... ou un
// nom d'utilisateur (/user/x) : le champ du formulaire reste aussi libre que
// possible, le widget fait le reste.
function channelPath(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (CHANNEL_ID.test(raw)) return "/channel/" + raw;

  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    let url;
    try {
      url = new URL(/^https?:/i.test(raw) ? raw : "https:" + raw);
    } catch (_error) {
      return "";
    }
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && CHANNEL_ID.test(parts[1] || "")) return "/channel/" + parts[1];
    if (parts[0] === "c" && parts[1]) return "/c/" + parts[1];
    if (parts[0] === "user" && parts[1]) return "/user/" + parts[1];
    if (parts[0] && parts[0].startsWith("@")) return "/" + parts[0];
    return "";
  }
  return raw.startsWith("@") ? "/" + raw : "/" + "@" + raw;
}

// Forme canonique d'un identifiant de chaine : "@pseudo" ou "UC...".
// Renvoie null si l'entree n'est pas une chaine — une adresse de video, par
// exemple, qui ne doit surtout pas finir en requete vers /about.
function normalizeInput(input) {
  const path = channelPath(input);
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "channel" && CHANNEL_ID.test(parts[1] || "")) return parts[1];
  const last = parts[parts.length - 1] || "";
  if (!last) return null;
  return last.startsWith("@") ? last : "@" + last;
}

// Premier nombre d'un fragment de nombre, en tolerant les separateurs de
// milliers (espace, insecable, fine) et les suffixes compacts de YouTube
// ("1,2 M", "3.45K", "1.2B").
function parseNumber(text) {
  const source = String(text || "").replace(/[\s\u00a0\u202f\u2009]/g, "");
  const match = source.match(/^(\d+(?:[.,]\d+)?)([KkMmBb]|mio|million|millions|billion)?/);
  if (!match) return null;
  let value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const suffix = (match[2] || "").toLowerCase();
  if (suffix.startsWith("k")) value *= 1e3;
  else if (suffix.startsWith("b")) value *= 1e9;
  else if (suffix) value *= 1e6;
  return Math.round(value);
}

// YouTube expose le compteur sous une cle interne stable, quel que soit la
// langue de la page : c'est ce qu'on cherche plutot que "abonnés".
function parseSubscribers(html) {
  const source = String(html || "");
  const key = source.indexOf('"subscriberCountText"');
  if (key < 0) return null;
  // Le nombre est dans le court passage qui suit la cle, pas dans toute la
  // page (sinon on ramasserait n'importe quel chiffre).
  const window = source.slice(key, key + 400);
  const strings = [];
  const pattern = /"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pattern.exec(window)) !== null) {
    const value = match[1].replace(/\\u([0-9a-fA-F]{4})/g, (_all, hex) => String.fromCharCode(parseInt(hex, 16)));
    if (/\d/.test(value)) strings.push(value);
  }
  for (const value of strings) {
    const count = parseNumber(value);
    if (count != null) return count;
  }
  return null;
}

module.exports = { channelPath, normalizeInput, parseNumber, parseSubscribers, CHANNEL_ID };
