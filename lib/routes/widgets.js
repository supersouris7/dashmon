"use strict";
// Installed tile widgets, as the browser sees them.
//
//   GET /api/widgets            public metadata: config schema, labels, icon
//   GET /widget-client/:id.js   browser renderer of a widget
//   GET /widget-client/:id.css  stylesheet of a widget
//
// Neither server code nor secrets are ever exposed: the file served comes only
// from the manifest validated by the registry, so no path can be injected.

function registerWidgetRoutes(app, { widgetCore }) {
  app.get("/api/widgets", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(widgetCore.publicList());
  });

  for (const [extension, type] of [
    ["js", "text/javascript"],
    ["css", "text/css"]
  ]) {
    app.get(`/widget-client/:id.${extension}`, (req, res) => {
      const asset = widgetCore.clientAsset(req.params.id, extension);
      if (!asset) return res.status(404).type("text/plain").send("Introuvable");
      res.set("Cache-Control", "public, max-age=300");
      res.type(type).send(asset.body);
    });
  }
}

module.exports = { registerWidgetRoutes };
