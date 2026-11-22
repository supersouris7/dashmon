// Claude team card: what the report means, without any DOM so that it can be
// tested under Node (test/claude-team.test.js).

// A report older than this is flagged: the cron job has probably stopped.
export const STALE_SECONDS = 600;

// "busy" is the only working state Claude Code writes today; anything but
// "idle" or "waiting" that we do not know stays "unknown", never guessed.
export function sessionState(status) {
  if (status === "busy") return "working";
  if (status === "idle" || status === "waiting") return "waiting";
  return "unknown";
}

export function isStale(report, now = Date.now() / 1000) {
  return !report.generatedAt || now - report.generatedAt > STALE_SECONDS;
}

// "45 s", "12 min", "3 h 05", "2 d": short enough for a mobile card.
export function durationText(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return s + " s";
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " h " + String(minutes % 60).padStart(2, "0");
  return Math.floor(hours / 24) + " d";
}

export function counts(report) {
  return {
    sessions: report.sessions.length,
    agents: report.team.filter(member => member.active).length
  };
}

// Status line: stale report, activity, or nothing going on.
export function health(report, now = Date.now() / 1000) {
  if (isStale(report, now)) return { level: "warning", key: "stale" };
  const { sessions, agents } = counts(report);
  return sessions || agents
    ? { level: "healthy", key: "summary" }
    : { level: "unknown", key: "idle" };
}

// Built-in Claude Code agents: no description to read a role from, so a
// translated name (manifest strings).
const BUILT_IN_ROLES = {
  Explore: "roleExplore",
  Plan: "rolePlan",
  "general-purpose": "roleGeneralPurpose",
  "claude-code-guide": "roleGuide",
  "statusline-setup": "roleStatusline",
  "web-fetch": "roleWebFetch",
  fork: "roleFork"
};

// Name shown for an agent: its role ("Security expert"), else the translated
// built-in name, else its identifier.
export function roleOf(member, t) {
  if (member.role) return member.role;
  const key = BUILT_IN_ROLES[member.name];
  return key ? t(key) : member.name;
}

// The project lead is the main session itself, which hands tasks to the
// agents: active while a session works, with its model and projects.
export function leadMember(report, now = Date.now() / 1000) {
  const working = report.sessions.filter(session => sessionState(session.status) === "working");
  const pick = working.length ? working : report.sessions;
  const models = [...new Set(pick.map(session => session.model).filter(Boolean))];
  const projects = [...new Set(pick.map(session => session.project).filter(Boolean))];
  const since = Math.min(...working.map(session => session.statusSince || session.since || now));
  return {
    lead: true,
    active: working.length > 0,
    model: models.join(", ") || null,
    projects,
    since: working.length ? since : null
  };
}

// Active agents first, then the declared ones, then the others, each by name.
export function orderedTeam(team) {
  return [...team].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(b.declared) - Number(a.declared) ||
      a.name.localeCompare(b.name)
  );
}
