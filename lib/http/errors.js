"use strict";
// Last handlers of the Express pipeline: unknown routes and uncaught errors.
// Both answer in JSON and never reveal internal details to the client.

const { apiError } = require("./api-errors");

function notFound(_req, res) {
  res.status(404).json({ ...apiError("route_not_found") });
}

function errorHandler(log) {
  // Express recognises an error handler by its four parameters.
  return (err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ ...apiError("invalid_json") });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ ...apiError("file_too_large") });
    }
    log.error("Server error:", err.message);
    res.status(500).json({ ...apiError("internal_error") });
  };
}

module.exports = { notFound, errorHandler };
