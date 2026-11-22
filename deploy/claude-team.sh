#!/usr/bin/env sh
# claude-team.sh
# Summarises what Claude Code is doing right now for Dashmon: the open
# sessions, the team of subagents (declared in ~/.claude/agents, launched in
# the last 24 hours) and the tasks they worked on. Installation guide:
# docs/CLAUDE_TEAM.md.
#
# Run it as the user who works with Claude Code, every minute: it only reads
# the sessions, the agents declared, and the files modified in the last 24
# hours, and of those only their beginning or their end. Prompts, code and
# conversations never leave the host: only short summaries are written
# (project folder name, state, model, truncated task title).
#
# No Node.js is needed on the host: the summary is built with the Node.js of
# the Dashmon container, which receives a few lines on its standard input and
# keeps nothing. Only the bind mount variant (DASHMON_CLAUDE_TEAM_REPORT, no
# Docker) runs it with a local node.
#
# DASHMON_CLAUDE_TEAM_TITLES=0 writes no task title at all (nor session
# name): the project only.
#
# Usage : claude-team.sh [container] [path-in-container]
set -eu

# Version of this script, written into its report: Dashmon flags a report
# made by an older script (docs/SCRIPTS.md). Raise it on every change.
SCRIPT_VERSION=1

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_CLAUDE_TEAM_CONTAINER_PATH:-/app/data/claude-team.json}"
HOST_FILE="${DASHMON_CLAUDE_TEAM_REPORT:-}"
TITLES="${DASHMON_CLAUDE_TEAM_TITLES:-1}"
NODE="${NODE_BIN:-}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}"

