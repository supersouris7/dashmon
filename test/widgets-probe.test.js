"use strict";
// Widget tests: HTTP probe of the link plugin (local loopback only) and the shared HTTP client limits.
// Shared helpers and fixtures: test/widgets/helpers.js.

const path = require("path");
const { WIDGETS, check, ok, show, run } = require("./widgets/helpers");

async function main() {
  const httpLib = require("../lib/http/client");
  // --- Sonde HTTP du plugin de lien (boucle locale uniquement) ------------
  // Le plugin "web" remplace la sonde codee en dur de server.js : elle est donc
  // testee pour de vrai, sur un serveur qui n'ecoute que sur 127.0.0.1.
  const nodeHttp = require("http");
  const webServer = require(path.join(WIDGETS, "web", "server.js"));
  const listener = nodeHttp.createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("bonjour");
      return;
    }
    if (req.url === "/gros") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("x".repeat(64 * 1024));
      return;
    }
    if (req.url === "/boum") {
      res.writeHead(503);
      res.end("service arrete");
      return;
    }
    res.writeHead(404);
    res.end("introuvable");
  });
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + listener.address().port;
  const probeCtx = url => ({
    service: { url, monitor: true },
    t: k => k,
    probe: (href, timeout) => httpLib.httpProbe(href, timeout)
  });
  try {
    const live = await webServer.check(probeCtx(base + "/ok"));
    check(
      "web : lien qui repond = point vert",
      [live.state, live.ok, live.code],
      ["up", true, 200]
    );
    ok("web : temps de reponse mesure", Number.isFinite(live.ms), show(live));
    const broken = await webServer.check(probeCtx(base + "/boum"));
    // Une erreur 5xx est un echec du service derriere : nginx repond, mais
    // l'application est tombee. Une pastille verte serait un faux positif, donc
    // 503 tombe en rouge. Le code reste visible pour le diagnostic.
    check(
      "web : erreur 5xx = point rouge",
      [broken.state, broken.ok, broken.code],
      ["down", false, 503]
    );
    check("web : l'erreur nomme le code HTTP", /503/.test(broken.error || ""), true);
    const gone = await webServer.check(probeCtx(base + "/absent"));
    // 4xx en revanche prouve que la cible est joignable : une page sous
    // authentification (401/403) reste verte, sinon tout tableau de bord protege
    // serait en alarme permanente.
    check(
      "web : 404 = point vert (la cible repond)",
      [gone.state, gone.ok, gone.code],
      ["up", true, 404]
    );
    // Port 1 : rien n'y ecoute, la connexion est refusee.
    const refused = await webServer.check(probeCtx("http://127.0.0.1:1/"));
    check("web : connexion refusee = point rouge", [refused.state, refused.ok], ["down", false]);
    ok("web : pas de second essai sur 127.0.0.1", refused.via == null, show(refused));
    check("web : URL vide", (await webServer.check(probeCtx(""))).state, "down");
    check("web : URL invalide", (await webServer.check(probeCtx("pas une url"))).state, "down");
    check(
      "web : protocole non http",
      (await webServer.check(probeCtx("ftp://exemple.test/"))).state,
      "down"
    );

    // --- Client HTTP : lecture de page (raw) et plafond de corps ----------
    // Le widget YouTube lit du HTML : `raw` lui renvoie le texte et le code.
    check("http : plafond de corps par defaut", httpLib.getMaxBody(), httpLib.MAX_BODY);
    check(
      "http : un plugin peut augmenter le plafond",
      httpLib.getMaxBody(6 * 1024 * 1024),
      6 * 1024 * 1024
    );
    check(
      "http : le plafond reste borne pour un tiers",
      httpLib.getMaxBody(500 * 1024 * 1024),
      httpLib.MAX_BODY_LIMIT
    );
    const rawPage = await httpLib.apiRequest(base, "/ok", { raw: true });
    check(
      "http : raw renvoie le texte et le code",
      [rawPage.status, rawPage.body],
      [200, "bonjour"]
    );
    const rawMissing = await httpLib.apiRequest(base, "/absent", { raw: true }).catch(e => e);
    check("http : raw signale aussi les erreurs HTTP", rawMissing.status, 404);
    // Sans `raw`, une page HTML ne doit pas tenter d'etre du JSON.
    const asJson = await httpLib.apiRequest(base, "/ok");
    check("http : sans raw, une page HTML vaut null", asJson, null);
    // Le plafond coupe la reponse quand le plugin en demande un plus petit que
    // la page : c'est ce qui arrive si le HTML d'une chaine s'allonge.
    const tooBig = await httpLib
      .apiRequest(base, "/gros", { raw: true, maxBody: 1024 })
      .catch(e => e);
    check(
      "http : corps trop gros pour le plafond demande",
      /volumineuse/i.test(tooBig.message),
      true
    );
    const bigEnough = await httpLib.apiRequest(base, "/gros", { raw: true, maxBody: 128 * 1024 });
    check(
      "http : le meme corps passe avec un plafond plus large",
      bigEnough.body.length,
      64 * 1024
    );
    ok(
      "http : valeur de maxBody invalide = defaut",
      httpLib.getMaxBody("beaucoup") === httpLib.MAX_BODY
    );
  } finally {
    await new Promise(resolve => listener.close(resolve));
  }
}

run(main);
