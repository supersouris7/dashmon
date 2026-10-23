// Rendu de la tuile WireGuard (cote navigateur).
//
// Premiere ligne : nombre de pairs. Seconde ligne : pairs connectes (dernier
// handshake < 3 min). L'info-bulle detaille chaque interface. Un dump illisible
// laisse la tuile neutre plutot que rouge : c'est un probleme de configuration,
// pas une panne du tunnel.

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
