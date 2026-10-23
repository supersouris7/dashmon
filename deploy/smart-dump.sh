#!/usr/bin/env sh
# smart-dump.sh
# Releve les informations SMART locales et les ecrit pour Dashmon.
# Guide d'installation : docs/SMART.md.
#
# Usage : smart-dump.sh [conteneur] [chemin-dans-le-conteneur]
# DASHMON_SMART_DEVICES contient une liste d'appareils separes par des espaces.
set -eu

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_SMART_CONTAINER_PATH:-/app/data/smart.json}"
HOST_FILE="${DASHMON_SMART_DUMP:-}"
DEVICES="${DASHMON_SMART_DEVICES:-}"

case "${1:-}" in
  "" ) ;;
  /* | .* ) HOST_FILE="$1" ;;
  * )
    CONT_NAME="$1"
    if [ "$#" -ge 2 ]; then CONT_PATH="$2"; fi
    ;;
esac

if ! command -v smartctl >/dev/null 2>&1; then
  echo "smart-dump.sh: 'smartctl' introuvable. Installez smartmontools." >&2
  exit 1
fi

if [ -z "$DEVICES" ]; then
  DEVICES="$(smartctl --scan-open 2>/dev/null | sed -n 's|^\([^[:space:]#]*\).*|\1|p')"
fi
if [ -z "$DEVICES" ]; then
  echo "smart-dump.sh: aucun disque SMART detecte." >&2
  exit 1
fi

TMP="$(mktemp "${TMPDIR:-/tmp}/dashmon-smart.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

# -q noserial evite que les numeros de serie quittent l'hote. smartctl renvoie
# aussi un code non nul pour certains etats SMART : un JSON produit reste utile.
printf '{"updatedAt":%s,"disks":[' "$(date +%s)" > "$TMP"
FIRST=1
for DEVICE in $DEVICES; do
  JSON="$(smartctl -j -q noserial -a "$DEVICE" 2>/dev/null || true)"
  case "$JSON" in
    \{*\} )
      if [ "$FIRST" -eq 0 ]; then printf ',' >> "$TMP"; fi
      printf '%s' "$JSON" >> "$TMP"
      FIRST=0
      ;;
  esac
done
printf ']}' >> "$TMP"

if [ "$FIRST" -eq 1 ]; then
  echo "smart-dump.sh: aucun relevé SMART JSON exploitable." >&2
  exit 1
fi

if [ -n "$HOST_FILE" ]; then
  mkdir -p "$(dirname "$HOST_FILE")"
  OUT_TMP="${HOST_FILE}.tmp"
  cp "$TMP" "$OUT_TMP"
  chmod 600 "$OUT_TMP"
  if [ "$(id -u)" = "0" ]; then chown 1000:1000 "$OUT_TMP" 2>/dev/null || true; fi
  mv -f "$OUT_TMP" "$HOST_FILE"
  echo "smart-dump.sh: releve ecrit dans $HOST_FILE" >&2
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "smart-dump.sh: 'docker' introuvable. Passez DASHMON_SMART_DUMP pour ecrire sur l'hote." >&2
  exit 1
fi
if ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
  echo "smart-dump.sh: conteneur '$CONT_NAME' introuvable." >&2
  exit 1
fi

# Ecriture atomique : le serveur ne rencontre jamais un JSON incomplet.
docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH.tmp' && mv -f '$CONT_PATH.tmp' '$CONT_PATH'" < "$TMP"
echo "smart-dump.sh: releve ecrit dans $CONT_NAME:$CONT_PATH" >&2
