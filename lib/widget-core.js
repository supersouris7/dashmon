"use strict";
// Noyau serveur des widgets de tuile.
//
// Le core ne connait AUCUN widget nomme : il charge le registre, dispatche sur
// le type trouve dans la config, gere le cache, la frequence, les secrets et la
// purge. Ajouter un widget ne touche donc jamais server.js.

const path = require("path");
const fs = require("fs");

const { Registry } = require("./registry");
const schema = require("./widget-schema");
const httpClient = require("./http");
const { Storage } = require("./storage");

const DEFAULT_INTERVAL = 5 * 60 * 1000;

// Dossier des plugins tiers monte en volume (optionnel).
function extraRoot() {
  const dir = process.env.DASHMON_WIDGET_DIR || process.env.DASHMON_PLUGINS_DIR;
  return dir ? path.resolve(dir) : "";
}

// Resolution d'un libelle declare dans le manifest : fr, puis en.
function localize(strings, key, fallback) {
  const pack = strings || {};
  const value = (pack.fr && pack.fr[key]) || (pack.en && pack.en[key]);
  return value || fallback || key;
}

class WidgetCore {
  // options: { root, dataDir, log, decryptSecret, encryptSecret, sanitizeText, sanitizeUrl, statusCache }
  constructor(options) {
    this.root = options.root;
    this.dataDir = options.dataDir;
    this.log = options.log || (() => {});
    this.decryptSecret = options.decryptSecret;
    this.encryptSecret = options.encryptSecret;
    this.sanitizeText = options.sanitizeText;
    this.sanitizeUrl = options.sanitizeUrl;
    this.statusCache = options.statusCache;
    this.registry = new Registry({
      kind: "widget",
      roots: [path.join(this.root, "widgets"), extraRoot()],
      logger: this.log
    });
    // Memoire par widget (tokens en cache, historiques, ...) : creee une fois.
    this.states = new Map();
    // Persistance par widget : ce qui doit survivre a un redemarrage.
    this.storage = new Storage({ dir: this.dataDir, log: this.log });
  }

  async load() {
    await this.registry.load();
    for (const [id, item] of this.registry.items) {
      this.states.set(id, item.createState ? item.createState() : {});
    }
    return this;
  }

  get(id) {
    return this.registry.get(String(id || ""));
  }

  has(id) {
    return this.registry.has(String(id || ""));
  }

  // Widget installe ET doté d'un backend : seul cas declenchant un check.
  isCheckable(id) {
    const item = this.get(id);
    return !!(item && item.check);
  }

  hasConfigFields(id) {
    const item = this.get(id);
    return !!(item && item.config && item.config.length);
  }

  // Plugin responsable d'un service : celui de son widget s'il en a un, sinon
  // le plugin qui revendique le slot "link" (les liens web n'ont pas de widget
  // mais restent surveilles). Le core ne connait aucun plugin nomme.
  pluginFor(service) {
    const type = service && service.widget && service.widget.type;
    if (type) return this.get(type);
    return this.registry.bySlot("link");
  }

  // true quand un plugin sait surveiller ce service : widget installe, ou lien
  // web alors que le plugin de sondage est present.
  handles(service) {
    const item = this.pluginFor(service);
    return !!(item && item.check);
  }

  // Plugin de sondage des liens (slot "link"), s'il est installe.
  linkPlugin() {
    return this.registry.bySlot("link");
  }

  interval(service) {
    const item = this.pluginFor(service);
    return item ? item.interval : DEFAULT_INTERVAL;
  }

  // Cle de cache : par service (URL) ou partagee par configuration.
  cacheKey(service) {
    const widget = (service && service.widget) || {};
    const item = this.pluginFor(service);
    if (item && item.cacheKey === "config") {
      const parts = (item.config || []).map(field =>
        field.type === "secret"
          ? String(widget[field.key] == null ? "" : widget[field.key]).length + ":" +
            // Une valeur chiffree change a chaque re-chiffrement : on compare
            // uniquement la longueur pour garder une cle stable.
            String(widget[field.key] == null ? "" : widget[field.key]).slice(0, 8)
          : String(widget[field.key] == null ? "" : widget[field.key])
      );
      return `${item.id}:${parts.join("|")}`;
    }
    return this.sanitizeUrl(service && service.url) || (service && service.url) || "";
  }

