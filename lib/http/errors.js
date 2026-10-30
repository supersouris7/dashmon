"use strict";
// Last handlers of the Express pipeline: unknown routes and uncaught errors.
// Both answer in JSON and never reveal internal details to the client.

function notFound(_req, res) {
  res.status(404).json({ error: "Route inconnue" });
}

function errorHandler(log) {
  // Express recognises an error handler by its four parameters.
  return (err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Corps JSON invalide" });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Fichier trop volumineux" });
    }
    log.error("Server error:", err.message);
    res.status(500).json({ error: "Erreur interne" });
  };
}

module.exports = { notFound, errorHandler };
