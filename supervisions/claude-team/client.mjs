// Claude team card (supervision plugin claude-team): the sessions Claude Code
// has open, the team of agents with their model and what the active ones work
// on, and the tasks of the last 24 hours. A bundled card: it reuses the
// interface modules by their /js/ path, which a third-party plugin should not
// rely on (docs/EXTENDING.md). The status is always written, never only coloured.
import {
  applyHostColor,
  cardKey,
  isExpanded,
  setExpanded,
  updateSmartCollapseButton
} from "/js/supervision/cards.js";
import { relativeAge, reportDateText } from "/js/supervision/format.js";
import { element as node } from "/js/element.js";
import {
  counts,
  durationText,
  health,
  leadMember,
  orderedTeam,
  roleOf,
  sessionState
} from "./view.mjs";

const STATE_ICONS = {
  working: "fa-solid fa-gear",
  waiting: "fa-solid fa-hourglass-half",
  unknown: "fa-solid fa-circle-question"
};

function icon(classes) {
  const item = node("i", classes);
  item.setAttribute("aria-hidden", "true");
  return item;
}

function title(text) {
  return node("h4", "claude-team-title", text);
}

function facts(parts) {
  return node("span", "claude-team-facts", parts.filter(Boolean).join(" · "));
}

function since(ctx, seconds) {
  if (!seconds) return "";
  const age = Math.floor(Date.now() / 1000 - seconds);
  return ctx.t("since") + " " + durationText(age);
}

function sessionRow(ctx, session) {
  const state = sessionState(session.status);
  const row = node("li", "claude-team-session is-" + state);
  const label = node("span", "claude-team-state");
  label.append(
    icon(STATE_ICONS[state]),
    node("span", "", ctx.t(state === "unknown" ? "unknownState" : state))
  );
  const name = node("strong", "claude-team-name", session.project || ctx.t("session"));
  if (session.name) name.title = session.name;
  row.append(name, label, facts([session.model, since(ctx, session.statusSince || session.since)]));
  return row;
}

// The project lead: the main session, first of the team.
function leadRow(ctx, report) {
  const lead = leadMember(report);
  const row = node("li", "claude-team-member claude-team-lead" + (lead.active ? " is-active" : ""));
  const dot = node("span", "claude-team-dot");
  dot.append(icon(lead.active ? "fa-solid fa-circle" : "fa-regular fa-circle"));
  const head = node("div", "claude-team-member-head");
  const name = node("strong", "claude-team-name", ctx.t("lead"));
  name.title = ctx.t("leadHint");
  head.append(
    dot,
    name,
    node("span", "claude-team-flag", ctx.t(lead.active ? "active" : "inactive")),
    node("span", "claude-team-facts", lead.model || "")
  );
  row.appendChild(head);
  if (lead.active) {
    const line = node("div", "claude-team-task");
    line.append(facts([lead.projects.join(", "), since(ctx, lead.since)]));
    row.appendChild(line);
  }
  return row;
}

// The dot is doubled by a word and a different shape: the state does not
// depend on the colour.
function memberRow(ctx, member) {
  const row = node("li", "claude-team-member" + (member.active ? " is-active" : ""));
  const dot = node("span", "claude-team-dot");
  dot.append(icon(member.active ? "fa-solid fa-circle" : "fa-regular fa-circle"));
  const head = node("div", "claude-team-member-head");
  const role = roleOf(member, ctx.t);
  const name = node("strong", "claude-team-name", role);
  name.title = [member.name, member.description].filter(Boolean).join(" — ");
  const state = node("span", "claude-team-flag", ctx.t(member.active ? "active" : "inactive"));
  // The identifier stays visible when the role replaced it: it is what a
  // task names and what the files are called.
  const model = node(
    "span",
    "claude-team-facts",
    [role !== member.name ? member.name : "", member.configuredModel].filter(Boolean).join(" · ")
  );
  if (member.configuredModel) model.title = ctx.t("configured");
  head.append(dot, name, state, model);
  row.appendChild(head);
  if (member.active && member.task) {
    const task = member.task;
    const line = node("div", "claude-team-task");
    if (task.title) line.append(node("span", "claude-team-task-title", task.title));
    line.append(facts([task.project, task.model, since(ctx, task.since)]));
    row.appendChild(line);
  }
  return row;
}

