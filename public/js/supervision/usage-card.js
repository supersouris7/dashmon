// Coding agent cards (OpenCode, Claude Code): usage reports written by
// deploy/opencode-stats.sh and deploy/claude-stats.sh in one format. Collapsed,
// a card shows today's activity and the last 30 days at a glance; expanded, the
// chosen period with its models, tokens, cost, tools and daily activity.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "./cards.js";
import { t } from "../i18n.js";
import { state } from "../state.js";
import { relativeAge, reportDateText, smartNumberText } from "./format.js";

const PERIODS = ["today", "week", "month", "all"];
// A report older than this is flagged: the cron job has probably stopped.
const STALE_SECONDS = 6 * 3600;
// One card per source; `field` is the key of the report in the host metrics.
export const USAGE_SOURCES = [
  {
    field: "opencode",
    title: "supervisionOpencodeTitle",
    icon: "fa-solid fa-terminal",
    pref: "supervisionOpencodeExpanded",
    keyName: "opencodeKey"
  },
  {
    field: "claude",
    title: "supervisionClaudeTitle",
    icon: "fa-solid fa-code",
    pref: "supervisionClaudeExpanded",
    keyName: "claudeKey"
  }
];
// The period shown in the details of each source, kept across the periodic
// re-renders.
const periodBySource = new Map();

function locale() {
  return state.language === "fr" ? "fr-FR" : "en-US";
}

// Tokens run into the millions: compact notation, exact value in the title.
export function tokensText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1000) return String(Math.floor(n));
  return new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(
    n
  );
}

export function costText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  return new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2
  }).format(n);
}

// Work done by the model: what it read, wrote and reasoned. Cache reads are
// shown apart, they would dwarf everything else.
export function usedTokens(tokens) {
  return (
    (Number(tokens?.input) || 0) + (Number(tokens?.output) || 0) + (Number(tokens?.reasoning) || 0)
  );
}

// One entry per day of the last `days` days, zero when the agent was idle.
export function dailyActivity(activity, days, now = new Date()) {
  const steps = new Map((activity || []).map(item => [item.date, Number(item.steps) || 0]));
  const out = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const date = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0")
    ].join("-");
    out.push({ date, steps: steps.get(date) || 0 });
  }
  return out;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sectionTitle(key) {
  return element("h4", "usage-section-title", t(key));
}

function figures(data) {
  const grid = element("div", "usage-figures");
  for (const [key, value] of [
    ["opencodeSessions", smartNumberText(data.sessions)],
    ["opencodePrompts", smartNumberText(data.prompts)],
    ["opencodeSteps", smartNumberText(data.steps)],
    data.cost > 0 ? ["opencodeCost", costText(data.cost)] : null
  ].filter(Boolean)) {
    const cell = element("div", "usage-figure");
    cell.append(element("strong", "", value), element("span", "", t(key)));
    grid.appendChild(cell);
  }
  return grid;
}

function tokenBreakdown(tokens) {
  const list = element("div", "usage-tokens");
  for (const [key, field] of [
    ["opencodeTokensInput", "input"],
    ["opencodeTokensOutput", "output"],
    ["opencodeTokensReasoning", "reasoning"],
    ["opencodeTokensCacheRead", "cacheRead"],
    ["opencodeTokensCacheWrite", "cacheWrite"]
  ]) {
    const item = element("div", "usage-token");
    const value = element("strong", "", tokensText(tokens[field]));
    value.title = smartNumberText(tokens[field]);
    item.append(element("span", "", t(key)), value);
    list.appendChild(item);
  }
  return list;
}

