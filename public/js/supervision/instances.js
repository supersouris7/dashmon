// Supervised instances: this Dashmon ("local") and each paired agent, in the
// order of the tabs. Which one is shown is a view preference.
import { state } from "../state.js";

function instanceLabel(instance) {
  if (instance.name) return instance.name;
  if (instance.id === "local") return "Dashmon";
  try {
    return new URL(instance.url).hostname || instance.url;
  } catch (_error) {
    return instance.url || "Dashmon";
  }
}

// The machine running Dashmon carries the same name everywhere: the name of
// its local host in the settings, also shown on its cards.
function localMachineName() {
  const hosts = Array.isArray(state.hosts) ? state.hosts : [];
  const local = hosts.find(host => host?.monitoring?.type === "local" && host.monitoring.enabled);
  return (local && String(local.name || "").trim()) || "Dashmon";
}

// Icon of the local supervision tab, chosen in Settings > Supervision > Local.
function localTabIcon() {
  const hosts = Array.isArray(state.hosts) ? state.hosts : [];
  const local = hosts.find(host => host?.monitoring?.type === "local" && host.monitoring.enabled);
  return local?.tabIcon || "";
}

export function supervisionInstances() {
  const local = localMachineName();
  const configured = state.replication?.secondaries || [];
  const names = state.replication?.agentNames || {};
  const icons = state.replication?.agentIcons || {};
  return [
    { id: "local", name: local, icon: localTabIcon() },
    ...configured.map(url => ({ id: url, url, name: names[url] || "", icon: icons[url] || "" }))
  ];
}

export function selectedSupervisionInstanceId() {
  const instances = supervisionInstances();
  if (!instances.some(instance => instance.id === state.supervisionInstanceId)) {
    state.supervisionInstanceId = "local";
  }
  return state.supervisionInstanceId;
}

export function supervisionInstanceLabel(instance) {
  return instanceLabel(instance);
}