function historyList(ctx, report) {
  const box = node("div", "claude-team-history");
  box.appendChild(title(ctx.t("history")));
  const perAgent = orderedTeam(report.team).filter(member => member.tasks24h > 0);
  if (!perAgent.length) {
    box.appendChild(node("p", "claude-team-empty", ctx.t("noTask")));
    return box;
  }
  const counters = node("ul", "claude-team-counts");
  counters.setAttribute("aria-label", ctx.t("tasksPerAgent"));
  for (const member of perAgent) {
    const item = node("li", "");
    item.append(
      node("span", "", roleOf(member, ctx.t)),
      node("strong", "", String(member.tasks24h))
    );
    counters.appendChild(item);
  }
  box.appendChild(counters);
  if (report.recent.length) {
    const byName = new Map(report.team.map(member => [member.name, member]));
    const label = name => roleOf(byName.get(name) || { name }, ctx.t);
    box.appendChild(title(ctx.t("recent")));
    const recent = node("ul", "claude-team-recent");
    for (const task of report.recent) {
      const item = node("li", "");
      const when = task.end ? ctx.relativeAge(task.end) : ctx.t("inProgress");
      item.append(
        node("strong", "", label(task.agent)),
        node("span", "claude-team-task-title", task.title || ""),
        facts([task.project, task.model, when])
      );
      recent.appendChild(item);
    }
    box.appendChild(recent);
  }
  return box;
}

function makeFoldable(card, host) {
  const key = JSON.stringify([...JSON.parse(cardKey(host)), "claude-team"]);
  card.dataset.pluginKey = key;
  const expanded = isExpanded("supervisionPluginExpanded", key);
  card.classList.toggle("expanded", expanded);
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", String(expanded));
  card.tabIndex = 0;
  const toggle = () => {
    const open = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(open));
    setExpanded("supervisionPluginExpanded", key, open);
    updateSmartCollapseButton();
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", event => {
    if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggle();
  });
}

export function element(ctx) {
  const report = ctx.report;
  if (!report || !Array.isArray(report.team) || !Array.isArray(report.sessions)) return null;
  const verdict = health(report);
  const card = node(
    "article",
    "supervision-card supervision-card-plugin has-details supervision-card-claude-team is-" +
      verdict.level
  );
  applyHostColor(card, ctx.host);
  makeFoldable(card, ctx.host);

  const head = node("div", "supervision-head");
  const chevron = icon("fa-solid fa-chevron-down supervision-smart-chevron");
  head.append(
    icon("fa-solid fa-people-group"),
    node("span", "supervision-name", ctx.t("title")),
    node("span", "supervision-type", ctx.t("badge")),
    chevron
  );

  const status = node("div", "supervision-health");
  const state = node("span", "supervision-health-state");
  const { sessions, agents } = counts(report);
  const text = ctx
    .t(verdict.key)
    .replace("{sessions}", String(sessions))
    .replace("{agents}", String(agents));
  const levelIcon =
    verdict.level === "warning"
      ? "fa-solid fa-circle-exclamation"
      : verdict.level === "healthy"
        ? "fa-solid fa-circle-check"
        : "fa-solid fa-moon";
  state.append(icon(levelIcon), node("strong", "", text));
  status.appendChild(state);
  if (verdict.key === "stale")
    status.appendChild(
      node("span", "claude-team-age", relativeAge(Date.now() / 1000 - report.generatedAt))
    );

  card.append(head, status);

  const sessionBox = node("section", "claude-team-block");
  sessionBox.appendChild(title(ctx.t("sessions")));
  if (report.sessions.length) {
    const list = node("ul", "claude-team-list");
    for (const session of report.sessions) list.appendChild(sessionRow(ctx, session));
    sessionBox.appendChild(list);
  } else sessionBox.appendChild(node("p", "claude-team-empty", ctx.t("noSession")));

  const teamBox = node("section", "claude-team-block");
  teamBox.appendChild(title(ctx.t("team")));
  const list = node("ul", "claude-team-list");
  list.appendChild(leadRow(ctx, report));
  for (const member of orderedTeam(report.team)) list.appendChild(memberRow(ctx, member));
  teamBox.appendChild(list);
  if (!report.team.length) teamBox.appendChild(node("p", "claude-team-empty", ctx.t("noAgent")));

  const details = node("div", "claude-team-details");
  details.append(historyList(ctx, report));
  details.appendChild(
    node("p", "claude-team-date", ctx.t("reportDate") + " : " + reportDateText(report.generatedAt))
  );
  card.append(sessionBox, teamBox, details);
  return card;
}
