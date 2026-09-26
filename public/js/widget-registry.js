// Registre des widgets cote navigateur.
//
// Le navigateur ne connait aucun widget nomme : il recupere la liste publiee
// par le serveur (GET /api/widgets), puis charge dynamiquement le renderer de
// chaque widget (GET /widget-client/<id>.js). Ajouter un widget sur Dashmon
// n'oblige donc a modifier ni render.js, ni editor.js, ni state.js.
//
// Trois garanties :
//   1. resilience — un widget absent ou en erreur ne casse jamais le dashboard ;
//   2. securite — le module client n'a pas acces a la config serveur ni aux
//      secrets : il ne recoit que le statut calcule par le server.js du widget ;
//   3. schema declaratif — la forme de la config vient du manifest publie par
//      le serveur ; ce module ne fait qu'interpretuer ces metadonnees.

import { formatters } from "./format.js";

// Prefixe des secrets deja chiffres par le serveur (jamais re-chiffres ici).
const SECRET_PREFIX = "aes1.";

const metas = new Map();
const renderers = new Map();
let loaded = false;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value, max) {
  const limit = Number(max) > 0 ? Number(max) : 200;
  return String(value == null ? "" : value).trim().slice(0, limit);
}

// --- Chargement -----------------------------------------------------------

// Charge le registre et les renderers. Ne leve jamais : en cas d'echec on
// continue avec un registre vide (les widgets existant s'affichent alors en
// mode "indisponible" plutot que de casser le dashboard entier).
export async function loadWidgetRegistry() {
  loaded = true;
  let list = [];
  try {
    const response = await fetch("/api/widgets", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    list = await response.json();
  } catch (error) {
    console.error("Registre des widgets indisponible", error);
    return [];
  }
  if (!Array.isArray(list)) return [];

  const styleIds = [];
  for (const meta of list) {
    if (!meta || !meta.id) continue;
    metas.set(meta.id, meta);
    if (meta.hasCss) styleIds.push(meta.id);
    try {
      const module = await import("/widget-client/" + encodeURIComponent(meta.id) + ".js");
      if (typeof module.render === "function" || typeof module.element === "function") {
        renderers.set(meta.id, module);
      }
    } catch (error) {
      // Widget sans renderer ou module en erreur : la config reste editable,
      // seule l'affichage de la tuile reste neutre.
      console.warn("Renderer de widget indisponible : " + meta.id, error);
    }
  }
  injectStyles(styleIds);
  return [...metas.keys()];
}

function injectStyles(ids) {
  if (typeof document === "undefined" || !ids.length) return;
  const present = new Set(
    [...document.querySelectorAll("link[data-widget-style]")].map(link => link.dataset.widgetStyle)
  );
  for (const id of ids) {
    if (present.has(id)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.widgetStyle = id;
    link.href = "/widget-client/" + encodeURIComponent(id) + ".css";
    document.head.appendChild(link);
  }
}

// --- Metadonnees ----------------------------------------------------------

export function isRegistryLoaded() {
  return loaded;
}

export function listWidgetMetas() {
  return [...metas.values()];
}

export function getWidgetMeta(id) {
  return metas.get(String(id || "")) || null;
}

export function hasWidget(id) {
  return metas.has(String(id || ""));
}

// Libelle affiche du widget (menu de l'editeur, tuile).
export function widgetLabel(meta, lang) {
  if (!meta) return "";
  const label = meta.label || {};
  return label[lang] || label.fr || label.en || meta.id;
}

// Libelle traduit declare dans manifest.json -> strings.<lang>.<key>.
// Si la cle n'existe pas, la valeur est utilisee telle quelle : un tiers peut
// donc ecrire "label": "Mon champ" sans pack de traduction.
export function widgetString(meta, key, lang) {
  const pack = (meta && meta.strings) || {};
  const table = pack[lang] || pack.fr || pack.en || {};
  return table[key] || key;
}

export function fieldLabel(meta, field, lang) {
  return widgetString(meta, field.label || field.key, lang);
}

export function fieldPlaceholder(meta, field, lang) {
  return field.placeholder ? widgetString(meta, field.placeholder, lang) : "";
}

// Infobulle longue d'un champ, si le manifest en declare une.
export function fieldTitle(meta, field, lang) {
  const title = field.title;
  if (!title) return "";
  return typeof title === "string" ? title : (title[lang] || title.fr || title.en || "");
}

// Champs visibles pour une config donnee (regle "when" du manifest).
export function visibleFields(meta, config) {
  if (!meta || !Array.isArray(meta.config)) return [];
  const values = config || {};
  return meta.config.filter(field => {
    if (!field.when || !field.when.key) return true;
    return str(values[field.when.key], 100) === str(field.when.equals, 100);
  });
}

// --- Configuration --------------------------------------------------------

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

export { isEncryptedSecret };

// Genere l'interpreteur de schema local. Le serveur reste l'autorite (GET
// /api/config renvoie une config deja normalisee) : ces fonctions servent a
// l'editeur et a la normalisation de l'etat, pas a la validation de securite.
function normalizeWith(meta, widget) {
  const out = { type: meta.id };
  for (const field of meta.config || []) {
    const raw = widget[field.key] === undefined ? field.default : widget[field.key];
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
      // Un secret deja chiffre est conserve tel quel : le client ne possede
      // pas la cle maitresse et ne doit jamais la retransmettre en clair.
      out[field.key] = isEncryptedSecret(raw) ? raw : str(raw, field.maxLength);
    }
  }
  return out;
}

// Config neuve d'un widget (valeurs par defaut du manifest).
export function defaultWidgetConfig(id) {
  const meta = getWidgetMeta(id);
  if (!meta) return { type: String(id || "") };
  return normalizeWith(meta, {});
}

// Changement de type dans l'editeur : on repart des defauts et on ne
// conserve que les cles communes, donc jamais un secret d'un autre widget.
export function inheritWidgetConfig(id, previous) {
  const meta = getWidgetMeta(id);
  if (!meta) return { type: String(id || "") };
  const next = normalizeWith(meta, {});
  if (isPlainObject(previous) && previous.type === id) {
    for (const field of meta.config || []) {
      if (previous[field.key] !== undefined) next[field.key] = previous[field.key];
    }
  }
  return next;
}

// Normalisation d'une config recue du serveur.
// Regle de securite : un widget inconnu n'est JAMAIS amputé. Si le registre
// n'est pas (ou plus) disponible, on conserve la config telle quelle plutot que
// de perdre les reglages de l'utilisateur a la prochaine sauvegarde.
export function normalizeWidgetConfig(widget) {
  if (!isPlainObject(widget) || !widget.type) return null;
  const meta = getWidgetMeta(widget.type);
  if (!meta) return Object.assign({}, widget);
  return normalizeWith(meta, widget);
}

// --- Statut ---------------------------------------------------------------

// Cle de statut : publiee par le serveur (GET /api/config -> widget.key) pour
// que le client ne recompose jamais la cle et que les deux cotes ne puissent
// pas diverger. Aucun cas particulier par type ici.
export function widgetStatusKey(service) {
  if (service && service.widget && service.widget.key) return service.widget.key;
  return (service && service.url) || "";
}

// Rendu d'une tuile, delegue au renderer du widget. Ne leve jamais : une
// exception dans un renderer tiers degrade la tuile, jamais le dashboard.
export function renderWidget(service, info, lang) {
  const activeLang = lang === "en" ? "en" : "fr";
  const meta = getWidgetMeta(service && service.widget && service.widget.type);
  const label = widgetLabel(meta, activeLang);
  const fmt = formatters(activeLang);
  const fallback = title => ({
    badge: info ? (label || "?") + " -" : "-",
    badgeClass: "pending",
    time: "",
    timeClass: "",
    title: title || label
  });

  if (!meta) return fallback(info ? "Widget indisponible" : "");
  const module = renderers.get(meta.id);
  if (!module) return fallback(info ? "Renderer indisponible" : "");

  const ctx = {
    info: info || null,
    config: (service && service.widget) || {},
    lang: activeLang,
    t: key => widgetString(meta, key, activeLang),
    formatDateTime: fmt.formatDateTime,
    formatNumber: fmt.formatNumber,
    formatCompactNumber: fmt.formatCompactNumber
  };

  try {
    // Rendu totalement sur mesure : le widget renvoie lui-meme son noeud DOM.
    if (typeof module.element === "function") {
      const node = module.element(ctx);
      if (node) return { element: node, title: node.title || "" };
    }
    const view = module.render(ctx);
    if (!isPlainObject(view)) return fallback("Rendu invalide");
    return {
      badge: view.badge == null ? "" : String(view.badge),
      badgeClass: view.badgeClass ? String(view.badgeClass) : "",
      time: view.time == null ? "" : String(view.time),
      timeClass: view.timeClass ? String(view.timeClass) : "",
      title: view.title ? String(view.title) : label
    };
  } catch (error) {
    console.error("Rendu du widget " + meta.id, error);
    return fallback("Erreur de rendu");
  }
}
