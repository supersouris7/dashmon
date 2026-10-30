import { sanitizeTileColor } from "./config/sanitize.js";
import { normalizeSpecialTile, normalizeLinkCounter } from "./config/normalize.js";
import { normalizeWidgetConfig } from "./widget-registry.js";
import { serializeHostMonitoring } from "./host-monitoring-draft.js";

// Transforme les brouillons en valeurs enregistrables sans modifier l'etat
// courant : l'editeur peut encore annuler apres validation ou conflit.
export function prepareEditorDraft(state) {
  const seen = new Set();
  const dashboards = state.editDashboards
    .map(d => ({
      id: String(d.id || "")
        .trim()
        .slice(0, 64),
      name: (d.name || "").trim(),
      icon: d.icon || "fa-solid fa-grip"
    }))
    .filter(d => d.name)
    .map(d => {
      let id = d.id;
      if (!id || id === "supervision" || seen.has(id))
        id = "dashboard-" + Math.random().toString(36).slice(2, 12);
      seen.add(id);
      return { id, name: d.name, icon: d.icon };
    });
  if (!dashboards.length)
    dashboards.push({ id: "main", name: "Dashboard", icon: "fa-solid fa-grip" });
  const dashboardIds = new Set(dashboards.map(d => d.id));
  const categories = state.editCategories
    .map(c => ({
      name: (c.name || "").trim(),
      icon: c.icon || "fa-solid fa-folder",
      color: sanitizeTileColor(c.color),
      dashboardId: dashboardIds.has(String(c.dashboardId || "").trim())
        ? String(c.dashboardId || "").trim()
        : dashboards[0].id
    }))
    .filter(c => c.name);
  const hosts = state.editHosts
    .map(h => ({
      id:
        String(h.id || "")
          .trim()
          .slice(0, 64) || "host-" + Math.random().toString(36).slice(2, 12),
      name: (h.name || "").trim(),
      icon: h.icon || "fa-solid fa-server",
      color: sanitizeTileColor(h.color),
      monitoring: serializeHostMonitoring(h.monitoring)
    }))
    .filter(h => h.name);
  let localHostSeen = false;
  hosts.forEach(host => {
    if (host.monitoring?.enabled && host.monitoring.type === "local") {
      if (localHostSeen) host.monitoring.enabled = false;
      localHostSeen = true;
    }
  });
  const validNames = new Set(categories.map(c => c.name));
  const validHosts = new Set(hosts.map(h => h.name));
  const services = state.editServices
    .map(service => ({
      name: (service.name || "").trim(),
      host: validHosts.has((service.host || "").trim()) ? (service.host || "").trim() : "",
      category: validNames.has(service.category)
        ? service.category
        : categories[0]?.name || "Autres",
      url: (service.url || "").trim(),
      icon: (service.icon || "").trim(),
      monitor: service.monitor === false ? false : service.monitor === "soft" ? "soft" : true,
      widget: normalizeWidgetConfig(service.widget)
    }))
    .filter(service => service.name);
  const removedNames = [
    ...new Set(
      state.services
        .map(service => service.name)
        .filter(Boolean)
        .filter(name => !services.some(service => service.name === name))
    )
  ];
  const webLinks = state.editWebLinks
    .map(link => ({
      name: (link.name || "").trim(),
      url: (link.url || "").trim(),
      icon: (link.icon || "").trim(),
      counter: normalizeLinkCounter(link.counter)
    }))
    .filter(link => link.name && link.url);
  const specialCategory =
    state.editSpecialTile && categories.some(c => c.name === state.editSpecialTile.category)
      ? state.editSpecialTile.category
      : categories[0]?.name || "Autres";
  const specialTile = state.editSpecialTile
    ? normalizeSpecialTile(
        { type: state.editSpecialTile.type, category: specialCategory },
        categories
      )
    : null;
  return { dashboards, categories, hosts, services, webLinks, specialTile, removedNames };
}
