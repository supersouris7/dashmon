import { HOST_MONITORING_TYPES } from "./config/normalize.js";

// Valeurs de travail : aucune supervision n'est activee sans action explicite.
export function blankMonitoring() {
  return {
    enabled: false,
    type: "local",
    url: "",
    node: "",
    path: "",
    tokenIdEnv: "",
    tokenSecretEnv: "",
    wireguard: { enabled: true, interface: "" },
    smart: { enabled: true, disks: [] },
    aptUpdates: { enabled: true }
  };
}

// Les preferences identiques aux valeurs par defaut ne sont pas persistees.
export function serializeHostMonitoring(m) {
  if (!m || typeof m !== "object") return undefined;
  const out = {
    enabled: m.enabled === true,
    type: HOST_MONITORING_TYPES.includes(m.type) ? m.type : "local",
    url: (m.url || "").trim(),
    node: (m.node || "").trim(),
    path: (m.path || "").trim(),
    tokenIdEnv: (m.tokenIdEnv || "").trim(),
    tokenSecretEnv: (m.tokenSecretEnv || "").trim()
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
  const apt =
    m.aptUpdates && typeof m.aptUpdates === "object"
      ? { enabled: m.aptUpdates.enabled !== false }
      : null;
  if (apt && !apt.enabled) out.aptUpdates = apt;
  const meaningful =
    out.url ||
    out.node ||
    out.path ||
    out.tokenIdEnv ||
    out.tokenSecretEnv ||
    out.wireguard ||
    out.smart ||
    out.aptUpdates;
  return !out.enabled && !meaningful ? undefined : out;
}
