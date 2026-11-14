"use strict";
// Installed plugins, as the browser sees them: tile widgets and supervision
// cards share the same shape.
//
//   GET /api/widgets                 public metadata: config schema, labels
//   GET /widget-client/:id.js        browser renderer of a widget
//   GET /widget-client/:id.css       stylesheet of a widget
//   GET /api/supervisions            public metadata of the supervision plugins
//   GET /supervision-client/:id.js   browser renderer of a supervision card
//   GET /supervision-client/:id.css  stylesheet of a supervision card
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
  registerPluginRoutes(app, {
    listPath: "/api/supervisions",
    assetPrefix: "/supervision-client",
    core: supervisionCore
  });
}

module.exports = { registerWidgetRoutes, registerSupervisionRoutes };
