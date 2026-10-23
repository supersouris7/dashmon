#!/usr/bin/env sh
# wireguard-dump.sh
#
# Ecrit la sortie de `wg show all dump` dans un fichier lu par Dashmon pour la
# supervision WireGuard d'un hote de type "local".
#
# Guide d'installation et cron : docs/WIREGUARD.md
#
# Usage :
#   wireguard-dump.sh [chemin-de-sortie]
#
# Sans argument, ecrit dans $DASHMON_WIREGUARD_DUMP, sinon
# /opt/dashmon/wireguard.dump.
#
# A executer en root (ou avec sudo) : `wg` a besoin de CAP_NET_ADMIN.
set -eu

OUT="${1:-${DASHMON_WIREGUARD_DUMP:-/opt/dashmon/wireguard.dump}}"
TMP="${OUT}.tmp"

if ! command -v wg >/dev/null 2>&1; then
  echo "wireguard-dump.sh: 'wg' introuvable. Installez wireguard-tools." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

# Ecriture atomique : Dashmon ne lit jamais un fichier a moitie ecrit.
wg show all dump > "$TMP"

# Le dump contient la cle privee de l'interface : permissions restrictives.
chmod 600 "$TMP"

# Dashmon tourne avec l'UID 1000 dans l'image. Sur un bind mount, le fichier
# doit appartenir a cet utilisateur pour etre lisible ; sinon (volume nomme,
# lecture via `docker cp`), ce chown est inutile et sans effet.
if [ "$(id -u)" = "0" ]; then
  chown 1000:1000 "$TMP" 2>/dev/null || true
fi

mv -f "$TMP" "$OUT"
