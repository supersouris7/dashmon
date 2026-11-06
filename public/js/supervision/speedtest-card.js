// Speed test card: maximum download and upload rates of the host's link,
// with latency and jitter, measured by the server on its schedule
// (lib/host/speedtest.js). Folded: the last result and the last 24 hours;
// opened: details and the last 7 days. "Test now" runs one at once.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { t } from "../i18n.js";
import { rateText, relativeAge } from "./format.js";
import { state } from "../state.js";

const SVG = "http://www.w3.org/2000/svg";
const DAY = 24 * 3600 * 1000;
// Cards whose test was asked from this page: a re-render while it runs keeps
// showing it as running.
const pending = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function msText(value) {
  if (!Number.isFinite(value)) return "—";
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toString().replace(".", state.language === "fr" ? "," : ".") + " ms";
}

export function speedtestError(code) {
  if (code === "unreachable") return t("speedtestErrorUnreachable");
  if (code === "timeout") return t("speedtestErrorTimeout");
  if (/^http_\d{3}$/.test(code || ""))
    return t("speedtestErrorHttp").replace("{code}", code.slice(5));
  return t("speedtestErrorFailed");
}

function health(report) {
  if (report.running)
    return { level: "pending", icon: "fa-solid fa-spinner fa-spin", label: t("speedtestRunning") };
  const last = report.last;
  if (!last) {
    return {
      level: "unknown",
      icon: "fa-solid fa-circle-question",
      label: t(report.interval ? "speedtestWaiting" : "speedtestManualOnly")
    };
  }
  const age = relativeAge((Date.now() - last.at) / 1000);
  if (!last.ok)
    return {
      level: "warning",
      icon: "fa-solid fa-triangle-exclamation",
      label: speedtestError(last.error) + " · " + age
    };
  return {
    level: "healthy",
    icon: "fa-solid fa-circle-check",
    label: t("speedtestLast") + " " + age
  };
}

// Points of one series over [from, to]; a failed test breaks the line.
export function seriesPoints(history, field, max, from, to, width, height) {
  if (!(max > 0) || !(to > from)) return [];
  const lines = [];
  let current = [];
  for (const point of history) {
    if (point[0] < from) continue;
    if (!Number.isFinite(point[field])) {
      if (current.length) lines.push(current);
      current = [];
      continue;
    }
    const x = ((point[0] - from) / (to - from)) * width;
    const y = height - (point[field] / max) * height;
    current.push(x.toFixed(1) + "," + y.toFixed(1));
  }
  if (current.length) lines.push(current);
  return lines.map(line => line.join(" "));
}

function graph(history, span, className, label) {
  const width = 300;
  const height = 60;
  const to = Date.now();
  const from = to - span;
  const shown = history.filter(point => point[0] >= from);
  // No measurement over the period: no empty frame.
  if (!shown.some(point => Number.isFinite(point[1]))) return null;
  const max = Math.max(1, ...shown.map(point => Math.max(point[1] || 0, point[2] || 0)));
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "speedtest-graph " + className);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label.replace("{max}", rateText(max)));
  for (const [field, lineClass] of [
    [1, "speedtest-line-down"],
    [2, "speedtest-line-up"]
  ]) {
    for (const points of seriesPoints(shown, field, max, from, to, width, height)) {
      // A single test is drawn as a dot rather than an invisible line.
      const single = !points.includes(" ");
      const shape = document.createElementNS(SVG, single ? "circle" : "polyline");
      shape.setAttribute("class", lineClass);
      if (single) {
        const [x, y] = points.split(",");
        shape.setAttribute("cx", x);
        shape.setAttribute("cy", y);
        shape.setAttribute("r", "2");
      } else {
        shape.setAttribute("points", points);
      }
      shape.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(shape);
    }
  }
  return svg;
}

function figure(className, icon, label, value) {
  const box = element("div", "speedtest-figure " + className);
  const symbol = element("i", icon);
  symbol.setAttribute("aria-hidden", "true");
  box.append(symbol, element("strong", "", value), element("span", "", label));
  return box;
}

function dateText(ms) {
  return new Intl.DateTimeFormat(state.language === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(ms));
}

