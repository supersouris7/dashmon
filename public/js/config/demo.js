// Example data offered on an empty dashboard and in Settings → Import / Export:
// a few well-known self-hosted applications spread over three fictional
// machines, to see what a filled dashboard looks like. Every address uses the
// documentation domain exemple.lan and the RFC 5737 range: none points to a
// real service. Monitoring is off, so the example shows no false outage.
import { normalizeConfig } from "./normalize.js";

const LABELS = {
  en: { media: "Media", network: "Network", tools: "Tools", router: "Router" },
  fr: { media: "Médias", network: "Réseau", tools: "Outils", router: "Routeur" }
};

export function demoData(language) {
  const label = LABELS[language] || LABELS.en;
  const service = (name, host, category, url) => ({
    name,
    host,
    category,
    url,
    icon: "",
    monitor: false,
    widget: null
  });
  return {
    categories: [
      { name: label.media, icon: "fa-solid fa-film" },
      { name: label.network, icon: "fa-solid fa-network-wired" },
      { name: label.tools, icon: "fa-solid fa-toolbox" }
    ],
    hosts: [
      { id: "demo-nas", name: "NAS", icon: "fa-solid fa-hard-drive" },
      { id: "demo-pi", name: "Raspberry Pi", icon: "fa-brands fa-raspberry-pi" },
      { id: "demo-minipc", name: "Mini PC", icon: "fa-solid fa-computer" }
    ],
    services: [
      service("Jellyfin", "NAS", label.media, "http://jellyfin.exemple.lan:8096"),
      service("qBittorrent", "NAS", label.media, "http://qbittorrent.exemple.lan:8080"),
      service("MeTube", "NAS", label.media, "http://metube.exemple.lan:8081"),
      service("AdGuard Home", "Raspberry Pi", label.network, "http://adguard.exemple.lan"),
      service("Uptime Kuma", "Raspberry Pi", label.network, "http://uptime.exemple.lan:3001"),
      service(label.router, "Raspberry Pi", label.network, "http://192.0.2.1"),
      service("Portainer", "Mini PC", label.tools, "https://portainer.exemple.lan:9443"),
      service("Gotify", "Mini PC", label.tools, "http://gotify.exemple.lan"),
      service("Duplicati", "Mini PC", label.tools, "http://duplicati.exemple.lan:8200")
    ],
    fortune: true
  };
}

// Adds the example to a configuration without touching what is already there:
// a category, host or application whose name exists is kept as it is. The
// categories go to the first dashboard, and the Fortune Cookie bar turns on.
export function withDemo(config, language) {
  const demo = demoData(language);
  const has = (list, name) => list.some(item => item && item.name === name);
  const categories = [...config.categories];
  for (const category of demo.categories)
    if (!has(categories, category.name))
      categories.push({ ...category, dashboardId: config.dashboards[0].id });
  const hosts = [...config.hosts];
  for (const host of demo.hosts)
    if (!has(hosts, host.name) && !hosts.some(item => item.id === host.id)) hosts.push(host);
  const services = [...config.services];
  for (const service of demo.services) if (!has(services, service.name)) services.push(service);
  const merged = normalizeConfig({
    services,
    categories,
    dashboards: config.dashboards,
    hosts
  });
  return {
    services: merged.services,
    categories: merged.categories,
    hosts: merged.hosts,
    fortune: demo.fortune
  };
}
