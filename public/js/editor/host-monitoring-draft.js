import {
  HOST_MONITORING_TYPES,
  SPEEDTEST_DEFAULT_INTERVAL,
  normalizeSpeedtestPrefs
} from "../config/normalize.js";

// Working values: no monitoring is enabled without an explicit action.
export function blankMonitoring() {
  return {
    enabled: false,
    type: "local",
    path: "",
    wireguard: { enabled: true, interface: "" },
    smart: { enabled: true, disks: [] },
    speedtest: { enabled: true, interval: SPEEDTEST_DEFAULT_INTERVAL, server: "" },
    aptUpdates: { enabled: true },
    opencode: { enabled: true },
    claude: { enabled: true }
  };
}

// Preferences equal to the defaults are not stored.
export function serializeHostMonitoring(m) {
  if (!m || typeof m !== "object") return undefined;
  const out = {
    enabled: m.enabled === true,
    type: HOST_MONITORING_TYPES.includes(m.type) ? m.type : "local",
    path: (m.path || "").trim()
  };
  const wg =
    m.type === "local" && m.wireguard && typeof m.wireguard === "object" ? m.wireguard : null;
  if (wg) {
    const wireguard = { enabled: wg.enabled !== false, interface: (wg.interface || "").trim() };
    if (!wireguard.enabled || wireguard.interface) out.wireguard = wireguard;
  }
  const smart = m.smart && typeof m.smart === "object" ? m.smart : null;
  if (smart) {
    const disks = [
      ...new Set(
        (Array.isArray(smart.disks) ? smart.disks : [])
          .map(value =>
            String(value || "")
              .trim()
              .slice(0, 100)
          )
          .filter(Boolean)
      )
    ].slice(0, 20);
    const prefs = { enabled: smart.enabled !== false, disks };
    if (!prefs.enabled || prefs.disks.length) out.smart = prefs;
  }
  if (m.speedtest && typeof m.speedtest === "object") {
    const prefs = normalizeSpeedtestPrefs(m.speedtest);
    if (!prefs.enabled || prefs.interval !== SPEEDTEST_DEFAULT_INTERVAL || prefs.server)
      out.speedtest = prefs;
  }
  const apt =
    m.aptUpdates && typeof m.aptUpdates === "object"
      ? { enabled: m.aptUpdates.enabled !== false }
      : null;
  if (apt && !apt.enabled) out.aptUpdates = apt;
  if (m.opencode && typeof m.opencode === "object" && m.opencode.enabled === false)
    out.opencode = { enabled: false };
  if (m.claude && typeof m.claude === "object" && m.claude.enabled === false)
    out.claude = { enabled: false };
  const meaningful =
    out.path ||
    out.wireguard ||
    out.smart ||
    out.speedtest ||
    out.aptUpdates ||
    out.opencode ||
    out.claude;
  return !out.enabled && !meaningful ? undefined : out;
}
