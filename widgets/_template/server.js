"use strict";
// MODELE DE WIDGET — a copier dans un nouveau dossier, puis a adapter.
//
// Un widget Dashmon tient en TROIS fichiers dans son dossier :
//   manifest.json  : metadonnees, libelles, periodes, schema de configuration
//   server.js      : la logique metier (tourne dans le conteneur)
//   client.js      : le rendu de la tuile (tourne dans le navigateur)
//
// Rien d'autre n'a toucher : ni server.js, ni l'editeur, ni le CSS, ni i18n.
//
// Le dossier doit porter l'identifiant declare dans manifest.json. Le nommage
// "mowidget" est volontairement sobre ; un "_" en tete (comme _template) exclut
// le dossier du registre.

function createState() {
  // Memoire conservee entre deux checks (jetons en cache, historique...).
  // Facultatif : retirez la fonction si vous n'en avez pas besoin.
  return { calls: 0 };
}

// ctx = {
//   config  : configuration du widget, secrets DECHIFFRES a cet endroit,
//   service : le service tel qu'il figure dans config.json (name, url, ...),
//   state   : objet retourne par createState(),
//   api     : (baseUrl, path, options) => Promise<json>  (Bearer/Basic, timeout, IPv4),
//   sanitizeUrl, sanitizeText, t(key) : utilitaires du core
// }
//
// Retour attendu : un objet plat, serialisable en JSON, qui devient l'entree de
// statut affichee. Les champs "ok", "ms", "lastCheck" et "state" sont geres par
// le core ; les autres sont libres (ils sont lisibles par votre client.js).
// Levez une exception pour signaler une erreur : le core la recupere et l'affiche.
async function check(ctx) {
  const baseUrl = ctx.sanitizeUrl(ctx.config.apiUrl);
  if (!baseUrl) {
    return { ok: false, error: ctx.t("error") + " : URL invalide", value: null };
  }
  try {
    const data = await ctx.api(baseUrl, "/stats", { token: ctx.config.apiToken });
    ctx.state.calls++;
    return {
      ok: true,
      value: Number(data && data.value) || 0,
      detail: String((data && data.detail) || "")
    };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || "Erreur").slice(0, 200) };
  }
}

// Facultatif : appelee apres chaque cycle pour oublier ce qui n'est plus
// surveille ( jetons d'un serveur supprime, historique d'un service retire ).
// Le 1er argument est l'ensemble des URL encore surveillees pour ce widget.
// function purge(activeUrls, state) { ... }

module.exports = { createState, check };
