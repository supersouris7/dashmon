// Host metrics of an agent older than protocol 1.2, read as plugin reports.
// Before the supervision plugins, those reports were fields of the host
// (aptUpdates, smart, smartFetchedAt...), and scriptUpdates was keyed by
// those fields. Converted here once, the cards and the settings only read
// plugins.<id>. To remove once no agent older than 1.2 is in use.

// plugin id -> how to rebuild its report from the former host fields.
const LEGACY_REPORTS = {
  directories: { field: "directorySizes", report: host => host.directorySizes },
  wireguard: {
    field: "wireguard",
    report: host =>
      Array.isArray(host.wireguard)
        ? { interfaces: host.wireguard, fetchedAt: host.wireguardFetchedAt ?? null }
        : null
  },
  smart: {
    field: "smart",
    report: host =>
      Array.isArray(host.smart) && host.smart.length
        ? { disks: host.smart, fetchedAt: host.smartFetchedAt ?? null }
        : null
  },
  "apt-updates": { field: "aptUpdates", report: host => host.aptUpdates },
  opencode: { field: "opencode", report: host => host.opencode },
  claude: { field: "claude", report: host => host.claude }
};

export function withPluginReports(host) {
  if (!host || typeof host !== "object" || host.plugins) return host;
  const plugins = {};
  const scriptUpdates = {};
  for (const [id, legacy] of Object.entries(LEGACY_REPORTS)) {
    const report = legacy.report(host);
    if (report) plugins[id] = report;
    const script = host.scriptUpdates?.[legacy.field];
    if (script) scriptUpdates[id] = script;
  }
  return { ...host, plugins, scriptUpdates };
}
