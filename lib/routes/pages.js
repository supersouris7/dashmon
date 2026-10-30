"use strict";
// HTML pages and static files of the web interface.
//
//   GET /login               login page (redirects home when already logged in)
//   GET /, /index.html       dashboard, or the agent page in agent mode
//   everything else          files from public/

const express = require("express");
const fs = require("fs");
const path = require("path");

function registerPageRoutes(
  app,
  { publicDir, password, auth, agentMode, versionLabel, hostMetricsInterval }
) {
  const loggedIn = req => auth.validSession(req) || auth.validBasicAuth(req);

  // The dashboard HTML carries values filled in once at start-up.
  const indexHtml = fs
    .readFileSync(path.join(publicDir, "index.html"), "utf8")
    .replace(/\{\{VERSION\}\}/g, versionLabel)
    .replace(/\{\{HOST_METRICS_INTERVAL\}\}/g, String(hostMetricsInterval));

  app.get("/login", (req, res) => {
    if (!password || loggedIn(req)) return res.redirect("/");
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(publicDir, "login.html"));
  });

  app.get(["/", "/index.html"], (req, res) => {
    if (password && !loggedIn(req)) return res.redirect("/login");
    // Always revalidated: the page carries the version label and the script
    // references. Cached HTML would show a stale version while the scripts
    // themselves load up to date.
    res.set("Cache-Control", "no-store");
    if (agentMode) return res.sendFile(path.join(publicDir, "agent.html"));
    res.type("html").send(indexHtml);
  });

  app.use(express.static(publicDir));
}

module.exports = { registerPageRoutes };
