// WireGuard card: peers of each interface from the local "wg show all dump"
// file.
import {
  handshakeAge,
  WG_CONNECTED_SECONDS,
  handshakeText,
  bytesText,
  relativeAge
} from "./format.js";
import { t } from "../i18n.js";
import { applyHostColor } from "./cards.js";

// A peer: name, last handshake, then received and sent traffic. Name and
// endpoint come from the agent: nothing goes through innerHTML, everything
// uses textContent.
function peerRow(peer) {
  const row = document.createElement("div");
  row.className = "supervision-peer";

  const name = document.createElement("span");
  name.className = "supervision-peer-name";
  const age = handshakeAge(peer.latestHandshake);
  const fresh = peer.connected === true || (age !== null && age <= WG_CONNECTED_SECONDS);
  const dot = document.createElement("i");
  dot.className = "supervision-peer-dot" + (fresh ? " up" : "");
  dot.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = peer.name || t("supervisionPeerUnnamed");
  name.append(dot, label);
  const endpoint = peer.endpoint ? ` · ${peer.endpoint}` : "";
  name.title = (peer.name || t("supervisionPeerUnnamed")) + endpoint;

  const handshake = document.createElement("span");
  handshake.className = "supervision-peer-handshake";
  if (fresh) handshake.classList.add("up");
  handshake.textContent = handshakeText(peer);

  const traffic = document.createElement("span");
  traffic.className = "supervision-peer-traffic";
  traffic.textContent = `↓ ${bytesText(peer.rx)} · ↑ ${bytesText(peer.tx)}`;

  row.append(name, handshake, traffic);
  return row;
}

// Interfaces of a host kept by its preferences: the section can be hidden
// (enabled === false) and filtered on one interface. An empty array may mean a
// valid dump without peers, which the card must still render.
export function visibleInterfaces(host, metrics) {
  if (!metrics || !metrics.ok) return [];
  const prefs = host.monitoring && host.monitoring.wireguard;
  if (prefs && prefs.enabled === false) return [];
  if (!Array.isArray(metrics.wireguard)) return [];
  const interfaces =
    prefs && prefs.interface
      ? metrics.wireguard.filter(item => item.interface === prefs.interface)
      : metrics.wireguard;
  return interfaces;
}

export function hasWireguardDump(host, metrics) {
  const prefs = host.monitoring && host.monitoring.wireguard;
  return !!(
    metrics &&
    metrics.ok &&
    (!prefs || prefs.enabled !== false) &&
    Array.isArray(metrics.wireguard)
  );
}

// Standalone WireGuard card, separate from the host card, like the dashboard
// tile. One card per host, one section per interface, then one peer per row.
// The interface row reads "wg0" (white) then " : last reading" (grey), the
// date of the dump file (wireguardFetchedAt).
export function wireguardCard(host, metrics, interfaces) {
  const card = document.createElement("article");
  card.className = "supervision-card supervision-card-wireguard";
  applyHostColor(card, host);

  const head = document.createElement("div");
  head.className = "supervision-head";
  const icon = document.createElement("i");
  // Font Awesome has no WireGuard icon: the dragon is the chosen fallback.
  icon.className = "fa-solid fa-dragon";
  icon.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "supervision-name";
  name.textContent = t("supervisionWireguardTitle");
  const badge = document.createElement("span");
  badge.className = "supervision-type";
  badge.textContent = t("supervisionWireguard");
  head.append(icon, name, badge);
  card.appendChild(head);

  const age = handshakeAge(metrics.wireguardFetchedAt);
  const updatedText =
    age === null ? "" : t("supervisionWireguardUpdated").replace("{ago}", relativeAge(age));

  if (!interfaces.length) {
    const section = document.createElement("div");
    section.className = "supervision-wireguard";
    const empty = document.createElement("p");
    empty.className = "supervision-wireguard-empty";
    empty.textContent = t("supervisionWireguardNoPeer");
    section.appendChild(empty);
    card.appendChild(section);
    return card;
  }

  interfaces.forEach(item => {
    const section = document.createElement("div");
    section.className = "supervision-wireguard";

    const line = document.createElement("div");
    line.className = "supervision-wireguard-head";
    if (item.interface) {
      const iface = document.createElement("span");
      iface.className = "supervision-wireguard-iface";
      iface.textContent = item.interface;
      line.appendChild(iface);
    }
    if (updatedText) {
      const updated = document.createElement("span");
      updated.className = "supervision-wireguard-updated";
      updated.textContent = (item.interface ? ": " : "") + updatedText;
      line.appendChild(updated);
    }
    if (line.childNodes.length) section.appendChild(line);

    const peers = Array.isArray(item.peers) ? item.peers : [];
    if (!peers.length) {
      const empty = document.createElement("p");
      empty.className = "supervision-wireguard-empty";
      empty.textContent = t("supervisionWireguardNoPeer");
      section.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "supervision-peers";
      peers.forEach(peer => list.appendChild(peerRow(peer)));
      section.appendChild(list);
    }
    card.appendChild(section);
  });

  return card;
}
