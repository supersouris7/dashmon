"use strict";
// One log line per answered request: method, URL, status and duration.

function requestLog(log) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      log.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  };
}

module.exports = { requestLog };
