"use strict";
// Installed plugins, as the browser sees them: tile widgets and supervision
// cards share the same shape.
//
//   GET /api/widgets                 public metadata: config schema, labels
//   GET /widget-client/:id.js        browser renderer of a widget
//   GET /widget-client/:id.css       stylesheet of a widget
//   GET /api/supervisions                 public metadata of the supervision plugins
//   GET /supervision-client/:id/:file     a browser file a supervision manifest
//                                         declares (client, css, modules): one
//                                         folder per plugin, so its modules
//                                         import each other by relative path
//
// Neither server code nor secrets are ever exposed: the file served comes only
// from the manifest validated by the registry, so no path can be injected.

function registerPluginRoutes(app, { listPath, assetPrefix, core }) {
  app.get(listPath, (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(core.publicList());
  });

  for (const [extension, type] of [
    ["js", "text/javascript"],
    ["css", "text/css"]
  ]) {
    app.get(`${assetPrefix}/:id.${extension}`, (req, res) => {
      const asset = core.clientAsset(req.params.id, extension);
      if (!asset) return res.status(404).type("text/plain").send("Introuvable");
      res.set("Cache-Control", "public, max-age=300");
      res.type(type).send(asset.body);
    });
  }
}

function registerWidgetRoutes(app, { widgetCore }) {
  registerPluginRoutes(app, {
    listPath: "/api/widgets",
    assetPrefix: "/widget-client",
    core: widgetCore
  });
}

function registerSupervisionRoutes(app, { supervisionCore }) {
  app.get("/api/supervisions", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(supervisionCore.publicList());
  });
  app.get("/supervision-client/:id/:file", (req, res) => {
    const asset = supervisionCore.asset(req.params.id, req.params.file);
    if (!asset) return res.status(404).type("text/plain").send("Introuvable");
    res.set("Cache-Control", "public, max-age=300");
    res.type(asset.type).send(asset.body);
  });
}

module.exports = { registerWidgetRoutes, registerSupervisionRoutes };
