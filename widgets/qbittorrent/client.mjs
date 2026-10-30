// Rendu de la tuile qBittorrent : debit instantane, volumes dans l'info-bulle.

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let index = 0;
  let shown = bytes;
  while (shown >= 1024 && index < units.length - 1) {
    shown /= 1024;
    index++;
  }
  const decimals = shown >= 100 || index === 0 ? 0 : 1;
  return shown.toLocaleString(undefined, { maximumFractionDigits: decimals }) + " " + units[index];
}

export function render(ctx) {
  const { info, t } = ctx;
  if (!info)
    return { badge: "—", badgeClass: "pending", time: "", timeClass: "", title: t("pending") };
  if (info.error)
    return {
      badge: t("error") + " —",
      badgeClass: "nok",
      time: "—",
      timeClass: "",
      title: t("error") + " : " + String(info.error).slice(0, 120)
    };

  const download = formatBytes(info.downloadSpeed) + "/s";
  const upload = formatBytes(info.uploadSpeed) + "/s";
  const connected = info.connected !== false;
  return {
    badge: "↓ " + download,
    badgeClass: connected ? "ok" : "warn",
    time: "↑ " + upload,
    timeClass: connected ? "" : "warn",
    title: `${t("name")} · ${t("download")} ${download} · ${t("upload")} ${upload} · ${t("downloaded")} ${formatBytes(info.downloaded)} · ${t("uploaded")} ${formatBytes(info.uploaded)}${connected ? "" : " · " + t("disconnected")}`
  };
}
