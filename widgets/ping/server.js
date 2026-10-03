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
// La cible est le champ "host" du widget : "192.0.2.10", "nas.exemple.lan",
// "nas.exemple.lan:8080". L'URL du service n'est qu'un repli, pour que le
// widget reste utile sans configuration ; elle reste aussi le lien au clic et
// n'a donc pas a connaitre l'hote teste. Le port vient de la saisie quand il y
// en a un, sinon 80 (ou 443 si l'URL de repli est en https).
//
// Sans URL, la carte n'a pas de lien au clic — c'est le comportement normal
// d'une tuile qui n'en a pas, pas une degradee de ce widget.

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
  // Le champ "host" gagne sur l'URL du service : on teste ce que l'utilisateur
  // a explicitement demande, meme si la carte pointe ailleurs.
  const target = parseTarget(ctx.config.host || (ctx.service && ctx.service.url));
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