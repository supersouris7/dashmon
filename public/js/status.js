// Status rules of the monitoring pills, without DOM.
//
// `soft` means non-critical monitoring: the service is checked, but its
// unavailability is not critical. The state stays `soft` (the tooltip explains
// it) and the pill looks like an unknown status: an empty circle. Only a real
// `down` shows a red cross.

export function effectiveStatus(monitor, info) {
  const state = (info && info.state) || "pending";
  return monitor === "soft" && state === "down" ? "soft" : state;
}

export function statusIcon(state) {
  if (state === "up") return "fa-solid fa-circle-check";
  if (state === "down") return "fa-solid fa-circle-xmark";
  return "fa-regular fa-circle";
}
