"use strict";
// Widget YouTube : nombre d'abonnes d'une chaine.
//
// YouTube n'a pas d'API publique pour ce chiffre sans cle d'API, et la Data
// API v3 (= 10 000 requetes/jour par projet) n'a pas le droit d'afficher un
// compteur public. On lit donc la page de la chaine, dont le JSON interne
// contient la cle stable "subscriberCountText" — independamment de la langue.
// Le widget n'a pas de renderer : la tuile d'un lien reste le point vert/rouge
// du client generique.

const { parseSubscribers, channelPath, normalizeInput } = require("./parse");

const BASE_URL = "https://www.youtube.com";
const TIMEOUT = 10000;
// La page d'une chaine pese 2 a 3 Mo de JavaScript : au-dela du plafond
// general de 2 Mio du client HTTP, la reponse serait coupee en plein milieu.
const MAX_BODY = 6 * 1024 * 1024;

// Page de la chaine : le "about" est la page qui porte le compteur d'abonnes.
const ABOUT = "/about";

async function fetchChannel(ctx, username) {
  const page = await ctx.api(BASE_URL, channelPath(username) + ABOUT, {
    raw: true,
    timeout: TIMEOUT,
    maxBody: MAX_BODY,
    headers: {
      // La reponse est du HTML : sans cet Accept, l'API JSON par defaut
      // ferait echouer la requete.
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
    }
  });
  const html = String((page && page.body) || "");
  return { html, status: (page && page.status) || 0 };
}

// YouTube sert parfois une page de consentement (ou un interstitiel) : le
// compteur n'y est pas. C'est une reponse HTTP 200, donc pour le lien le
// service est bien "up" — seule la metrique manque.
function isChallenge(html) {
  return /action="https:\/\/consent\./i.test(html)
    || /consent\.youtube\.com/i.test(html)
    || /"consentButton"/i.test(html);
}

async function check(ctx) {
  const username = String(ctx.config.username || "").trim();
  // Une adresse de video ou un nom de domaine ne sont pas des chaines : on ne
  // part pas sur une requete qui ne peut rien rapporter.
  if (!ctx.sanitizeUrl(ctx.service.url) || !normalizeInput(username)) {
    return { state: "down", ok: false, error: ctx.t("missingChannel") };
  }

  let page;
  try {
    page = await fetchChannel(ctx, username);
  } catch (error) {
    const message = String((error && error.message) || "Erreur YouTube").slice(0, 200);
    // 429 : YouTube bride les requetes depuis la meme IP. Le lien repond
    // encore (on l'a bien interroge), seule la metrique est indisponible.
    const throttled = error && (error.status === 429 || error.status === 403);
    // Page coupee par le plafond de corps : YouTube a bien repondu, c'est nous
    // qui n'avons pas lu le compteur. Meme traitement qu'une consent page.
    const tooBig = /volumineuse/i.test(message);
    return {
      state: throttled || tooBig ? "up" : "down",
      ok: false,
      error: tooBig ? ctx.t("tooBig") : message,
      throttled: !!throttled
    };
  }

  if (isChallenge(page.html)) {
    return { state: "up", ok: false, error: ctx.t("consent"), throttled: true };
  }

  const count = parseSubscribers(page.html);
  if (count == null) {
    return { state: "up", ok: false, error: ctx.t("notFound") };
  }

  return { state: "up", ok: true, subscribers: count, variant: "" };
}

module.exports = { check, isChallenge, fetchChannel, parseSubscribers, normalizeInput, channelPath };
