// Monitoring settings of a host as the editor keeps and saves them. The
// speed test and the disk path belong to the core; every other card is a
// supervision plugin whose settings follow its manifest (config/plugin-prefs.js,
// the same rules as the server).
import {
  HOST_MONITORING_TYPES,
  SPEEDTEST_DEFAULT_INTERVAL,
  normalizeSpeedtestPrefs
} from "../config/normalize.js";
import { sanitizePluginSettings } from "../config/plugin-prefs.js";
import { pluginSettingsSchemas } from "../supervision-registry.js";

// Working values: no monitoring is enabled without an explicit action. The
// plugin settings are created by their form (host-settings.js).
export function blankMonitoring() {
  return {
    enabled: false,
    type: "local",
    path: "",
    speedtest: { enabled: true, interval: SPEEDTEST_DEFAULT_INTERVAL, server: "" },
    plugins: {}
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
  if (m.speedtest && typeof m.speedtest === "object") {
    const prefs = normalizeSpeedtestPrefs(m.speedtest);
    if (!prefs.enabled || prefs.interval !== SPEEDTEST_DEFAULT_INTERVAL || prefs.server)
      out.speedtest = prefs;
  }
  const plugins = sanitizePluginSettings(m, pluginSettingsSchemas());
  Object.assign(out, plugins);
  const meaningful = out.path || out.speedtest || Object.keys(plugins).length;
  return !out.enabled && !meaningful ? undefined : out;
}
