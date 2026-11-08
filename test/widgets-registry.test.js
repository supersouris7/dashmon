"use strict";
// Widget tests: Registry of the bundled widgets and manifest validation.
// Shared helpers and fixtures: test/widgets/helpers.js.

const fs = require("fs");
const path = require("path");
const { validateManifest } = require("../lib/widgets/registry");
const { WIDGETS, check, ok, loadRegistry, run } = require("./widgets/helpers");

async function main() {
  const registry = await loadRegistry();

  const ids = registry.ids().slice().sort();
  // `_template` n'est pas un plugin : son identifiant ne respecte pas le motif
  // du registre, il sert de modele a copier.
  check("registre : widgets natifs charges, _template ignore", ids, [
    "adguard",
    "docker",
    "dockerhub",
    "duplicati",
    "github",
    "gotify",
    "lichess",
    "metube",
    "opencode",
    "ping",
    "qbittorrent",
    "uptimekuma",
    "web",
    "youtube"
  ]);
  check("registre : aucun echec de chargement", registry.failures, []);

  for (const id of ids) {
    const item = registry.get(id);
    ok("registre : " + id + " a un backend", typeof item.check === "function");
    // Le widget "web" n'a pas de renderer : c'est le client generique qui
    // dessine le point d'etat d'un lien. Il ne doit donc pas non plus
    // s'afficher dans le menu des widgets de l'editeur.
    if (!item.hidden) ok("registre : " + id + " a un renderer", typeof item.client === "string");
    ok("registre : " + id + " declare une periode", Number(item.interval) > 0);
    ok("registre : " + id + " a des libelles fr+en", !!(item.label.fr && item.label.en));
  }

  check(
    "registre : les plugins internes du moteur",
    registry
      .publicList()
      .filter(w => w.hidden)
      .map(w => w.id),
    ["dockerhub", "github", "web", "youtube"]
  );
  check(
    'registre : un lien nu est pris en charge par le plugin "link"',
    registry.bySlot("link") && registry.bySlot("link").id,
    "web"
  );
  // GitHub, Docker Hub et YouTube ne sont pas des widgets de tuile : ce sont les
  // sources des compteurs du bandeau "Liens web", donc internes au moteur.
  check(
    "registre : les compteurs de liens ne sont pas des widgets de tuile",
    registry
      .publicList()
      .filter(w => !w.hidden)
      .map(w => w.id),
    [
      "adguard",
      "docker",
      "duplicati",
      "gotify",
      "lichess",
      "metube",
      "opencode",
      "ping",
      "qbittorrent",
      "uptimekuma"
    ]
  );

  // Le template est bien un modele exploitable, mais volontairement hors registre.
  ok(
    "template : present sur disque mais non charge",
    fs.existsSync(path.join(WIDGETS, "_template", "manifest.json")) && !registry.has("_template")
  );

  // --- Schema : validation d'un manifest -------------------------------
  // Le modele est volontairement hors registre : son id ne peut pas suivre le
  // dossier "_template" (un identifiant commence par une lettre minuscule).
  const templateErrors = [];
  const templateManifest = JSON.parse(
    fs.readFileSync(path.join(WIDGETS, "_template", "manifest.json"), "utf8")
  );
  check(
    "schema : le template n'est pas chargeable tel quel",
    validateManifest("_template", templateManifest, templateErrors),
    null
  );
  ok(
    "schema : le template est signale comme invalide",
    templateErrors.length >= 1,
    templateErrors.join(" ; ")
  );

  // Un manifest complet et coherent est en revanche accepte tel quel.
  const errors = [];
  const manifest = validateManifest(
    "demo",
    {
      id: "demo",
      label: { fr: "Demo", en: "Demo" },
      server: "server.js",
      client: "client.mjs",
      config: [{ key: "jeton", type: "secret", maxLength: 200 }]
    },
    errors
  );
  ok("schema : un manifest complet est valide", !!manifest && !errors.length, errors.join(" ; "));
  check(
    "schema : config copiee telle quelle",
    manifest.config.map(f => f.key),
    ["jeton"]
  );

  // Un id qui ne correspond pas au dossier est rejete : rien n'est renvoye.
  const mismatch = [];
  check("schema : id incoherent rejete", validateManifest("autre", { id: "demo" }, mismatch), null);
  ok("schema : id incoherent signale", mismatch.length === 1, mismatch.join(" ; "));

  const badType = [];
  const bad = validateManifest("demo", { config: [{ key: "x", type: "fichier" }] }, badType);
  ok(
    "schema : type de champ inconnu rejete",
    !bad.config.some(f => f.type === "fichier") && badType.length === 1
  );

  const dup = [];
  const dupManifest = validateManifest("demo", { config: [{ key: "a" }, { key: "a" }] }, dup);
  check(
    "schema : cle dupliquee eliminee",
    dupManifest.config.map(f => f.key),
    ["a"]
  );
  ok("schema : cle dupliquee signalee", dup.length === 1);
}

run(main);
