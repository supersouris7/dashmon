#!/usr/bin/env sh
# apt-updates.sh
#
# Met a jour l'hote Debian/Ubuntu et ecrit un rapport JSON pour la carte APT.
# Planifiez-le avec crontab : docs/APT_UPDATES.md.
set -u

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_APT_REPORT_CONTAINER_PATH:-/app/data/apt-updates.json}"
HOST_FILE="${DASHMON_APT_REPORT_FILE:-}"
AUTO_REBOOT="${DASHMON_APT_REBOOT:-0}"

if [ "$(id -u)" != "0" ]; then
  echo "apt-updates.sh: executez ce script en root." >&2
  exit 1
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-updates.sh: 'apt-get' introuvable (hote Debian/Ubuntu requis)." >&2
  exit 1
fi

if [ -z "$HOST_FILE" ]; then
  if ! command -v docker >/dev/null 2>&1 || ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
    echo "apt-updates.sh: conteneur Dashmon inaccessible. Definissez DASHMON_APT_REPORT_FILE pour un bind mount." >&2
    exit 1
  fi
fi

STATUS="success"
UPDATED=0
REBOOT_REQUIRED=false
REBOOT_REQUESTED=false

export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C
if ! apt-get update -q; then
  STATUS="failed"
else
  UPDATED="$(apt-get -s upgrade 2>/dev/null | sed -n 's/^Inst .*/1/p' | wc -l | tr -d ' ')"
  case "$UPDATED" in *[!0-9]*|"") UPDATED=0;; esac
  if ! apt-get -y upgrade; then STATUS="failed"; fi
fi

if [ -f /var/run/reboot-required ]; then REBOOT_REQUIRED=true; fi
if [ "$STATUS" = "success" ] && [ "$REBOOT_REQUIRED" = true ] && [ "$AUTO_REBOOT" = "1" ]; then
  REBOOT_REQUESTED=true
fi

FINISHED="$(date +%s)"
TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-apt-report.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
printf '{"status":"%s","updated":%s,"finishedAt":%s,"rebootRequired":%s,"rebootRequested":%s}\n' \
  "$STATUS" "$UPDATED" "$FINISHED" "$REBOOT_REQUIRED" "$REBOOT_REQUESTED" > "$TMP"

if [ -n "$HOST_FILE" ]; then
  if ! mkdir -p "$(dirname "$HOST_FILE")" \
    || ! cp "$TMP" "${HOST_FILE}.tmp" \
    || ! chmod 600 "${HOST_FILE}.tmp"; then
    echo "apt-updates.sh: echec de l'ecriture du rapport." >&2
    exit 1
  fi
  chown 1000:1000 "${HOST_FILE}.tmp" 2>/dev/null || true
  if ! mv -f "${HOST_FILE}.tmp" "$HOST_FILE"; then
    echo "apt-updates.sh: echec de l'ecriture du rapport." >&2
    exit 1
  fi
else
  if ! docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH.tmp' && mv -f '$CONT_PATH.tmp' '$CONT_PATH'" < "$TMP"; then
    echo "apt-updates.sh: echec de l'ecriture du rapport dans le conteneur." >&2
    exit 1
  fi
fi

echo "apt-updates.sh: rapport ecrit (${STATUS}, ${UPDATED} mise(s) a jour)." >&2
if [ "$REBOOT_REQUESTED" = true ]; then
  systemctl reboot
fi

exit 0
