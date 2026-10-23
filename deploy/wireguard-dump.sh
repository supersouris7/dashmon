#!/usr/bin/env sh
# wireguard-dump.sh
#
# Ecrit la sortie de `wg show all dump` la ou Dashmon la lit : dans le
# repertoire de donnees du conteneur (par defaut /app/data/wireguard.dump).
# Alimente la supervision WireGuard d'un hote "local" et la tuile wireguard.
#
# Guide d'installation et cron : docs/WIREGUARD.md
#
# Usage :
#   wireguard-dump.sh [conteneur] [chemin-dans-le-conteneur]
#
# Par defaut, ecrit dans le conteneur "dashmon" (ou $DASHMON_CONTAINER) a
# /app/data/wireguard.dump (ou $DASHMON_DUMP_CONTAINER_PATH). Le dump passe par
# un pipe : rien n'est ecrit sur l'hote.
#
#   wireguard-dump.sh                       # dashmon -> /app/data/wireguard.dump
#   wireguard-dump.sh dashmon-prod          # autre nom de conteneur
#   wireguard-dump.sh dashmon /data/wg.dump # autre chemin dans le conteneur
#
# Variante "fichier hote" (bind mount) : si le 1er argument est un chemin
# (commence par / ou .), le dump est ecrit dans ce fichier de l'hote. Le dossier
# doit alors etre monte dans le conteneur et WIREGUARD_DUMP_FILE doit pointer
# dessus. $DASHMON_WIREGUARD_DUMP fait la meme chose sans argument.
#
#   wireguard-dump.sh /opt/dashmon/wireguard.dump
#
# A executer en root (ou avec sudo) : `wg` a besoin de CAP_NET_ADMIN, et
# `docker` doit pouvoir joindre le demon.
set -eu

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_DUMP_CONTAINER_PATH:-/app/data/wireguard.dump}"
HOST_FILE="${DASHMON_WIREGUARD_DUMP:-}"

case "${1:-}" in
  "" )
    ;;
  /* | .* )
    # 1er argument = chemin de fichier sur l'hote.
    HOST_FILE="$1"
    ;;
  * )
    CONT_NAME="$1"
    if [ "$#" -ge 2 ]; then
      CONT_PATH="$2"
    fi
    ;;
esac

if ! command -v wg >/dev/null 2>&1; then
  echo "wireguard-dump.sh: 'wg' introuvable. Installez wireguard-tools." >&2
  exit 1
fi

if [ -n "$HOST_FILE" ]; then
  # --- Ecriture dans un fichier de l'hote (bind mount) ---------------------
  OUT="$HOST_FILE"
  TMP="${OUT}.tmp"
  mkdir -p "$(dirname "$OUT")"

  # Ecriture atomique : Dashmon ne lit jamais un fichier a moitie ecrit.
  wg show all dump > "$TMP"

  # Le dump contient la cle privee de l'interface : permissions restrictives.
  chmod 600 "$TMP"

  # Dashmon tourne avec l'UID 1000 dans l'image. Sur un bind mount, le fichier
  # doit appartenir a cet utilisateur pour etre lisible.
  if [ "$(id -u)" = "0" ]; then
    chown 1000:1000 "$TMP" 2>/dev/null || true
  fi

  mv -f "$TMP" "$OUT"
  echo "wireguard-dump.sh: dump ecrit dans $OUT" >&2
  exit 0
fi

# --- Ecriture dans le conteneur (chemin par defaut) ------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "wireguard-dump.sh: 'docker' introuvable. Passez un chemin de fichier en argument pour ecrire sur l'hote, ou installez Docker." >&2
  exit 1
fi

if ! docker inspect "$CONT_NAME" >/dev/null 2>&1; then
  echo "wireguard-dump.sh: conteneur '$CONT_NAME' introuvable." >&2
  exit 1
fi

# Le dump traverse un pipe : aucune copie intermediaire sur l'hote.
wg show all dump | docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH'"

echo "wireguard-dump.sh: dump ecrit dans $CONT_NAME:$CONT_PATH" >&2