  // Config "de travail" : comme en memoire mais secrets en clair pour le check.
  // (Les valeurs chiffrees restent intactes si la cle maitresse est absente.)
  runtimeConfig(item, widget) {
    const out = { type: item.id };
    for (const field of item.config || []) {
      const raw = widget ? widget[field.key] : "";
      out[field.key] = field.type === "secret" ? this.decryptSecret(raw) : raw;
    }
    return out;
  }

  // --- Serialisation de la config (API + ecriture disque) ----------------

  // Forme de la config exposee au client et stockee sur disque.
  sanitizeWidget(widget) {
    if (!widget || !widget.type) return null;
    const item = this.get(widget.type);
    if (!item) return null;
    const out = { type: item.id };
    for (const field of item.config || []) {
      const raw = schema.fieldValue(widget, field.key);
      let value;
      if (field.type === "secret") {
        // Chiffre a l'ecriture, deja-chiffre conserve tel quel.
        value = schema.isEncryptedSecret(raw) ? String(raw).slice(0, 2000) : this.encryptSecret(raw);
      } else if (field.type === "number") {
        let n = Number(raw);
        if (!Number.isFinite(n)) n = Number(field.default) || 0;
        value = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
      } else if (field.type === "select") {
        const wanted = String(raw == null ? "" : raw).trim();
        const known = (field.options || []).some(option => option.value === wanted);
        value = known ? wanted : String(field.default == null ? "" : field.default);
      } else {
        value = String(raw == null ? "" : raw).trim().slice(0, field.maxLength);
      }
      out[field.key] = value;
    }
    return out;
  }

