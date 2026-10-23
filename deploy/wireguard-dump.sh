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
# Noms parlants : un fichier $DASHMON_WIREGUARD_NAMES (defaut
# /etc/dashmon/wireguard-names.conf s'il existe) remplace la cle publique d'un
# pair par un nom lisible. Format, une ligne par pair : la cle publique, puis le
# nom (espaces autorises dans le nom) :
#
#   <cle-publique> <nom>
#
# La cle publique est copiee telle quelle depuis `wg show all`. Les lignes vides
# et celles commencant par # sont ignorees.
#
# Securite : le dump brut contient la cle privee de chaque interface et la cle
# pre-partagee de chaque pair. Aucune des deux n'est utile a Dashmon : le script
# les remplace par « (redacted) » avant d'ecrire le fichier, en conservant le
# nombre de champs tabules (le serveur distingue une ligne d'interface a 5
# champs d'une ligne de pair a 9).
#
# A executer en root (ou avec sudo) : `wg` a besoin de CAP_NET_ADMIN, et
# `docker` doit pouvoir joindre le demon.
set -eu

CONT_NAME="${DASHMON_CONTAINER:-dashmon}"
CONT_PATH="${DASHMON_DUMP_CONTAINER_PATH:-/app/data/wireguard.dump}"
HOST_FILE="${DASHMON_WIREGUARD_DUMP:-}"
NAMES_FILE="${DASHMON_WIREGUARD_NAMES:-/etc/dashmon/wireguard-names.conf}"

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

# Le fichier de noms est optionnel : absent, on garde les cles publiques.
[ -f "$NAMES_FILE" ] || NAMES_FILE=""

# Filtre le dump : masque la cle privee (interface) et la cle pre-partagee
# (pair), et remplace la cle publique d'un pair connu par son nom lisible.
dump_filtered() {
  wg show all dump | awk -v namesfile="$NAMES_FILE" '
    BEGIN {
      FS = "\t"; OFS = "\t"
      if (namesfile != "") {
        while ((getline line < namesfile) > 0) {
          sub(/\r$/, "", line)
          if (line == "" || line ~ /^[ \t]*#/) continue
          # Champ 1 = cle publique, le reste = nom (la cle base64 na pas despaces).
          n = split(line, parts, /[ \t]+/)
          if (n < 2) continue
          key = parts[1]
          name = parts[2]
          for (i = 3; i <= n; i++) name = name " " parts[i]
          if (key != "" && name != "") mapping[key] = name
        }
        close(namesfile)
      }
    }
    {
      if (NF >= 9) {
        # Ligne de pair : $2 = cle publique, $3 = cle pre-partagee.
        if ($2 in mapping) $2 = mapping[$2]
        $3 = "(redacted)"
      } else if (NF == 5) {
        # Ligne interface : $2 = cle privee.
        $2 = "(redacted)"
      }
      print
    }
  '
}

if [ -n "$HOST_FILE" ]; then
  # --- Ecriture dans un fichier de l'hote (bind mount) ---------------------
  OUT="$HOST_FILE"
  TMP="${OUT}.tmp"
  mkdir -p "$(dirname "$OUT")"

  # Ecriture atomique : Dashmon ne lit jamais un fichier a moitie ecrit.
  dump_filtered > "$TMP"

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
dump_filtered | docker exec -i "$CONT_NAME" sh -c "cat > '$CONT_PATH'"

echo "wireguard-dump.sh: dump ecrit dans $CONT_NAME:$CONT_PATH" >&2
