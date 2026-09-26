"use strict";
// Moteur d'extensions Dashmon : decouverte, validation et chargement de
// plugins (widgets de tuile aujourd'hui, demain metriques d'hotes, sondes, ...).
//
// Principes :
//  - un plugin = un dossier + un manifest.json declaratif ;
//  - un plugin casse NE DOIT PAS empecher l'application de demarrer ;
//  - aucune dependance, aucun build, aucun import obligatoire : un contributeur
//    tiers copie un dossier, edite 3 fichiers, et c'est fini.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

// Identifiants : minuscules, tirets, 32 caracteres max. "_template" et autres
// dossiers commencent par un caractere interdit -> ignores comme plugins.
const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

const FIELD_TYPES = new Set(["text", "secret", "select", "number", "checkbox"]);

const MAX_FIELDS = 24;
const MAX_OPTIONS = 32;
const MAX_STRINGS = 200;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function asLocalized(value) {
  if (isPlainObject(value)) {
    const out = {};
    for (const lang of ["fr", "en"]) {
      if (value[lang] != null) out[lang] = str(value[lang], 200);
    }
    return Object.keys(out).length ? out : null;
  }
  if (typeof value === "string" && value.trim()) return { fr: value.trim(), en: value.trim() };
  return null;
}

function validateField(raw, index, errors) {
  const at = `config[${index}]`;
  if (!isPlainObject(raw)) {
    errors.push(`${at}: champ invalide`);
    return null;
  }
  const key = str(raw.key, 40);
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
    errors.push(`${at}: "key" doit matcher ^[a-z][a-z0-9_]{0,39}$`);
    return null;
  }
  const type = str(raw.type, 20) || "text";
  if (!FIELD_TYPES.has(type)) {
    errors.push(`${at}: type "${type}" inconnu (${[...FIELD_TYPES].join(", ")})`);
    return null;
  }
  const field = {
    key,
    type,
    label: str(raw.label, 80) || key,
    default: raw.default === undefined ? "" : raw.default
  };

  if (type === "select") {
    const options = Array.isArray(raw.options) ? raw.options.slice(0, MAX_OPTIONS) : [];
    if (!options.length) {
      errors.push(`${at}: un champ "select" exige des options`);
      return null;
    }
    field.options = options.map(option => ({
      value: str(option && option.value, 100),
      label: str(option && option.label, 100) || str(option && option.value, 100)
    }));
  }

  if (type === "number") {
    const min = Number(raw.min);
    const max = Number(raw.max);
    field.min = Number.isFinite(min) ? min : 0;
    field.max = Number.isFinite(max) ? max : 1000;
  }

  // Longueur max : garde-fou de securite (la valeur est stockee dans
  // config.json, donc persists et relu a chaque GET /api/config).
  const maxLength = Number(raw.maxLength);
  field.maxLength = Number.isFinite(maxLength) && maxLength > 0
    ? Math.min(Math.trunc(maxLength), 2000)
    : (type === "secret" ? 2000 : 200);

  if (raw.placeholder != null) field.placeholder = str(raw.placeholder, 120);
  if (raw.title != null) field.title = asLocalized(raw.title);

  // Visibilite conditionnelle : {"key":"mode","equals":"tcp"}
  if (isPlainObject(raw.when)) {
    const whenKey = str(raw.when.key, 40);
    if (/^[a-z][a-z0-9_]{0,39}$/.test(whenKey)) {
      field.when = { key: whenKey, equals: str(raw.when.equals, 100) };
    }
  }
  return field;
}

