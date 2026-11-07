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
[ "$#" -ge 1 ] && [ "$#" -le 50 ] || { echo "Provide 1 to 50 absolute directory paths" >&2; exit 1; }
for tool in du timeout awk mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
if [ -n "$output" ]; then
  case "$output" in /*) ;; *) output="$(pwd)/$output" ;; esac
  temporary=$(mktemp "${output}.XXXXXX")
else
  temporary=$(mktemp "${TMPDIR:-/tmp}/dashmon-directories.XXXXXX")
fi
trap 'rm -f "$temporary"' EXIT
printf '{"updatedAt":%s,"directories":[' "$(date +%s)" > "$temporary"
separator=
for directory do
  bytes=null
  error=invalid_directory
  case "$directory" in
    /*)
      if [ -d "$directory" ]; then
        error=measurement_failed
        if result=$(timeout 300 du -s -B1 -- "$directory" 2>/dev/null); then
          size=$(printf '%s\n' "$result" | awk 'NR == 1 {print $1}')
          case "$size" in ''|*[!0-9]*) ;; *) bytes=$size; error= ;; esac
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
  printf ',"bytes":%s,"error":"%s"}' "$bytes" "$error" >> "$temporary"
  separator=,
done
printf ']}' >> "$temporary"
if [ -n "$output" ]; then
  chmod 644 "$temporary"
  mv -f "$temporary" "$output"
else
  docker exec -i "$container" sh -c 'umask 022; cat > /app/data/directory-sizes.json.tmp && mv /app/data/directory-sizes.json.tmp /app/data/directory-sizes.json' < "$temporary"
fi
