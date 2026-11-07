#!/usr/bin/env sh
# opencode-stats.sh
# Collects the OpenCode usage statistics (models, tokens, cost, tools,
# activity) and writes them for Dashmon. Installation guide: docs/OPENCODE.md.
#
# Run it as the user who works with OpenCode: the statistics live in their
# home directory. Prompts and code never leave the host, only counters.
#
# Usage : opencode-stats.sh [container] [path-in-container]
set -eu

# Version of this script, written into its report: Dashmon flags a report
# made by an older script (docs/SCRIPTS.md). Raise it on every change.
SCRIPT_VERSION=1

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_OPENCODE_CONTAINER_PATH:-/app/data/opencode.json}"
HOST_FILE="${DASHMON_OPENCODE_REPORT:-}"
OPENCODE="${OPENCODE_BIN:-}"

case "${1:-}" in
  "" ) ;;
  /* | .* ) HOST_FILE="$1" ;;
  * )
    CONT_NAME="$1"
    if [ "$#" -ge 2 ]; then CONT_PATH="$2"; fi
    ;;
esac

# cron starts with a minimal PATH: the default install folder is tried too.
if [ -z "$OPENCODE" ]; then
  if command -v opencode >/dev/null 2>&1; then
    OPENCODE="$(command -v opencode)"
  elif [ -x "${HOME:-}/.opencode/bin/opencode" ]; then
    OPENCODE="$HOME/.opencode/bin/opencode"
  else
    echo "opencode-stats.sh: 'opencode' not found. Set OPENCODE_BIN." >&2
    exit 1
  fi
fi

TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-opencode.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

# One JSON object per period; anything else (error text) stops the run.
stats() {
  OUT="$("$OPENCODE" stats --json --full --limit 30 "$@" 2>/dev/null || true)"
  case "$OUT" in
    \{*\} ) printf '%s' "$OUT" ;;
    * )
      echo "opencode-stats.sh: 'opencode stats $*' returned no JSON." >&2
      exit 1
      ;;
  esac
}
TODAY="$(stats --days 0)"
WEEK="$(stats --days 7)"
MONTH="$(stats --days 30)"
ALL="$(stats --all)"
VERSION="$("$OPENCODE" --version 2>/dev/null | grep -o '[0-9][0-9A-Za-z.+-]*' | head -n 1 | cut -c1-40 || true)"

printf '{"scriptVersion":%s,"updatedAt":%s,"version":"%s","periods":{"today":%s,"week":%s,"month":%s,"all":%s}}' \
  "$SCRIPT_VERSION" "$(date +%s)" "$VERSION" "$TODAY" "$WEEK" "$MONTH" "$ALL" > "$TMP"

if [ -n "$HOST_FILE" ]; then
  mkdir -p "$(dirname "$HOST_FILE")"
  OUT_TMP="${HOST_FILE}.tmp"
  cp "$TMP" "$OUT_TMP"
  chmod 600 "$OUT_TMP"
  if [ "$(id -u)" = "0" ]; then chown 1000:1000 "$OUT_TMP" 2>/dev/null || true; fi
  mv -f "$OUT_TMP" "$HOST_FILE"
  echo "opencode-stats.sh: report written to $HOST_FILE" >&2
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "opencode-stats.sh: 'docker' not found. Set DASHMON_OPENCODE_REPORT to write on the host." >&2
  exit 1
fi
if ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
  echo "opencode-stats.sh: container '$CONT_NAME' not found." >&2
  exit 1
fi

# Atomic write: the server never meets a half-written JSON.
docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH.tmp' && mv -f '$CONT_PATH.tmp' '$CONT_PATH'" < "$TMP"
echo "opencode-stats.sh: report written to $CONT_NAME:$CONT_PATH" >&2