function validateManifest(id, raw, errors) {
  if (!isPlainObject(raw)) {
    errors.push("manifest.json : objet attendu");
    return null;
  }
  if (raw.id != null && str(raw.id, 40) !== id) {
    errors.push(`manifest.json : "id" (${str(raw.id, 40)}) ne correspond pas au dossier (${id})`);
    return null;
  }

  const label = asLocalized(raw.label) || { fr: id, en: id };
  const manifest = {
    id,
    version: str(raw.version, 20) || "0.0.0",
    label,
    description: asLocalized(raw.description),
    // Periode de re-verification (ms). 0 = valeur par defaut du moteur.
    interval: Number.isFinite(Number(raw.interval)) && Number(raw.interval) > 0
      ? Number(raw.interval)
      : 5 * 60 * 1000,
    // "service" : une entree de cache par service ( Defaut ).
    // "config"  : une entree de cache partagee par configuration ( ex. Docker ).
    cacheKey: raw.cacheKey === "config" ? "config" : "service",
    // "link" : ce plugin traite les services qui n'ont pas de widget, c'est
    // a dire les liens web. Un seul plugin peut le revendiquer.
    defaultFor: raw.defaultFor === "link" ? "link" : "",
    // true : le widget n'est propose dans aucun menu (son existence est un
    // detail d'implementation, pas un choix de l'utilisateur).
    hidden: raw.hidden === true,
    // true : ce plugin EST la sonde du lien. Le core ne lance donc pas de
    // second controle et l'etat up/down de la tuile est celui renvoye par
    // check() plutot que l'identifiant du widget.
    probe: raw.probe === true,
    server: str(raw.server, 60),
    client: str(raw.client, 60),
    css: str(raw.css, 60),
    strings: {},
    config: []
  };

  if (raw.strings != null) {
    if (!isPlainObject(raw.strings)) {
      errors.push("strings : objet attendu");
    } else {
      for (const lang of ["fr", "en"]) {
        const pack = raw.strings[lang];
        if (pack == null) continue;
        if (!isPlainObject(pack)) {
          errors.push(`strings.${lang} : objet attendu`);
          continue;
        }
        const out = {};
        for (const [key, value] of Object.entries(pack).slice(0, MAX_STRINGS)) {
          if (/^[a-zA-Z0-9_.-]{1,60}$/.test(key)) out[key] = str(value, 200);
        }
        manifest.strings[lang] = out;
      }
    }
  }

  if (raw.config != null) {
    if (!Array.isArray(raw.config)) {
      errors.push("config : tableau de champs attendu");
    } else {
      const seen = new Set();
      for (const [index, item] of raw.config.slice(0, MAX_FIELDS).entries()) {
        const field = validateField(item, index, errors);
        if (!field) continue;
        if (seen.has(field.key)) {
          errors.push(`config: clé dupliquée "${field.key}"`);
          continue;
        }
        seen.add(field.key);
        manifest.config.push(field);
      }
    }
  }
  return manifest;
}

class Registry {
  // kind: nom du point d'extension ("widget", ...) — utilise dans les logs.
  // roots: liste de dossiers balayes (plugins natifs + dossier utilisateur).
  constructor({ kind, roots, logger, requireModule }) {
    this.kind = kind;
    this.roots = roots.filter(Boolean);
    this.logger = logger || (() => {});
    this.requireModule = requireModule || require;
    this.items = new Map();
    this.slots = new Map();
    this.failures = [];
  }

  // Charge un module CommonJS ou ESM sans jamais faire echouer le demarrage.
  async loadModule(file) {
    try {
      return this.requireModule(file);
    } catch (error) {
      // Node refuse le require() d'un ESM : on retente en import dynamique.
      if (error && error.code === "ERR_REQUIRE_ESM") return import(pathToFileURL(file).href);
      throw error;
    }
  }

