"use strict";
// Coding agent reports (OpenCode...) for the widgets of the dashboard tiles:
// the same reports as the Supervision cards, from this instance or from a
// paired agent.
//
// The widget field "host" holds the choice:
//   ""       automatic: the agent paired with the host of the tile when it has
//            a report, otherwise this instance;
//   "local"  this instance;
//   <url>    a paired agent (any other address is refused).

const KINDS = new Set(["opencode", "claude"]);

function createUsageSource({ readConfig, readLocal, readAgents, sanitizeReplication }) {
  // Agent paired with the inventory host the service belongs to.
  function agentOfService(config, replication, service) {
    const hostName = String(service?.host || "");
    if (!hostName) return "";
    const host = (Array.isArray(config.hosts) ? config.hosts : []).find(
      item => item?.name === hostName
    );
    if (!host?.id) return "";
    const links = replication.agentHosts || {};
    return replication.secondaries.find(url => links[url] === host.id) || "";
  }

  function agentName(replication, url) {
    return String(replication.agentNames?.[url] || new URL(url).host);
  }

  async function fromAgent(kind, url) {
    const instances = await readAgents();
    const instance = instances.find(item => item.url === url);
    if (!instance?.ok) return { report: null, unreachable: true };
    return { report: instance.hosts?.[0]?.[kind] || null };
  }

  // { report, source: "local" | "agent", name, unreachable? }
  async function usageReport(kind, choice, service) {
    if (!KINDS.has(kind)) throw new Error("Unknown report");
    const config = readConfig();
    const replication = sanitizeReplication(config.replication);
    const wanted = String(choice || "").trim();
    const local = () => ({ report: readLocal(kind), source: "local", name: "" });

    if (wanted === "local") return local();
    if (wanted) {
      const url = replication.secondaries.find(item => item === wanted);
      if (!url) return { report: null, source: "agent", name: "", unpaired: true };
      return {
        ...(await fromAgent(kind, url)),
        source: "agent",
        name: agentName(replication, url)
      };
    }
    const url = agentOfService(config, replication, service);
    if (url) {
      const remote = await fromAgent(kind, url).catch(() => ({ report: null }));
      if (remote.report) return { ...remote, source: "agent", name: agentName(replication, url) };
    }
    return local();
  }

  return { usageReport };
}

module.exports = { createUsageSource };
