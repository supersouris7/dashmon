"use strict";
// Stockage JSON pour les widgets, confine au dossier de donnees.
//
// Un widget qui a besoin de se souvenir d'un historique (note ELO, compteur,
// derniere version vue) ecrit un fichier JSON par son nom. Le core ne connait
// aucun widget : il ne fait qu'ouvrir un espace nomme et sur.
//
// Regles : nom de fichier strict (aucun separateur, donc aucune traversee),
// taille bornee, ecriture atomique (fichier temporaire puis renommage) pour
// qu'un arret brutal ne laisse pas un JSON tronque, et echec silencieux : un
// widget sans acces en ecriture doit degrader son affichage, pas le demarrage.

const fs = require("fs");
const path = require("path");

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_BYTES = 1024 * 1024; // 1 Mo : largement au-dela de nos besoins

class Storage {
  constructor({ dir, log }) {
    this.dir = path.join(dir, "widgets");
    this.log = typeof log === "function" ? log : () => {};
  }

  // null si le nom n'est pas un nom de fichier sur : c'est la seule defense
  // contre un widget qui tenterait d'ecrire ailleurs.
  file(name) {
    const clean = String(name == null ? "" : name);
    if (!NAME_PATTERN.test(clean)) return null;
    return path.join(this.dir, clean.toLowerCase() + ".json");
  }

  // Renvoie la valeur stockee, ou `fallback` si le fichier n'existe pas, est
  // illisible ou depasse la taille maximale.
  read(name, fallback = null) {
    const file = this.file(name);
    if (!file) return fallback;
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") this.log(`[storage] lecture ${name} : ${error.message}`);
      return fallback;
    }
    if (raw.length > MAX_BYTES) {
      this.log(`[storage] ${name} : fichier ignore (trop volumineux)`);
      return fallback;
    }
    try {
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      this.log(`[storage] ${name} : JSON illisible (${error.message})`);
      return fallback;
    }
  }

  write(name, value) {
    const file = this.file(name);
    if (!file) return false;
    let payload;
    try {
      payload = JSON.stringify(value);
    } catch (error) {
      this.log(`[storage] ${name} : valeur non serialisable (${error.message})`);
      return false;
    }
    if (!payload || payload.length > MAX_BYTES) {
      this.log(`[storage] ${name} : ecriture refusee (taille)`);
      return false;
    }
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(tmp, payload, "utf8");
      fs.renameSync(tmp, file);
      return true;
    } catch (error) {
      this.log(`[storage] ecriture ${name} : ${error.message}`);
      try { fs.unlinkSync(tmp); } catch (_) {}
      return false;
    }
  }
}

module.exports = { Storage, NAME_PATTERN, MAX_BYTES };
