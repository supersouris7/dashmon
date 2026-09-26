"use strict";
// Widget "web" : la sonde des liens web.
//
// C'est le plugin qui revendique le slot "link" : un service qui n'a pas de
// widget est un lien, et c'est donc ce plugin qui le surveille. Il ne fabrique
// aucune metrique, il repond juste a "est-ce que ca repond ?" — le core n'a
// plus de sonde codee en dur, et ajouter un type de lien (YouTube, Docker Hub,
// GitHub...) n'est plus qu'une question de plugin.
//
// La tuile d'un lien nu reste rendue par le client generique (un point vert ou
// rouge) : ce plugin n'a donc pas de renderer, et le menu des widgets ne le
// propose pas ("hidden").

function isLoopback(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function check(ctx) {
  const raw = String((ctx.service && ctx.service.url) || "").trim();
  if (!raw) return { state: "down", ok: false, error: ctx.t("invalidUrl"), ms: 0 };

  let target;
  try {
    target = new URL(raw);
  } catch (_error) {
    return { state: "down", ok: false, error: ctx.t("invalidUrl"), ms: 0 };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { state: "down", ok: false, error: ctx.t("badProtocol"), ms: 0 };
  }

  const first = await ctx.probe(target.href);
  if (first.ok) {
    return { state: "up", ok: true, code: first.code, ms: first.ms };
  }

  // Repli loopback : contourne le hairpin NAT quand Dashmon et le service sont
  // sur la meme machine (le check direct vers l'IP publique echoue cote
  // serveur). Meme regle qu'avant le passage des liens en plugins.
  if (!isLoopback(target.hostname)) {
    try {
      const local = new URL(target.href);
      local.hostname = "127.0.0.1";
      const retry = await ctx.probe(local.href);
      if (retry.ok) {
        return { state: "up", ok: true, code: retry.code, ms: retry.ms, via: "loopback" };
      }
    } catch (_error) {}
  }

  return {
    state: "down",
    ok: false,
    ms: first.ms,
    error: String((first.error || "no response")).slice(0, 200)
  };
}

module.exports = { check };
