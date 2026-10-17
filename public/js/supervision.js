// Page supervision : aperçu côte navigateur, sans backend ni donnée réelle.
// Les lignes ci-dessous sont des exemples de documentation (plages RFC 5737) :
// elles servent à montrer le rendu, rien n'est mesuré pour l'instant.
import { t } from "./i18n.js";
import { state } from "./state.js";
import { dashboardPageBtn, supervisionPageBtn, supervisionList } from "./dom.js";
import { saveViewPrefs } from "./view-prefs.js";

const VPN_EXAMPLES = Object.freeze([
  { name: "VPN principal", protocol: "WireGuard", endpoint: "192.0.2.10", status: "up", latency: 24, uptime: 99.9 },
  { name: "VPN secondaire", protocol: "WireGuard", endpoint: "198.51.100.20", status: "up", latency: 58, uptime: 99.1 },
  { name: "VPN distant", protocol: "OpenVPN", endpoint: "192.0.2.30", status: "down", latency: null, uptime: 96.4 }
]);

function row(label, value) {
  const line = document.createElement("div");
  line.className = "supervision-row";
  const key = document.createElement("span");
  key.textContent = label;
  const content = document.createElement("span");
  content.textContent = value;
  line.append(key, content);
  return line;
}

function uptimeText(value) {
  return value.toFixed(1).replace(".", state.language === "fr" ? "," : ".") + " %";
}

export function renderSupervision() {
  supervisionList.replaceChildren();

  const title = document.createElement("h2");
  title.className = "supervision-title";
  title.id = "supervisionTitle";
  title.textContent = t("supervisionTitle");

  const note = document.createElement("p");
  note.className = "supervision-note";
  note.textContent = t("supervisionNote");

  const grid = document.createElement("div");
  grid.className = "supervision-grid";

  for (const vpn of VPN_EXAMPLES) {
    const card = document.createElement("article");
    card.className = "supervision-card";

    const head = document.createElement("div");
    head.className = "supervision-head";
    const dot = document.createElement("span");
    dot.className = "supervision-dot " + (vpn.status === "up" ? "up" : "down");
    const name = document.createElement("span");
    name.textContent = vpn.name;
    head.append(dot, name);

    const rows = document.createElement("div");
    rows.className = "supervision-rows";
    rows.append(
      row(t("supervisionState"), t(vpn.status === "up" ? "supervisionUp" : "supervisionDown")),
      row(t("supervisionProtocol"), vpn.protocol),
      row(t("supervisionEndpoint"), vpn.endpoint),
      row(t("supervisionLatency"), vpn.latency === null ? "—" : vpn.latency + " ms"),
      row(t("supervisionUptime"), uptimeText(vpn.uptime))
    );

    card.append(head, rows);
    grid.append(card);
  }

  supervisionList.append(title, note, grid);
}

export function setPage(page) {
  state.page = page === "supervision" ? "supervision" : "dashboard";
  document.body.dataset.page = state.page;
  dashboardPageBtn.setAttribute("aria-pressed", String(state.page === "dashboard"));
  supervisionPageBtn.setAttribute("aria-pressed", String(state.page === "supervision"));
  if (state.page === "supervision") {
    renderSupervision();
  }
}

dashboardPageBtn.addEventListener("click", () => {
  setPage("dashboard");
  saveViewPrefs({ page: state.page });
});

supervisionPageBtn.addEventListener("click", () => {
  setPage("supervision");
  saveViewPrefs({ page: state.page });
});
