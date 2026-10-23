// Rendu de la tuile WireGuard (cote navigateur).
//
// Une pastille par pair : vide sans handshake recent, verte si le pair est
// connecte (handshake < 3 min). L'info-bulle detaille les interfaces. Un dump
// illisible laisse la tuile neutre plutot que rouge : c'est un probleme de
// configuration, pas une panne du tunnel.

const CONNECTED_SECONDS = 180;

export function isConnected(peer) {
  const handshake = Number(peer && peer.latestHandshake);
  return Number.isFinite(handshake) && handshake > 0
    && (Date.now() / 1000 - handshake) <= CONNECTED_SECONDS;
}

function peerList(info) {
  return (info.interfaces || []).flatMap(item =>
    (item.peers || []).map(peer => ({ interface: item.name || "?", peer }))
  );
}

export function element(ctx) {
  const { info, t } = ctx;
  const status = document.createElement("span");
  status.className = "wireguard-peer-status";

  if (!info || info.error || !info.interfaces) {
    const dot = document.createElement("i");
    dot.className = "wireguard-peer-dot";
    status.appendChild(dot);
    status.title = info && info.error ? `${t("error")} : ${String(info.error).slice(0, 200)}` : t("name");
    return status;
  }

  const peers = peerList(info);
  if (!peers.length) {
    const dot = document.createElement("i");
    dot.className = "wireguard-peer-dot";
    status.appendChild(dot);
    status.title = `${t("name")} · ${t("none")}`;
    return status;
  }

  peers.forEach(({ interface: iface, peer }) => {
    const dot = document.createElement("i");
    const connected = isConnected(peer);
    dot.className = "wireguard-peer-dot" + (connected ? " up" : "");
    dot.title = `${iface} · ${peer.name || "?"} · ${t(connected ? "peerConnected" : "peerDisconnected")}`;
    status.appendChild(dot);
  });
  status.title = `${t("name")} · ${peers.length} ${t("peers")}`;
  return status;
}

export function render(ctx) {
  const { info, t } = ctx;

  if (!info) {
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("name") };
  }

  const peers = info.peers;
  if (info.error || !info.interfaces || !peers) {
    return {
      badge: t("name") + " —",
      badgeClass: "warn",
      time: "—",
      timeClass: "",
      title: info && info.error ? `${t("error")} : ${String(info.error).slice(0, 120)}` : t("name")
    };
  }

  const total = Number(peers.total) || 0;
  const connected = Number(peers.connected) || 0;
  const wanted = ctx.config && ctx.config.interface ? String(ctx.config.interface) : "";
  const parts = (info.interfaces || [])
    .slice(0, 10)
    .map(item => `${item.name || "?"}: ${(item.peers || []).length}`);

  return {
    badge: `${total} ${t("peers")}`,
    badgeClass: total ? (connected > 0 ? "ok" : "warn") : "pending",
    time: total ? `${connected} ${t("connected")}` : t("none"),
    timeClass: "",
    title: t("name") + (wanted ? ` · ${wanted}` : "") + (parts.length ? ` · ${parts.join(", ")}` : "")
  };
}