case "${1:-}" in
  "" ) ;;
  /* | .* ) HOST_FILE="$1" ;;
  * )
    CONT_NAME="$1"
    if [ "$#" -ge 2 ]; then CONT_PATH="$2"; fi
    ;;
esac

if [ ! -d "$CLAUDE_DIR" ]; then
  echo "claude-team.sh: no Claude Code folder at $CLAUDE_DIR. Set CLAUDE_CONFIG_DIR." >&2
  exit 1
fi

# Where the summary is built: in the Dashmon container by default, with a
# local node for the bind mount variant only.
if [ -n "$HOST_FILE" ]; then
  # cron starts with a minimal PATH: the newest nvm install is tried too.
  if [ -z "$NODE" ]; then
    if command -v node >/dev/null 2>&1; then
      NODE="$(command -v node)"
    else
      NODE="$(ls -d "${HOME:-}"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1 || true)"
    fi
  fi
  if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
    echo "claude-team.sh: writing on the host needs Node.js ('node' not found). Set NODE_BIN, or drop DASHMON_CLAUDE_TEAM_REPORT to use the Dashmon container." >&2
    exit 1
  fi
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "claude-team.sh: 'docker' not found. Set DASHMON_CLAUDE_TEAM_REPORT to write on the host." >&2
    exit 1
  fi
  if ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
    echo "claude-team.sh: container '$CONT_NAME' not found. Set DASHMON_CONTAINER." >&2
    exit 1
  fi
fi

TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-claude-team.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

# The input is one record per line, each starting with its kind:
#   #SESSION {json}  an open session (its process is alive)
#   #AGENT {json}    a subagent run of the last 24 hours
#   #DECL name       an agent declared in ~/.claude/agents, followed by its
#                    "key: value" lines (name, model, description)
CODE="$(cat <<'EOF'
"use strict";
const readline = require("readline");

const NOW = Date.now();
const NOW_SECONDS = Math.floor(NOW / 1000);
const ACTIVE_SECONDS = 120;
const TITLE_MAX = 80;
const SHORT_MAX = 60;
const TITLES = process.argv[2] !== "0";

// Short, single-line text: control characters are dropped, spaces collapsed.
function clean(value, max) {
  if (value === undefined || value === null || typeof value === "object") return "";
  let text = "";
  for (const char of String(value)) {
    const code = char.codePointAt(0);
    text += code < 32 || (code >= 127 && code < 160) || code === 0x2028 || code === 0x2029 ? " " : char;
  }
  const letters = Array.from(text.replace(/\s+/g, " ").trim());
  return letters.length > max ? letters.slice(0, max - 1).join("") + "…" : letters.join("");
}

// Folder name of a path, whatever the separator.
function project(cwd) {
  const parts = String(cwd || "").split(/[\\/]+/).filter(Boolean);
  return clean(parts[parts.length - 1] || "", SHORT_MAX) || null;
}

// Epoch seconds from milliseconds, seconds or an ISO date; null if unknown.
function seconds(value) {
  const number = typeof value === "string" && /[-T:]/.test(value) ? Date.parse(value) : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.floor(number > 1e11 ? number / 1000 : number);
}

function parse(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

async function main() {
  const sessions = [];
  const runs = [];
  const declared = new Map();
  let decl = null;
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.startsWith("#DECL ")) {
      decl = { file: clean(line.slice(6), SHORT_MAX), fields: {} };
      declared.set(decl.file, decl);
      continue;
    }
    if (decl && !line.startsWith("#")) {
      const match = /^(name|model|description):\s*(.*)$/.exec(line);
      if (match && !(match[1] in decl.fields)) decl.fields[match[1]] = match[2].replace(/^["']|["']$/g, "");
      continue;
    }
    decl = null;
    if (line.startsWith("#SESSION ")) {
      const record = parse(line.slice(9));
      if (record) sessions.push(record);
    } else if (line.startsWith("#AGENT ")) {
      const record = parse(line.slice(7));
      if (record) runs.push(record);
    }
  }

  const alive = new Map();
  const outSessions = sessions
    .map(item => {
      const since = seconds(item.startedAt);
      if (item.sessionId) alive.set(String(item.sessionId), project(item.cwd));
      return {
        project: project(item.cwd),
        name: TITLES ? clean(item.name, TITLE_MAX) || null : null,
        status: clean(item.status, 20).toLowerCase() || null,
        kind: clean(item.kind, 20).toLowerCase() || null,
        model: clean(item.model, 80) || null,
        since,
        statusSince: seconds(item.statusUpdatedAt) || seconds(item.updatedAt) || since
      };
    })
    .sort((a, b) => (b.since || 0) - (a.since || 0))
    .slice(0, 20);

  const tasks = [];
  for (const run of runs) {
    const meta = run.meta || {};
    const end = seconds(run.mtime);
    if (!end || NOW_SECONDS - end > 86400) continue;
    const sid = String(run.sid || "");
    const running = alive.has(sid) && !run.done && NOW_SECONDS - end < ACTIVE_SECONDS;
    tasks.push({
      agent: clean(meta.agentType, SHORT_MAX) || "unknown",
      title: TITLES ? clean(meta.description, TITLE_MAX) || null : null,
      project: project(run.cwd) || alive.get(sid) || null,
      model: clean(run.model || meta.pickedEffortModel || meta.model, 80) || null,
      start: seconds(run.start) || end,
      end,
      active: running
    });
  }

  const team = new Map();
  const entry = name =>
    team.get(name) ||
    team.set(name, {
      name,
      configuredModel: null,
      description: null,
      declared: false,
      active: false,
      task: null,
      tasks24h: 0
    }).get(name);
  for (const item of declared.values()) {
    const name = clean(item.fields.name || item.file.replace(/\.md$/, ""), SHORT_MAX);
    if (!name) continue;
    const member = entry(name);
    member.declared = true;
    member.configuredModel = clean(item.fields.model, 80) || null;
    // The description is free text too: dropped with the titles.
    member.description = TITLES ? clean(item.fields.description, TITLE_MAX) || null : null;
  }
  for (const task of tasks) {
    const member = entry(task.agent);
    member.tasks24h++;
    if (task.active && (!member.task || task.start > member.task.since)) {
      member.active = true;
      member.task = { title: task.title, project: task.project, model: task.model, since: task.start };
    }
  }

  const recent = tasks
    .sort((a, b) => b.end - a.end)
    .slice(0, 10)
    .map(task => ({
      agent: task.agent,
      title: task.title,
      project: task.project,
      model: task.model,
      start: task.start,
      end: task.active ? null : task.end
    }));

  process.stdout.write(
    JSON.stringify({
      version: 1,
      generatedAt: NOW_SECONDS,
      scriptVersion: Number(process.argv[1]) || 0,
      sessions: outSessions,
      team: [...team.values()]
        .sort((a, b) => Number(b.declared) - Number(a.declared) || a.name.localeCompare(b.name))
        .slice(0, 50),
      recent
    })
  );
}
main().catch(error => {
  process.stderr.write("claude-team.sh: " + error.message + "\n");
  process.exit(1);
});
EOF
)"

# Modification time in epoch seconds (GNU stat, then BSD stat).
mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

# One "key":value pair of a JSON line read on the standard input: strings
# without escapes or numbers only, a pair that does not fit is simply absent.
pick() { grep -oE "\"$1\":(\"[^\"\\]*\"|[0-9]+)" | head -n 1 || true; }

# The model of the last assistant reply of a log, from its end only.
last_model() {
  tail -c 262144 "$1" 2>/dev/null | grep '"type":"assistant"' | grep -oE '"model":"claude-[A-Za-z0-9._:-]*"' | tail -n 1 | cut -d'"' -f4 || true
}

# Sessions whose process still runs: /proc where it exists, else kill -0.
sessions() {
  for file in "$CLAUDE_DIR"/sessions/*.json; do
    [ -f "$file" ] || continue
    pid="$(pick pid < "$file" | cut -d: -f2)"
    case "$pid" in "" | *[!0-9]*) continue ;; esac
    if [ ! -d "/proc/$pid" ] && ! kill -0 "$pid" 2>/dev/null; then continue; fi
    sid="$(pick sessionId < "$file" | cut -d'"' -f4)"
    case "$sid" in "" | *[!A-Za-z0-9_-]*) sid="" ;; esac
    model=""
    if [ -n "$sid" ]; then
      for log in "$CLAUDE_DIR"/projects/*/"$sid".jsonl; do
        [ -f "$log" ] && model="$(last_model "$log")"
        break
      done
    fi
    fields=""
    for key in sessionId cwd name status kind startedAt statusUpdatedAt updatedAt; do
      pair="$(tr -d '\r\n' < "$file" | pick "$key")"
      [ -n "$pair" ] && fields="$fields${fields:+,}$pair"
    done
    [ -n "$model" ] && fields="$fields${fields:+,}\"model\":\"$model\""
    printf '#SESSION {%s}\n' "$fields"
  done
}

