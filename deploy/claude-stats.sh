#!/usr/bin/env sh
# claude-stats.sh
# Collects the Claude Code usage statistics (models, tokens, tools, activity)
# from its session logs and writes them for Dashmon, in the same format as
# opencode-stats.sh. Installation guide: docs/CLAUDE_CODE.md.
#
# Run it as the user who works with Claude Code: the session logs live in
# their home directory. Conversations never leave the host, only counters.
#
# Usage : claude-stats.sh [container] [path-in-container]
set -eu

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_CLAUDE_CONTAINER_PATH:-/app/data/claude.json}"
HOST_FILE="${DASHMON_CLAUDE_REPORT:-}"
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

# cron starts with a minimal PATH: the newest nvm install is tried too.
if [ -z "$NODE" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE="$(command -v node)"
  else
    NODE="$(ls -d "${HOME:-}"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1 || true)"
  fi
fi
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "claude-stats.sh: 'node' not found. Set NODE_BIN." >&2
  exit 1
fi
if [ ! -d "$CLAUDE_DIR/projects" ]; then
  echo "claude-stats.sh: no session logs in $CLAUDE_DIR/projects. Set CLAUDE_CONFIG_DIR." >&2
  exit 1
fi

TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-claude.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

# Each assistant reply is logged once per content block with the same usage:
# replies are counted once by message id. Only counters are printed.
"$NODE" - "$CLAUDE_DIR/projects" > "$TMP" <<'EOF'
"use strict";
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DAY = 86400000;
const now = new Date();
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const PERIODS = {
  today: midnight,
  week: midnight - 6 * DAY,
  month: midnight - 29 * DAY,
  all: 0
};

function dayKey(time) {
  const d = new Date(time);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function files(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
  }
  return out;
}

// A typed prompt, not a tool result, a command output or an injected note.
function isPrompt(record) {
  if (record.isMeta || record.isCompactSummary || record.isSidechain) return false;
  const content = record.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content) && !content.some(block => block?.type === "tool_result")
        ? content.filter(block => block?.type === "text").map(block => block.text).join("")
        : "";
  return Boolean(text.trim()) && !/^\s*<(command-|local-command-)/.test(text);
}

async function main() {
  const replies = new Map();
  const prompts = [];
  const toolUses = new Map();
  const failures = new Set();
  const sessions = [];
  const subagents = [];
  let version = "";
  let versionTime = 0;
  for (const file of files(process.argv[2])) {
    const subagent = file.split(path.sep).includes("subagents");
    // A session counts in every period where it was active.
    let last = 0;
    let session = "";
    const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.includes('"type":"assistant"') && !line.includes('"type":"user"')) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch (_error) {
        continue;
      }
      const time = Date.parse(record.timestamp);
      if (!Number.isFinite(time)) continue;
      last = Math.max(last, time);
      session ||= record.sessionId || "";
      if (record.version && time > versionTime) {
        version = String(record.version);
        versionTime = time;
      }
      const content = Array.isArray(record.message?.content) ? record.message.content : [];
      if (record.type === "assistant") {
        const id = record.message?.id;
        const model = record.message?.model;
        if (id && model && !model.startsWith("<")) {
          replies.set(id, { time, model, usage: record.message.usage || {} });
        }
        for (const block of content) {
          if (block?.type === "tool_use" && block.id) toolUses.set(block.id, { time, name: String(block.name || "") });
        }
      } else {
        if (isPrompt(record)) prompts.push(time);
        for (const block of content) {
          if (block?.type === "tool_result" && block.is_error === true) failures.add(block.tool_use_id);
        }
      }
    }
    if (!last) continue;
    if (subagent) subagents.push(last);
    else sessions.push({ id: session || file, time: last });
  }

  const allDays = new Set([...replies.values()].map(reply => dayKey(reply.time)));
  let streak = 0;
  for (let day = allDays.has(dayKey(midnight)) ? midnight : midnight - DAY; allDays.has(dayKey(day)); day -= DAY) streak++;

  const periods = {};
  for (const [name, since] of Object.entries(PERIODS)) {
    const tokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
    const models = new Map();
    const activity = new Map();
    let steps = 0;
    for (const reply of replies.values()) {
      if (reply.time < since) continue;
      const usage = reply.usage;
      const thinking = Number(usage.output_tokens_details?.thinking_tokens) || 0;
      const add = {
        input: Number(usage.input_tokens) || 0,
        output: Math.max(0, (Number(usage.output_tokens) || 0) - thinking),
        reasoning: thinking,
        read: Number(usage.cache_read_input_tokens) || 0,
        write: Number(usage.cache_creation_input_tokens) || 0
      };
      const model = models.get(reply.model) || {
        model: { id: reply.model, providerID: "anthropic" },
        steps: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
      };
      for (const target of [tokens, model.tokens]) {
        target.input += add.input;
        target.output += add.output;
        target.reasoning += add.reasoning;
        target.cache.read += add.read;
        target.cache.write += add.write;
      }
      model.steps++;
      models.set(reply.model, model);
      steps++;
      const day = dayKey(reply.time);
      activity.set(day, (activity.get(day) || 0) + 1);
    }
    const tools = new Map();
    for (const [id, use] of toolUses) {
      if (use.time < since || !use.name) continue;
      const tool = tools.get(use.name) || { name: use.name, calls: 0, failed: 0 };
      tool.calls++;
      if (failures.has(id)) tool.failed++;
      tools.set(use.name, tool);
    }
    periods[name] = {
      sessions: new Set(sessions.filter(item => item.time >= since).map(item => item.id)).size,
      subagents: subagents.filter(time => time >= since).length,
      prompts: prompts.filter(time => time >= since).length,
      steps,
      cost: 0,
      tokens,
      activeDays: activity.size,
      streak,
      activity: [...activity].sort().map(([date, count]) => ({ date, steps: count })),
      models: [...models.values()],
      tools: { usage: [...tools.values()].sort((a, b) => b.calls - a.calls) }
    };
  }
  process.stdout.write(
    JSON.stringify({
      updatedAt: Math.floor(now.getTime() / 1000),
      version: (version.match(/[0-9][0-9A-Za-z.+-]*/) || [""])[0].slice(0, 40),
      periods
    })
  );
}
main().catch(error => {
  process.stderr.write("claude-stats.sh: " + error.message + "\n");
  process.exit(1);
});
EOF

if [ -n "$HOST_FILE" ]; then
  mkdir -p "$(dirname "$HOST_FILE")"
  OUT_TMP="${HOST_FILE}.tmp"
  cp "$TMP" "$OUT_TMP"
  chmod 600 "$OUT_TMP"
  if [ "$(id -u)" = "0" ]; then chown 1000:1000 "$OUT_TMP" 2>/dev/null || true; fi
  mv -f "$OUT_TMP" "$HOST_FILE"
  echo "claude-stats.sh: report written to $HOST_FILE" >&2
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "claude-stats.sh: 'docker' not found. Set DASHMON_CLAUDE_REPORT to write on the host." >&2
  exit 1
fi
if ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
  echo "claude-stats.sh: container '$CONT_NAME' not found. Set DASHMON_CONTAINER." >&2
  exit 1
fi

# Atomic write: the server never meets a half-written JSON.
docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH.tmp' && mv -f '$CONT_PATH.tmp' '$CONT_PATH'" < "$TMP"
echo "claude-stats.sh: report written to $CONT_NAME:$CONT_PATH" >&2
