"use strict";
// Widget "ping" : la tuile qui teste si une IP ou un hote repond.
//
// Ce n'est pas un ping ICMP. Node n'a pas de socket ICMP et l'image
// (node:24-alpine) ne fournit pas le binaire "ping" ; surtout, un ICMP brut
// demande CAP_NET_RAW, que l'utilisateur "node" n'a pas. Le test retenu est
// donc : le nom se resout (dns), puis le port s'ouvre (net). Ca repond a la
// question qui compte sur un tableau de bord — "est-ce que ce service est
// joignable ?" — et ne demande ni privilege ni dependance.
//
// La cible est l'URL du service elle-meme : "http://192.0.2.10",
// "http://nas.exemple.lan:8080", "https://routeur.exemple.lan". Un champ
// dediee serait une seconde source de verite a tenir synchrone avec l'URL, et
// la pastille n'est rendue de toute facon que sur une carte qui a une URL.
//
// L'URL sert aussi de lien au clic, et l'icone reste celle choisie par
// l'utilisateur : une adresse nue n'est pas forcernment un site web.

const dns = require("dns");
const net = require("net");

// 3 s : au-dela, un hote qui ne repond pas est considere injoignable, et la
// tuile ne doit pas rester bloquee plus longtemps que ses voisines.
const TIMEOUT = 3000;

// Extrait l'hote et le port de l'URL du service. Accepte une URL avec scheme
// ("http://nas:8080") comme une adresse nue ("192.0.2.10"), et les deux
// formes d'IPv6 ("[::1]" et "::1"). Le port vient de l'URL quand il y en a un,
// sinon du scheme : 443 pour https, 80 pour http.
function parseTarget(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;

  let rest = text;
  let scheme = "http";
  const schemeMatch = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase();
    rest = rest.slice(schemeMatch[0].length);
  }

  // On jette le chemin, la requete et le fragment : seule la partie reseau
  // nous interesse.
  rest = rest.split("/")[0].split("?")[0].split("#")[0];
  if (!rest) return null;

  let host = rest;
  let port = null;

  const bracketed = rest.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketed) {
    // IPv6 : les deux-points appartiennent a l'adresse, seul le dernier
    // ":port" est un port.
    host = bracketed[1];
    if (bracketed[2]) port = Number(bracketed[2]);
  } else {
    const withPort = rest.match(/^(.+):(\d+)$/);
    if (withPort) {
      host = withPort[1];
      port = Number(withPort[2]);
    }
  }

  if (!host) return null;
  if (!port) port = scheme === "https" ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

// Connexion TCP avec delai maximal. Ne leve jamais : un echec est un resultat
// (l'hote ne repond pas), pas une exception a remonter au core.
function tcpConnect(host, port, timeout) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function check(ctx) {
  const target = parseTarget(ctx.service && ctx.service.url);
  if (!target) {
    return { state: "down", ok: false, error: ctx.t("missingHost") };
  }

  // Le nom doit d'abord se resoudre : sans cela on ne peut meme pas tenter la
  // connexion, et "nom introuvable" est une panne tres differente de "port
  // ferme". Sur une adresse IP, lookup est immediat.
  try {
    await dns.promises.lookup(target.host);
  } catch (_error) {
    return { state: "down", ok: false, error: ctx.t("unresolved") };
  }

  const reachable = await tcpConnect(target.host, target.port, TIMEOUT);
  if (!reachable) {
    return { state: "down", ok: false, error: ctx.t("noAnswer") };
  }
  return { state: "up", ok: true };
}

module.exports = { check, parseTarget };