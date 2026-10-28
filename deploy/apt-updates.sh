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
# Intervalle entre deux passages planifies, en heures. Sert uniquement a
# annoncer le prochain passage dans Dashmon : adaptez-le si votre tache cron
# n'est pas hebdomadaire (par exemple 24 pour un passage quotidien).
INTERVAL_HOURS="${DASHMON_APT_INTERVAL_HOURS:-168}"
case "$INTERVAL_HOURS" in *[!0-9]*|"") INTERVAL_HOURS=168;; esac
[ "$INTERVAL_HOURS" -gt 0 ] 2>/dev/null || INTERVAL_HOURS=168

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
FAILED_STEP=""
EXIT_CODE=0
TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-apt-report.XXXXXX")" || exit 1
LOG="$(mktemp "${TMPDIR:-/tmp}/dashmon-apt-log.XXXXXX")" || { rm -f "$TMP"; exit 1; }
trap 'rm -f "$TMP" "$LOG"' EXIT

export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C
if apt-get update -q > "$LOG" 2>&1; then
  cat "$LOG"
  UPDATED="$(apt-get -s upgrade 2>/dev/null | sed -n 's/^Inst .*/1/p' | wc -l | tr -d ' ')"
  case "$UPDATED" in *[!0-9]*|"") UPDATED=0;; esac
  if apt-get -y upgrade > "$LOG" 2>&1; then
    cat "$LOG"
  else
    EXIT_CODE=$?
    cat "$LOG" >&2
    STATUS="failed"
    FAILED_STEP="upgrade"
  fi
else
  EXIT_CODE=$?
  cat "$LOG" >&2
  STATUS="failed"
  FAILED_STEP="update"
fi

if [ -f /var/run/reboot-required ]; then REBOOT_REQUIRED=true; fi
if [ "$STATUS" = "success" ] && [ "$REBOOT_REQUIRED" = true ] && [ "$AUTO_REBOOT" = "1" ]; then
  REBOOT_REQUESTED=true
fi

FINISHED="$(date +%s)"
NEXT_RUN=$((FINISHED + INTERVAL_HOURS * 3600))
{
  printf '{"status":"%s","updated":%s,"finishedAt":%s,"nextRunAt":%s,"rebootRequired":%s,"rebootRequested":%s' \
    "$STATUS" "$UPDATED" "$FINISHED" "$NEXT_RUN" "$REBOOT_REQUIRED" "$REBOOT_REQUESTED"
  if [ "$STATUS" = "failed" ]; then
    printf ',"failedStep":"%s","exitCode":%s,"error":"' "$FAILED_STEP" "$EXIT_CODE"
    # L'extrait peut contenir des URL de depots avec identifiants : on les
    # masque avant stockage et on borne sa taille. La sortie complete reste
    # uniquement sur stdout/stderr pour les administrateurs de l'hote.
    tail -c 4000 "$LOG" | tail -n 20 | tr -cd '\12\40-\176' \
      | sed -E 's#https?://[^[:space:]]+#[source]#g; s/\\/\\\\/g; s/"/\\"/g' \
      | awk 'NR>1 {printf "\\n"} {printf "%s", $0}'
    printf '"'
  fi
  printf '}\n'
} > "$TMP"

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