// One line per model, the heaviest first, with its share of the period's
// tokens as a bar and the detail of its consumption underneath. Costs only
// show when the period cost something: free and subscription models report 0.
function modelList(models, showCost) {
  const list = element("div", "usage-models");
  const sorted = [...models].sort((a, b) => usedTokens(b.tokens) - usedTokens(a.tokens));
  const total = sorted.reduce((sum, model) => sum + usedTokens(model.tokens), 0);
  if (!sorted.length) {
    list.appendChild(element("p", "usage-empty", t("opencodeNoModel")));
    return list;
  }
  for (const model of sorted) {
    const used = usedTokens(model.tokens);
    const share = total ? Math.round((used / total) * 100) : 0;
    const row = element("div", "usage-model");
    const head = element("div", "usage-model-head");
    const name = element("span", "usage-model-name", model.id);
    name.title = model.provider ? model.provider + "/" + model.id : model.id;
    const provider = element("span", "usage-model-provider", model.provider);
    const amount = element("span", "usage-model-amount", tokensText(used));
    amount.title = smartNumberText(used) + " " + t("opencodeTokensUnit");
    head.append(name, provider, amount);
    if (showCost) head.appendChild(element("span", "usage-model-cost", costText(model.cost)));
    const bar = element("div", "usage-bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", share + " %");
    const fill = element("span");
    fill.style.width = share + "%";
    bar.appendChild(fill);
    const detail = element(
      "div",
      "usage-model-detail",
      [
        t("opencodeTokensInput") + " " + tokensText(model.tokens.input),
        t("opencodeTokensOutput") + " " + tokensText(model.tokens.output),
        t("opencodeTokensReasoning") + " " + tokensText(model.tokens.reasoning),
        t("opencodeTokensCacheRead") + " " + tokensText(model.tokens.cacheRead),
        smartNumberText(model.steps) + " " + t("opencodeStepsUnit"),
        share + " %"
      ].join(" · ")
    );
    row.append(head, bar, detail);
    list.appendChild(row);
  }
  return list;
}

// Most used tools; a failure count turns the line orange.
function toolList(tools) {
  const list = element("div", "usage-tools");
  for (const tool of [...tools].sort((a, b) => b.calls - a.calls).slice(0, 8)) {
    const item = element("div", "usage-tool" + (tool.failed ? " warn" : ""));
    item.append(element("span", "", tool.name), element("strong", "", smartNumberText(tool.calls)));
    if (tool.failed) {
      const failed = element(
        "small",
        "",
        smartNumberText(tool.failed) +
          " " +
          t(tool.failed > 1 ? "opencodeFailed" : "opencodeFailedOne")
      );
      item.appendChild(failed);
    }
    list.appendChild(item);
  }
  return list;
}

function activityChart(activity) {
  const days = dailyActivity(activity, 30);
  const max = Math.max(1, ...days.map(day => day.steps));
  const chart = element("div", "usage-activity");
  chart.setAttribute("role", "img");
  chart.setAttribute(
    "aria-label",
    t("opencodeActivity") +
      " : " +
      days.filter(day => day.steps).length +
      " " +
      t("opencodeDaysUnit")
  );
  for (const day of days) {
    const bar = element("span", day.steps ? "" : "idle");
    bar.style.height = Math.max(day.steps ? 8 : 3, Math.round((day.steps / max) * 100)) + "%";
    bar.title = day.date + " : " + smartNumberText(day.steps) + " " + t("opencodeStepsUnit");
    chart.appendChild(bar);
  }
  return chart;
}

// Card colour and status line: stale report, active today or idle.
function usageHealth(report, today) {
  const age = report.fetchedAt ? Math.floor(Date.now() / 1000) - report.fetchedAt : null;
  const stale = age !== null && age > STALE_SECONDS;
  const active = (today?.steps || 0) > 0;
  const health = stale
    ? { level: "warning", label: "opencodeStale", icon: "fa-solid fa-circle-exclamation" }
    : active
      ? { level: "healthy", label: "opencodeActiveToday", icon: "fa-solid fa-circle-check" }
      : { level: "unknown", label: "opencodeIdleToday", icon: "fa-solid fa-moon" };
  return { health, stale, age };
}

// The whole card folds and unfolds, except from the period buttons.
function makeFoldable(card, host, source) {
  const key = cardKey(host);
  card.dataset[source.keyName] = key;
  const expanded = isExpanded(source.pref, key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded(source.pref, key, open);
    updateSmartCollapseButton();
  };
  // The period buttons live inside the card: they must not fold it.
  card.addEventListener("click", event => {
    if (!event.target.closest(".usage-periods")) toggle();
  });
  card.addEventListener("keydown", event => {
    if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggle();
  });
}

function usageHead(report, source) {
  const head = element("div", "supervision-head");
  const icon = element("i", source.icon);
  icon.setAttribute("aria-hidden", "true");
  const badge = element("span", "supervision-type", report.version ? "v" + report.version : "IA");
  const chevron = element("i", "fa-solid fa-chevron-down supervision-smart-chevron");
  chevron.setAttribute("aria-hidden", "true");
  head.append(icon, element("span", "supervision-name", t(source.title)), badge, chevron);
  return head;
}

