"use strict";
// Pilotage generique de la configuration d'un widget a partir du `config` du
// manifest.
//
// Pourquoi ce module existe : avant, la forme exacte de la config d'un widget
// etait reecrite a la main dans quatre endroits (sortie API serveur, config
// par defaut cote editeur, normalisation cote etat, serialisation au
// "sauver"). Toute divergence = widget perdu a l'enregistrement. Ici, la forme
// est deduite d'une seule source (le manifest), donc plus de divergence
// possible : ajouter un champ dans le manifest suffit.

const { isPlainObject } = require("./registry");

const SECRET_PREFIX = "aes1.";

function str(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

// Valeur de configuration correspondant au champ, ou "" si absent.
function fieldValue(widget, key) {
  return widget && widget[key] !== undefined ? widget[key] : "";
}

// Valeurs par defaut issues du manifest : base de toute config neuve.
function defaultConfig(manifest) {
  const config = { type: manifest.id };
  for (const field of manifest.config || []) {
    config[field.key] = field.default === undefined ? "" : field.default;
  }
  return config;
}

// Normalisation "de confiance" : tronque, coerce, complete les defauts.
// Utilisee par le client (config recue du serveur) et par l'editeur.
function normalizeConfig(manifest, widget) {
  if (!isPlainObject(widget) || widget.type !== manifest.id) return null;
  const out = { type: manifest.id };
  for (const field of manifest.config || []) {
    const raw = fieldValue(widget, field.key);
    if (field.type === "checkbox") {
      out[field.key] = raw === true || raw === "true" || raw === "on" || raw === 1;
    } else if (field.type === "number") {
      let n = Number(raw);
      if (!Number.isFinite(n)) n = Number(field.default) || 0;
      out[field.key] = Math.min(field.max, Math.max(field.min, Math.trunc(n)));
    } else if (field.type === "select") {
      const wanted = str(raw, 100);
      const known = (field.options || []).some(option => option.value === wanted);
      out[field.key] = known ? wanted : str(field.default, 100);
    } else {
      // Un secret deja chiffre est conserve tel quel (jamais re-chiffre par le
      // client) : le serveur seul possede la cle maitresse.
      out[field.key] = isEncryptedSecret(raw) ? raw : str(raw, field.maxLength);
    }
  }
  return out;
}

// Reprise de config existante lors d'un changement de type de widget, ou du
// premier parametrage : on ne conserve que les cles communes.
function inheritConfig(manifest, previous) {
  const base = defaultConfig(manifest);
  if (!isPlainObject(previous) || previous.type !== manifest.id) return base;
  for (const field of manifest.config || []) {
    if (previous[field.key] !== undefined) base[field.key] = previous[field.key];
  }
  return base;
}

module.exports = {
  SECRET_PREFIX,
  isEncryptedSecret,
  fieldValue,
  defaultConfig,
  normalizeConfig,
  inheritConfig
};