  // Widget dont le type n'est pas installe : le core ne connait pas son schema,
  // donc il ne l'invente pas. On conserve les champs tels quels plutot que de les
  // supprimer, pour qu'un plugin temporairement casse (dossier absent, manifeste
  // invalide) ne perde pas sa config au prochain enregistrement.
  preserveWidget(widget) {
    if (!widget || !widget.type) return null;
    const type = String(widget.type).trim().slice(0, 64);
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(type)) return null;
    const out = {};
    for (const key of Object.keys(widget)) {
      if (key === "type") continue;
      if (!/^[A-Za-z_$][\w$-]{0,63}$/.test(key)) continue;
      const value = widget[key];
      if (typeof value === "string") out[key] = value.slice(0, 2000);
      else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
      else if (typeof value === "boolean") out[key] = value;
    }
    out.type = type;
    return out;
  }

  // --- Execution ----------------------------------------------------------

  // Lance le check d'un widget. Ne leve jamais : les erreurs sont reportees
  // dans l'entree de cache, comme le reste du statut.
  async check(service) {
    const widget = (service && service.widget) || {};
    const item = this.pluginFor(service);
    const key = this.cacheKey(service);
    const started = Date.now();

    if (!item || !item.check) {
      this.statusCache[key] = {
        state: String(widget.type || "unknown"),
        ok: false,
        error: "Widget inconnu ou sans backend",
        ms: 0,
        lastCheck: Date.now()
      };
      return;
    }

    // L'entree precedente sert a ne pas signaler deux fois la meme panne.
    const previous = this.statusCache[key];
    const entry = { state: item.id, ok: false, lastCheck: Date.now() };
    this.statusCache[key] = entry;

    try {
      const result = await item.check({
        config: this.runtimeConfig(item, widget),
        service,
        state: this.states.get(item.id),
        registry: this,
        sanitizeUrl: this.sanitizeUrl,
        sanitizeText: this.sanitizeText,
        strings: item.strings || {},
        // Messages d'erreur localises a partir des strings du manifest.
        t: key => localize(item.strings, key),
        api: httpClient.apiRequest,
        // Sonde HTTP "est-ce que ca repond ?" : { ok, code, ms, error }.
        probe: (href, timeout) => httpClient.httpProbe(href, timeout),
        // Persistance : ctx.storage.read(nom, defaut) / ctx.storage.write(nom, valeur).
        storage: this.storage,
        log: this.log
      });
      // Un plugin qui mesure lui-meme son temps de reponse (sonde HTTP, appel
      // d'API) garde ce chiffre : c'est lui qui a lieu d'etre affiche. Sinon on
      // mesure la duree totale du check.
      const measured = !!(result && typeof result === "object" && Number.isFinite(Number(result.ms)));
      if (result && typeof result === "object") Object.assign(entry, result);
      // Un plugin "sonde" EST le controle du lien : son etat up/down compte
      // pour la tuile, et c'est lui qui decide (un lien peut repondre alors
      // que l'API refuse de livrer la metrique). Les autres widgets gardent
      // leur identifiant comme etat, la couleur de la tuile venant de leur
      // renderer.
      entry.state = item.probe
        ? (entry.state === "up" || entry.state === "down" ? entry.state : (entry.ok ? "up" : "down"))
        : item.id;
      entry.ok = entry.ok === true;
      if (!measured) entry.ms = Date.now() - started;
      entry.lastCheck = Date.now();
      // Une panne de lien ne doit pas remplir le journal a chaque cycle : on
      // la signale au passage a down, comme le faisait la sonde codee en dur
      // avant l'arrivee des plugins.
      if (item.probe && entry.state === "down" && (!previous || previous.state !== "down")) {
        this.log(`[widget] ${item.id} DOWN : ${(service && service.url) || ""} — ${entry.error || "aucune réponse"}`);
      }
    } catch (error) {
      entry.error = String((error && error.message) || "Erreur widget").slice(0, 200);
      entry.ok = false;
      entry.ms = Date.now() - started;
      entry.lastCheck = Date.now();
      this.log(`[widget] ${item.id} : ${entry.error}`);
    }
  }

  // Appele apres chaque cycle : purge des caches de statut et des memoires
  // internes devenues orphelines.
  purge(services) {
    const active = new Set();
    const perWidget = new Map();
    for (const service of services || []) {
      const key = this.cacheKey(service);
      if (key) active.add(key);
      const type = service && service.widget && service.widget.type;
      if (!type) continue;
      if (!perWidget.has(type)) perWidget.set(type, new Set());
      // Pour les widgets à clé par service : on retient l'URL associee.
      if (this.sanitizeUrl(service.url)) perWidget.get(type).add(this.sanitizeUrl(service.url));
    }

    for (const key of Object.keys(this.statusCache)) {
      if (!active.has(key) && !active.has(key.replace(/\/$/, ""))) {
        delete this.statusCache[key];
      }
    }

    for (const [id, item] of this.registry.items) {
      if (typeof item.purge === "function") {
        try {
          item.purge(perWidget.get(id) || new Set(), this.states.get(id));
        } catch (error) {
          this.log(`[widget] ${id} purge : ${error.message}`);
        }
      }
    }
  }

  // --- Exposition HTTP ----------------------------------------------------

  // Metadonnees publiques : ni secrets, ni code serveur.
  publicList() {
    return this.registry.publicList();
  }

  // Lecture sure d'un fichier clientdeclare dans le manifest. La liste blanche
  // est le registre lui-meme : aucune traverse de chemin possible, et les
  // fichiers serveur ne sont jamais exposes.
  clientAsset(id, kind) {
    const item = this.get(id);
    if (!item) return null;
    const name = kind === "css" ? item.css : item.client;
    if (!name) return null;
    const file = path.join(item.dir, name);
    // Double garde-fou : le manifest est deja valide, on revalide l'absolu.
    if (!file.startsWith(item.dir + path.sep)) return null;
    try {
      return { body: fs.readFileSync(file), type: kind === "css" ? "text/css" : "text/javascript" };
    } catch (_error) {
      return null;
    }
  }
}

module.exports = { WidgetCore, DEFAULT_INTERVAL };