function details(report) {
  const last = report.last?.ok ? report.last : null;
  const box = element("div", "speedtest-details");
  const best = report.history.reduce(
    (max, point) => ({
      down: Math.max(max.down, point[1] || 0),
      up: Math.max(max.up, point[2] || 0)
    }),
    { down: 0, up: 0 }
  );
  const rows = [
    [t("speedtestJitter"), last ? msText(last.jitterMs) : "—"],
    [t("speedtestBest"), best.down ? "↓ " + rateText(best.down) + "  ↑ " + rateText(best.up) : "—"],
    [
      t("speedtestServer"),
      t(report.server === "librespeed" ? "speedtestLibrespeed" : "speedtestCloudflare")
    ],
    [t("speedtestLastAt"), report.last ? dateText(report.last.at) : "—"],
    [
      t("speedtestNext"),
      report.interval
        ? report.nextAt
          ? dateText(Math.max(report.nextAt, Date.now()))
          : t("speedtestSoon")
        : t("speedtestManual")
    ]
  ];
  for (const [label, value] of rows) {
    const row = element("div", "speedtest-row");
    row.append(element("span", "", label), element("span", "speedtest-value", value));
    box.appendChild(row);
  }
  return box;
}

// onRun(host): asks for a test now; resolves once it is over.
export function speedtestCard(host, metrics, { onRun } = {}) {
  const key = cardKey(host);
  const report = { ...metrics.speedtest, running: metrics.speedtest.running || pending.has(key) };
  const history = Array.isArray(report.history) ? report.history : [];
  const verdict = health(report);
  const card = element(
    "article",
    "supervision-card supervision-card-speedtest is-" + verdict.level
  );
  applyHostColor(card, host);

  const head = element("div", "supervision-head");
  const icon = element("i", "fa-solid fa-gauge-high");
  icon.setAttribute("aria-hidden", "true");
  const chevron = element("i", "fa-solid fa-chevron-down supervision-smart-chevron");
  chevron.setAttribute("aria-hidden", "true");
  head.append(
    icon,
    element("span", "supervision-name", t("speedtestTitle")),
    element("span", "supervision-type", t("speedtestBadge")),
    chevron
  );
  card.appendChild(head);

  card.dataset.speedtestKey = key;
  card.classList.add("has-details");
  const expanded = isExpanded("supervisionSpeedtestExpanded", key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded("supervisionSpeedtestExpanded", key, open);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggle();
  });

  const status = element("div", "supervision-health");
  const stateBox = element("span", "supervision-health-state");
  const stateIcon = element("i", verdict.icon);
  stateIcon.setAttribute("aria-hidden", "true");
  stateBox.append(stateIcon, element("strong", "", verdict.label));
  status.appendChild(stateBox);
  card.appendChild(status);

  const last = report.last?.ok ? report.last : null;
  const figures = element("div", "speedtest-figures");
  figures.append(
    figure(
      "speedtest-down",
      "fa-solid fa-arrow-down",
      t("speedtestDownload"),
      last ? rateText(last.download) : "—"
    ),
    figure(
      "speedtest-up",
      "fa-solid fa-arrow-up",
      t("speedtestUpload"),
      last ? rateText(last.upload) : "—"
    ),
    figure(
      "speedtest-ping",
      "fa-solid fa-stopwatch",
      t("speedtestLatency"),
      last ? msText(last.latencyMs) : "—"
    )
  );
  card.appendChild(figures);

  for (const node of [
    graph(history, DAY, "speedtest-graph-day", t("speedtestGraphDay")),
    graph(history, 7 * DAY, "speedtest-graph-week", t("speedtestGraphWeek")),
    details(report)
  ])
    if (node) card.appendChild(node);

  const actions = element("div", "speedtest-actions");
  const button = element("button", "action-btn speedtest-run");
  button.type = "button";
  const buttonIcon = element(
    "i",
    report.running ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play"
  );
  buttonIcon.setAttribute("aria-hidden", "true");
  const buttonText = element(
    "span",
    "",
    t(report.running ? "speedtestRunning" : "speedtestRunNow")
  );
  button.append(buttonIcon, buttonText);
  button.disabled = !!report.running || !onRun;
  const message = element(
    "span",
    "speedtest-message",
    report.running ? t("speedtestRunningHint") : ""
  );
  message.setAttribute("role", "status");
  button.addEventListener("click", async event => {
    event.stopPropagation();
    button.disabled = true;
    buttonIcon.className = "fa-solid fa-spinner fa-spin";
    buttonText.textContent = t("speedtestRunning");
    message.textContent = t("speedtestRunningHint");
    pending.add(key);
    let outcome;
    try {
      outcome = await onRun(host);
    } finally {
      pending.delete(key);
    }
    // Success re-renders the page; only a refusal is left to show here.
    if (outcome !== "ok") {
      button.disabled = false;
      buttonIcon.className = "fa-solid fa-play";
      buttonText.textContent = t("speedtestRunNow");
      message.textContent = t(outcome === "too_soon" ? "speedtestTooSoon" : "speedtestRunFailed");
    }
  });
  button.addEventListener("keydown", event => event.stopPropagation());
  actions.append(button, message);
  card.appendChild(actions);
  return card;
}