# Subagent runs of the last 24 hours: the meta file, the start and the
# folder from the first line of the log, the model and the end of the run
# from its last lines. The prompt of the run is never printed.
agents() {
  [ -d "$CLAUDE_DIR/projects" ] || return 0
  find "$CLAUDE_DIR/projects" -type f -name 'agent-*.jsonl' -path '*/subagents/*' -mmin -1440 2>/dev/null |
    while IFS= read -r log; do
      meta="${log%.jsonl}.meta.json"
      [ -f "$meta" ] || continue
      sid="$(basename "$(dirname "$(dirname "$log")")")"
      case "$sid" in *[!A-Za-z0-9_-]*) sid="" ;; esac
      first="$(head -n 1 "$log" | cut -c1-200000)"
      cwd="$(printf '%s' "$first" | pick cwd | cut -d'"' -f4)"
      start="$(printf '%s' "$first" | pick timestamp | cut -d'"' -f4)"
      finished=0
      if tail -c 16384 "$log" | tail -n 1 | grep -q '"stop_reason":"end_turn"'; then finished=1; fi
      body="$(head -c 8192 "$meta" | tr -d '\r\n')"
      printf '#AGENT {"sid":"%s","mtime":%s,"done":%s,"start":"%s","cwd":"%s","model":"%s","meta":%s}\n' \
        "$sid" "$(mtime "$log")" "$finished" "$start" "$cwd" "$(last_model "$log")" "${body:-null}"
    done
}

# Declared agents: the front matter of each file, three keys at most.
declared() {
  for file in "$CLAUDE_DIR"/agents/*.md; do
    [ -f "$file" ] || continue
    # A control character in the name could forge a line of the summary.
    case "$(basename "$file")" in *[[:cntrl:]]*) continue ;; esac
    printf '#DECL %s\n' "$(basename "$file")"
    tr -d '\r' < "$file" | head -n 40 | awk 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit } NR > 1 { print }' |
      grep -E '^(name|model|description):' | cut -c1-300 || true
  done
}

summary() {
  sessions
  agents
  declared
}

if [ -n "$HOST_FILE" ]; then
  summary | "$NODE" -e "$CODE" "$SCRIPT_VERSION" "$TITLES" > "$TMP"
  mkdir -p "$(dirname "$HOST_FILE")"
  [ -s "$TMP" ] || { echo "claude-team.sh: empty summary, report kept" >&2; exit 1; }
  # Unpredictable name in the same directory: no symbolic link to follow,
  # and mv stays an atomic rename.
  OUT_TMP="$(mktemp "$(dirname "$HOST_FILE")/.claude-team.XXXXXX")"
  cat "$TMP" > "$OUT_TMP"
  chmod 600 "$OUT_TMP"
  if [ "$(id -u)" = "0" ]; then chown 1000:1000 "$OUT_TMP" 2>/dev/null || true; fi
  mv -f "$OUT_TMP" "$HOST_FILE"
  echo "claude-team.sh: report written to $HOST_FILE" >&2
  exit 0
fi

summary | docker exec -i "$CONT_NAME" node -e "$CODE" "$SCRIPT_VERSION" "$TITLES" > "$TMP"
[ -s "$TMP" ] || { echo "claude-team.sh: empty summary, report kept" >&2; exit 1; }
# Atomic write: the server never meets a half-written JSON.
docker exec -i "$CONT_NAME" sh -c 'cat > "$1.tmp" && mv -f "$1.tmp" "$1"' sh "$CONT_PATH" < "$TMP"
echo "claude-team.sh: report written to $CONT_NAME:$CONT_PATH" >&2
