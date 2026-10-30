// Texts and thresholds of the supervision cards: percentages, temperatures,
// ages, byte counts, severity levels.
import { state } from "../state.js";
import { t } from "../i18n.js";

// null or undefined means the metric is unavailable. Number(null) is 0:
// without this guard, a missing value would show as "0 %" like a real zero.
export function isMissing(value) {
  return value === null || value === undefined || value === "";
}

// A missing percentage shows "—", never "0 %": an unavailable metric and a
// metric at zero do not mean the same thing.
export function percentText(value) {
  if (isMissing(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const shown = Math.round(n);
  return shown + " %";
}

export function temperatureText(value) {
  if (isMissing(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return (
    (Math.round(n * 10) / 10).toString().replace(".", state.language === "fr" ? "," : ".") + " °C"
  );
}

export function metricSeverity(value) {
  if (isMissing(value) || !Number.isFinite(Number(value))) return -1;
  const n = Number(value);
  return n >= 90 ? 2 : n >= 70 ? 1 : 0;
}

export function temperatureSeverity(value) {
  if (isMissing(value) || !Number.isFinite(Number(value))) return -1;
  const n = Number(value);
  return n >= 75 ? 2 : n >= 60 ? 1 : 0;
}

// A peer counts as connected when its last handshake is less than three
// minutes old: WireGuard renegotiates about every two minutes while the link
// lives. The agent may also provide an explicit "connected" boolean.
export const WG_CONNECTED_SECONDS = 180;

export function handshakeAge(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(0, Math.floor(Date.now() / 1000 - n));
}

export function relativeAge(seconds) {
  const fr = state.language === "fr";
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return fr ? `il y a ${s} s` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return fr ? `il y a ${m} min` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return fr ? `il y a ${h} h` : `${h} h ago`;
  const d = Math.floor(h / 24);
  return fr ? `il y a ${d} j` : `${d} d ago`;
}

export function reportDateText(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return new Intl.DateTimeFormat(state.language === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(seconds * 1000));
}

export function handshakeText(peer) {
  const age = handshakeAge(peer.latestHandshake);
  if (age === null) {
    return peer.connected === true ? t("supervisionPeerConnected") : t("supervisionPeerNever");
  }
  return relativeAge(age);
}

export function bytesText(value) {
  if (isMissing(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  const fr = state.language === "fr";
  const units = fr ? ["o", "ko", "Mo", "Go", "To"] : ["B", "kB", "MB", "GB", "TB"];
  let shown = n,
    index = 0;
  while (shown >= 1024 && index < units.length - 1) {
    shown /= 1024;
    index++;
  }
  const rounded = shown >= 100 ? Math.round(shown) : Math.round(shown * 10) / 10;
  return rounded.toString().replace(".", fr ? "," : ".") + " " + units[index];
}

export function smartNumberText(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0
    ? new Intl.NumberFormat(state.language === "fr" ? "fr-FR" : "en-US").format(Math.floor(n))
    : "—";
}
