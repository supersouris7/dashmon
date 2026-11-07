#!/bin/sh
# Selected host directories -> atomic Dashmon report (local or agent).
set -eu
container=dashmon
output=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --container|--output)
      [ "$#" -ge 2 ] || { echo "Missing option value" >&2; exit 1; }
      if [ "$1" = --container ]; then container=$2; else output=$2; fi
      shift 2 ;;
    --) shift; break ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) break ;;
  esac
done
[ "$#" -le 50 ] || { echo "Provide at most 50 absolute directory paths" >&2; exit 1; }
for tool in du timeout awk mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
if [ -n "$output" ]; then
  case "$output" in /*) ;; *) output="$(pwd)/$output" ;; esac
  temporary=$(mktemp "${output}.XXXXXX")
else
  temporary=$(mktemp "${TMPDIR:-/tmp}/dashmon-directories.XXXXXX")
fi
paths=$(mktemp "${TMPDIR:-/tmp}/dashmon-directory-paths.XXXXXX")
trap 'rm -f "$temporary" "$paths"' EXIT
if [ "$#" -gt 0 ]; then
  printf '%s\n' "$@" > "$paths"
else
  # Use the Node runtime already shipped inside Dashmon, not on the host.
  docker exec "$container" node -e '
    const fs = require("fs");
    const path = require("path");
    const config = JSON.parse(fs.readFileSync(process.env.CONFIG_FILE || path.join(process.env.DATA_DIR || "/app/data", "config.json"), "utf8"));
    const host = (config.hosts || []).find(h => h.monitoring?.enabled && h.monitoring.type === "local");
    const prefs = host?.monitoring.directorySizes;
    if (prefs?.enabled !== false) for (const entry of (prefs?.entries || []).slice(0, 50)) {
      if (typeof entry.path === "string" && entry.path.startsWith("/") && entry.path.length <= 4096 && !/[\x00-\x1f\x7f]/.test(entry.path)) console.log(entry.path);
    }
  ' > "$paths"
fi
printf '{"updatedAt":%s,"directories":[' "$(date +%s)" > "$temporary"
separator=
while IFS= read -r directory; do
  bytes=null
  capacity=null
  error=invalid_directory
  case "$directory" in
    /*)
      if [ -d "$directory" ]; then
        error=measurement_failed
        if result=$(timeout 300 du -s -B1 -- "$directory" 2>/dev/null); then
          size=$(printf '%s\n' "$result" | awk 'NR == 1 {print $1}')
          case "$size" in ''|*[!0-9]*) ;; *) bytes=$size; error= ;; esac
        fi
        if disk=$(timeout 10 df -P -B1 -- "$directory" 2>/dev/null); then
          total=$(printf '%s\n' "$disk" | awk 'NR == 2 {print $2}')
          case "$total" in ''|*[!0-9]*|0) ;; *) capacity=$total ;; esac
        fi
      fi ;;
  esac
  printf '%s{"path":' "$separator" >> "$temporary"
  DASHMON_DIRECTORY="$directory" awk 'BEGIN {
    s = ENVIRON["DASHMON_DIRECTORY"]; printf "\"";
    for (i = 1; i <= length(s); i++) {
      c = substr(s, i, 1);
      if (c == "\\" || c == "\"") printf "\\%s", c;
      else {
        escaped = 0;
        for (n = 1; n < 32; n++) if (c == sprintf("%c", n)) {
          printf "\\u%04x", n; escaped = 1; break;
        }
        if (!escaped) printf "%s", c;
      }
    }
    printf "\"";
  }' >> "$temporary"
  printf ',"bytes":%s,"capacity":%s,"error":"%s"}' "$bytes" "$capacity" "$error" >> "$temporary"
  separator=,
done < "$paths"
printf ']}' >> "$temporary"
if [ -n "$output" ]; then
  chmod 644 "$temporary"
  mv -f "$temporary" "$output"
else
  docker exec -i "$container" sh -c 'umask 022; cat > /app/data/directory-sizes.json.tmp && mv /app/data/directory-sizes.json.tmp /app/data/directory-sizes.json' < "$temporary"
fi