  async load() {
    for (const root of this.roots) {
      let entries;
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch (error) {
        this.logger(`[${this.kind}] dossier ${root} illisible (${error.message}) — ignoré`);
        continue;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) continue;
        // Un nom invalide est ignore. S'il commence par "_" c'est volontaire
        // (modele, dossier prive) : aucun avertissement. Sinon, si le dossier
          // porte bien un manifest, c'est presque surement une faute de frappe :
          // on le signale plutot que de disparaitre en silence.
        if (!ID_PATTERN.test(entry.name)) {
          if (!entry.name.startsWith("_") && fs.existsSync(path.join(root, entry.name, "manifest.json"))) {
            this.fail(entry.name, `nom de dossier invalide (minuscules, tirets, 32 caracteres max) : "${entry.name}"`);
          }
          continue;
        }
        await this.loadOne(path.join(root, entry.name), entry.name);
      }
    }
    return this;
  }

  async loadOne(dir, id) {
    const errors = [];
    let manifest;
    try {
      manifest = validateManifest(id, JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")), errors);
    } catch (error) {
      this.fail(id, `manifest.json illisible : ${error.message}`);
      return;
    }
    if (!manifest || errors.length) {
      this.fail(id, errors.join(" ; ") || "manifest.json invalide");
      return;
    }
    // Aucun nom de fichier fourni ne doit permettre de sortir du dossier.
    for (const key of ["server", "client", "css"]) {
      const value = manifest[key];
      if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
        this.fail(id, `${key} : nom de fichier non autorisé (${value})`);
        return;
      }
    }

    const item = { ...manifest, dir };

    if (manifest.server) {
      const file = path.join(dir, manifest.server);
      if (!fs.existsSync(file)) {
        this.fail(id, `module serveur introuvable : ${manifest.server}`);
        return;
      }
      try {
        const loaded = await this.loadModule(file);
        const definition = loaded && loaded.default ? loaded.default : loaded;
        const check = definition && (definition.check || (typeof definition === "function" ? definition : null));
        if (typeof check !== "function") {
          this.fail(id, "le module serveur doit exporter { check(ctx) }");
          return;
        }
        item.check = check;
        item.createState = typeof definition.createState === "function"
          ? definition.createState
          : () => ({});
        if (typeof definition.purge === "function") item.purge = definition.purge;
      } catch (error) {
        this.fail(id, `module serveur en erreur : ${error.message}`);
        return;
      }
    }

    if (manifest.client && !fs.existsSync(path.join(dir, manifest.client))) {
      this.fail(id, `module client introuvable : ${manifest.client}`);
      return;
    }
    if (manifest.css && !fs.existsSync(path.join(dir, manifest.css))) {
      this.fail(id, `feuille de style introuvable : ${manifest.css}`);
      return;
    }

    // Un seul plugin peut revendiquer un slot : deux plugins "par defaut" pour
    // les liens se disputeraient silencieusement le meme service, on refuse
    // donc de charger le second plutot que de trancher au hasard.
    if (manifest.defaultFor) {
      const owner = this.slots.get(manifest.defaultFor);
      if (owner) {
        this.fail(id, `slot "${manifest.defaultFor}" déjà revendiqué par "${owner}"`);
        return;
      }
      this.slots.set(manifest.defaultFor, id);
    }

    this.items.set(id, item);
    this.logger(`[${this.kind}] ${id} v${item.version} chargé (${this.describeConfig(item)})`);
  }

  // Plugin responsable d'un slot ("link" : les liens web sans widget).
  bySlot(slot) {
    const id = this.slots.get(slot);
    return id ? this.get(id) : null;
  }

  describeConfig(item) {
    const parts = [];
    if (item.check) parts.push("check");
    if (item.client) parts.push("render");
    if (item.config && item.config.length) parts.push(`${item.config.length} champ(s)`);
    return parts.join(", ") || "sans backend";
  }

  fail(id, reason) {
    this.failures.push({ id, reason });
    this.logger(`[${this.kind}] ${id} IGNORÉ — ${reason}`);
  }

  has(id) {
    return this.items.has(id);
  }

  get(id) {
    return this.items.get(id) || null;
  }

  ids() {
    return [...this.items.keys()];
  }

  // Métadonnées publiques (aucun secret) envoyées au navigateur.
  publicList() {
    return [...this.items.values()]
      .map(item => ({
        id: item.id,
        version: item.version,
        label: item.label,
        description: item.description || null,
        hasConfig: !!(item.config && item.config.length),
        hasCss: !!item.css,
        // Un plugin interne n'est pas propose dans les menus.
        hidden: item.hidden === true,
        config: item.config || [],
        strings: item.strings || {}
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

module.exports = {
  Registry,
  ID_PATTERN,
  FIELD_TYPES,
  isPlainObject,
  validateManifest,
  validateField
};
