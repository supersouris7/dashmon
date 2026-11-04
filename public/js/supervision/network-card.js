// Network card: throughput of the host interfaces, measured by the server
// every 10 s from the kernel counters (lib/host/network.js). Folded, one line
// per interface with the current rates; opened, the peak and volume of each
// interface and a graph of the last hour.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { t } from "../i18n.js";
import { bytesText, rateText } from "./format.js";

const SVG = "http://www.w3.org/2000/svg";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Verdict line, as on the other cards.
function health(report) {
  if (!report?.available) {
    return { level: "unknown", icon: "fa-solid fa-circle-question", label: "networkUnavailable" };
  }
  if (!report.interfaces.length) {
    return { level: "unknown", icon: "fa-solid fa-circle-question", label: "networkNoInterface" };
  }
  if (report.interfaces.every(item => item.rx === null)) {
    return { level: "pending", icon: "fa-solid fa-spinner", label: "networkMeasuring" };
  }
  return { level: "healthy", icon: "fa-solid fa-circle-check", label: "networkLive" };
}

// Points of a polyline over the hour, scaled on the shared maximum.
export function graphPoints(history, field, max, width, height) {
  if (!history.length || !(max > 0)) return "";
  const first = history[0][0];
  const span = Math.max(1, history[history.length - 1][0] - first);
  return history
    .map(point => {
      const x = history.length === 1 ? width : ((point[0] - first) / span) * width;
      const y = height - (point[field] / max) * height;
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
}

function graph(item) {
  const width = 300;
  const height = 60;
  const history = Array.isArray(item.history) ? item.history : [];
  const max = Math.max(1, ...history.map(point => Math.max(point[1], point[2])));
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "network-graph");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    t("networkGraphLabel").replace("{name}", item.name).replace("{peak}", rateText(max))
  );
  for (const [field, className] of [
    [1, "network-line-rx"],
    [2, "network-line-tx"]
  ]) {
    const line = document.createElementNS(SVG, "polyline");
    line.setAttribute("class", className);
    line.setAttribute("points", graphPoints(history, field, max, width, height));
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(line);
  }
  return svg;
}

function rates(rx, tx) {
  const box = element("span", "network-rates");
  box.append(
    element("span", "network-rx", "↓ " + rateText(rx)),
    element("span", "network-tx", "↑ " + rateText(tx))
  );
  return box;
}

function interfaceBlock(item) {
  const block = element("section", "network-interface");
  const title = element("div", "network-title");
  const name = element("strong", "", item.name);
  title.appendChild(name);
  if (item.kind === "vpn") title.appendChild(element("span", "network-kind", t("networkVpn")));
  title.appendChild(rates(item.rx, item.tx));
  block.appendChild(title);

  const details = element("div", "network-details");
  const rows = [
    [t("networkPeak"), rates(item.peakRx, item.peakTx)],
    [
      t("networkVolume"),
      (() => {
        const box = element("span", "network-rates");
        box.append(
          element("span", "network-rx", "↓ " + bytesText(item.totalRx)),
          element("span", "network-tx", "↑ " + bytesText(item.totalTx))
        );
        return box;
      })()
    ]
  ];
  for (const [label, value] of rows) {
    const row = element("div", "network-row");
    row.append(element("span", "", label), value);
    details.appendChild(row);
  }
  details.appendChild(graph(item));
  block.appendChild(details);
  return block;
}

export function networkCard(host, metrics) {
  const report = metrics?.network;
  const verdict = health(report);
  const card = element("article", "supervision-card supervision-card-network is-" + verdict.level);
  applyHostColor(card, host);

  const head = element("div", "supervision-head");
  const icon = element("i", "fa-solid fa-network-wired");
  icon.setAttribute("aria-hidden", "true");
  const chevron = element("i", "fa-solid fa-chevron-down supervision-smart-chevron");
  chevron.setAttribute("aria-hidden", "true");
  head.append(
    icon,
    element("span", "supervision-name", t("networkTitle")),
    element("span", "supervision-type", t("networkBadge")),
    chevron
  );
  card.appendChild(head);

  // Opens like the other cards; the setting is a view preference.
  const key = cardKey(host);
  card.dataset.networkKey = key;
  card.classList.add("has-details");
  const expanded = isExpanded("supervisionNetworkExpanded", key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded("supervisionNetworkExpanded", key, open);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });

  const status = element("div", "supervision-health");
  const stateBox = element("span", "supervision-health-state");
  const stateIcon = element("i", verdict.icon);
  stateIcon.setAttribute("aria-hidden", "true");
  stateBox.append(stateIcon, element("strong", "", t(verdict.label)));
  status.appendChild(stateBox);
  card.appendChild(status);

  if (!report?.available) {
    // The container only sees its own network: say what to mount.
    const hint = element("p", "network-hint", t("networkMountHint"));
    hint.appendChild(element("code", "", "- /proc/1/net/dev:/host/net/dev:ro"));
    card.appendChild(hint);
    return card;
  }
  const list = element("div", "network-interfaces");
  report.interfaces.forEach(item => list.appendChild(interfaceBlock(item)));
  card.appendChild(list);
  return card;
}