function usageStatus(health, stale, age) {
  const status = element("div", "supervision-health");
  const stateLine = element("span", "supervision-health-state");
  const stateIcon = element("i", health.icon);
  stateIcon.setAttribute("aria-hidden", "true");
  const label = element("strong", "", t(health.label));
  stateLine.append(stateIcon, label);
  status.appendChild(stateLine);
  if (stale) status.appendChild(element("span", "usage-age", relativeAge(age)));
  return status;
}

// Summary, always visible: today's tokens, then the last 30 days.
function usageSummary(card, periods, today, month) {
  const summary = element("div", "supervision-apt-summary usage-summary");
  const todayTokens = usedTokens(today?.tokens);
  const big = element("strong", "", tokensText(todayTokens));
  big.title = smartNumberText(todayTokens);
  summary.append(big, element("span", "", t("opencodeTokensToday")));
  card.appendChild(summary);
  if (month) {
    const main = [...(month.models || [])].sort(
      (a, b) => usedTokens(b.tokens) - usedTokens(a.tokens)
    )[0];
    const facts = element("div", "supervision-smart-facts usage-facts");
    for (const text of [
      t(periods.month ? "opencodePeriodMonth" : "opencodePeriodAll") +
        " : " +
        tokensText(usedTokens(month.tokens)) +
        " " +
        t("opencodeTokensUnit"),
      month.cost > 0 ? costText(month.cost) : "",
      smartNumberText(month.sessions) + " " + t("opencodeSessionsUnit"),
      main ? t("opencodeMainModel") + " : " + main.id : ""
    ].filter(Boolean))
      facts.appendChild(element("span", "", text));
    card.appendChild(facts);
  }
}

// Details: the figures of the chosen period, remembered per source.
function periodDetails(periods, source) {
  const available = PERIODS.filter(name => periods[name]);
  let period = periodBySource.get(source.field) || "month";
  if (!periods[period]) period = available.includes("month") ? "month" : available[0];
  const switcher = element("div", "usage-periods");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", t("opencodePeriod"));
  const body = element("div", "usage-period-body");
  const renderPeriod = () => {
    const data = periods[period];
    for (const button of switcher.children) {
      const selected = button.dataset.period === period;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    body.replaceChildren(
      figures(data),
      sectionTitle("opencodeTokens"),
      tokenBreakdown(data.tokens),
      sectionTitle("opencodeModels"),
      modelList(data.models || [], data.cost > 0)
    );
    if (data.tools?.length) body.append(sectionTitle("opencodeTools"), toolList(data.tools));
  };
  for (const name of available) {
    const button = element(
      "button",
      "usage-period",
      t("opencodePeriod" + name[0].toUpperCase() + name.slice(1))
    );
    button.type = "button";
    button.dataset.period = name;
    button.addEventListener("click", () => {
      period = name;
      periodBySource.set(source.field, name);
      renderPeriod();
    });
    switcher.appendChild(button);
  }
  renderPeriod();
  return [switcher, body];
}

function activityDetails(report, periods, month) {
  const activitySource = (periods.month || periods.all)?.activity || [];
  const activityBox = element("div", "usage-activity-box");
  activityBox.append(sectionTitle("opencodeActivity"), activityChart(activitySource));
  const streak = element("div", "supervision-smart-facts");
  const reference = periods.all || month;
  if (reference) {
    streak.append(
      element("span", "", t("opencodeActiveDays") + " : " + smartNumberText(reference.activeDays)),
      element(
        "span",
        "",
        t("opencodeStreak") +
          " : " +
          smartNumberText(reference.streak) +
          " " +
          t("opencodeDaysUnit")
      )
    );
  }
  streak.appendChild(
    element("span", "", t("opencodeReportDate") + " : " + reportDateText(report.fetchedAt))
  );
  activityBox.appendChild(streak);
  return activityBox;
}

export function usageCard(host, metrics, source) {
  const report = metrics[source.field];
  const periods = report.periods || {};
  const today = periods.today;
  const month = periods.month || periods.all;
  const { health, stale, age } = usageHealth(report, today);

  const card = element("article", "supervision-card supervision-card-usage is-" + health.level);
  applyHostColor(card, host);
  makeFoldable(card, host, source);
  card.append(usageHead(report, source), usageStatus(health, stale, age));
  usageSummary(card, periods, today, month);

  const details = element("div", "usage-details");
  details.append(...periodDetails(periods, source), activityDetails(report, periods, month));
  card.appendChild(details);
  return card;
}
