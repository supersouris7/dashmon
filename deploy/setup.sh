#!/bin/sh
# dashmon-setup.sh
# Installs, updates and removes the Dashmon host scripts and their cron lines,
# on the primary and on every agent. Guide: docs/SCRIPTS.md.
#
#   sudo dashmon-setup.sh                      # menu
#   sudo dashmon-setup.sh list                 # what is installed
#   sudo dashmon-setup.sh install smart-dump   # script + cron line
#   sudo dashmon-setup.sh remove smart-dump    # cron line + script
#   sudo dashmon-setup.sh update               # every installed script
#
# install options: --frequency 1|2|3 (default: the recommended one),
# --container NAME (default: the Dashmon container found by docker ps),
# --user NAME (OpenCode and Claude Code: whose crontab), --reboot (APT),
# --run (first run now), --yes (no question).
#
# The cron lines it writes end with "# dashmon:NAME": that is how it finds
# them again. It never edits another line, except a line that runs a script
# it removes. Nothing runs in the background and nothing updates by itself.
set -eu

# Version of this script. It writes no report, so Dashmon never flags it:
# `update` refreshes it with the others. Raise it on every change.
SCRIPT_VERSION=1

RAW="${DASHMON_RAW_URL:-https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy}"
BIN="${DASHMON_BIN_DIR:-/usr/local/bin}"
COMPONENTS="apt-updates smart-dump wireguard-dump opencode-stats claude-stats directory-sizes"

case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in fr*) FR=1 ;; *) FR=0 ;; esac
# say "English" "Français"
say() { if [ "$FR" = 1 ]; then printf '%s\n' "$2"; else printf '%s\n' "$1"; fi; }
die() { say "$1" "$2" >&2; exit 1; }
interactive() { [ -t 0 ] && [ "$YES" = 0 ]; }

label() {
  case "$1" in
    apt-updates) say "APT updates" "Mises à jour APT" ;;
    smart-dump) echo "SMART" ;;
    wireguard-dump) echo "WireGuard" ;;
    opencode-stats) echo "OpenCode" ;;
    claude-stats) echo "Claude Code" ;;
    directory-sizes) say "Directories" "Répertoires" ;;
    setup) echo "dashmon-setup" ;;
  esac
}

# OpenCode and Claude Code read the home of the user who works with them;
# the others need root (apt, smartctl, wg, every directory).
user_script() { case "$1" in opencode-stats | claude-stats) return 0 ;; esac; return 1; }

# Three schedules per script, the recommended one marked. Same list in
# public/js/editor/script-help.js (checked by test/setup-script.test.js).
# Fields: cron expression | extra variables | English | French | recommended
frequencies() {
  case "$1" in
    apt-updates)
      echo "0 3 * * *|DASHMON_APT_INTERVAL_HOURS=24|every day at 03:00|tous les jours à 03:00|"
      echo "0 3 * * 3||every Wednesday at 03:00|le mercredi à 03:00|1"
      echo "0 3 1 * *|DASHMON_APT_INTERVAL_HOURS=720|the 1st of the month at 03:00|le 1er du mois à 03:00|"
      ;;
    smart-dump)
      echo "*/5 * * * *||every 5 minutes|toutes les 5 minutes|"
      echo "*/15 * * * *||every 15 minutes|toutes les 15 minutes|1"
      echo "0 * * * *||every hour|toutes les heures|"
      ;;
    wireguard-dump)
      echo "* * * * *||every minute|toutes les minutes|1"
      echo "*/5 * * * *||every 5 minutes|toutes les 5 minutes|"
      echo "*/15 * * * *||every 15 minutes|toutes les 15 minutes|"
      ;;
    opencode-stats | claude-stats)
      echo "*/5 * * * *||every 5 minutes|toutes les 5 minutes|"
      echo "*/15 * * * *||every 15 minutes|toutes les 15 minutes|1"
      echo "0 * * * *||every hour|toutes les heures|"
      ;;
    directory-sizes)
      echo "0 * * * *||every hour|toutes les heures|"
      echo "0 */6 * * *||every 6 hours|toutes les 6 heures|"
      echo "30 3 * * *||every night at 03:30|chaque nuit à 03:30|1"
      ;;
  esac
}
frequency_field() { frequencies "$1" | sed -n "${2}p" | cut -d'|' -f"$3"; }
recommended() { frequencies "$1" | awk -F'|' '$5 == "1" { print NR }'; }

known() {
  for item in $COMPONENTS; do [ "$item" = "$1" ] && return 0; done
  return 1
}
file_of() { echo "$BIN/dashmon-$1.sh"; }
version_of() { sed -n 's/^SCRIPT_VERSION=\([0-9][0-9]*\)$/\1/p' "$1" 2>/dev/null | head -n 1; }

# --- crontab -------------------------------------------------------------

cron_read() { crontab -u "$1" -l 2>/dev/null || true; }
cron_write() { crontab -u "$1" -; }
marker() { echo "# dashmon:$1"; }
# Lines that run this script: ours (marker), written by hand from a guide,
# or from before the dashmon- names (/usr/local/sbin/apt-updates.sh...).
# runs NAME [-v]: keeps the lines that run it, or with -v the others.
runs() {
  if [ "${2:-}" = -v ]; then
    grep -v -F -e "$(marker "$1")" -e "/dashmon-$1.sh" -e "bin/$1.sh" || true
  else
    grep -F -e "$(marker "$1")" -e "/dashmon-$1.sh" -e "bin/$1.sh" || true
  fi
}
cron_lines() { cron_read "$1" | runs "$2"; }
cron_drop() {
  current=$(cron_read "$1")
  printf '%s\n' "$current" | runs "$2" -v | cron_write "$1"
}

invoking_user() {
  if [ -n "$USER_OPT" ]; then echo "$USER_OPT"
  elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then echo "$SUDO_USER"
  else id -un
  fi
}
cron_owner() { if user_script "$1"; then invoking_user; else echo root; fi; }

# --- Docker --------------------------------------------------------------

# Running Dashmon containers (primary or agent), one name per line.
dashmon_containers() {
  command -v docker >/dev/null 2>&1 || return 0
  docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null \
    | awk '$2 ~ /dashmon/ { print $1 }' || true
}

choose_container() {
  if [ -n "$CONTAINER_OPT" ]; then echo "$CONTAINER_OPT"; return; fi
  found=$(dashmon_containers)
  count=$(printf '%s' "$found" | grep -c . || true)
  if [ "$count" = 1 ]; then echo "$found"; return; fi
  if [ "$count" -gt 1 ] && interactive; then
    say "Dashmon containers on this machine:" "Conteneurs Dashmon sur cette machine :" >&2
    printf '%s\n' "$found" | awk '{ printf "  %d) %s\n", NR, $1 }' >&2
    printf '%s' "> " >&2
    read -r pick
    chosen=$(printf '%s\n' "$found" | sed -n "${pick:-1}p")
    [ -n "$chosen" ] && { echo "$chosen"; return; }
  fi
  [ "$count" -gt 1 ] && say "Several Dashmon containers: pass --container NAME." \
    "Plusieurs conteneurs Dashmon : passez --container NOM." >&2
  echo dashmon
}

# --- download ------------------------------------------------------------

# Downloads deploy/NAME.sh next to its target, then renames it: a run in
# progress keeps reading the old file, and a cut download changes nothing.
fetch() {
  target=$(file_of "$1")
  temporary="$target.new"
  if ! curl -fsSL "$RAW/$1.sh" -o "$temporary"; then
    rm -f "$temporary"
    die "Download failed: $RAW/$1.sh" "Échec du téléchargement : $RAW/$1.sh"
  fi
  if ! head -n 1 "$temporary" | grep -q '^#!' || [ -z "$(version_of "$temporary")" ]; then
    rm -f "$temporary"
    die "Unexpected content: $RAW/$1.sh" "Contenu inattendu : $RAW/$1.sh"
  fi
  chmod 755 "$temporary"
  mv "$temporary" "$target"
}

# --- commands ------------------------------------------------------------

list() {
  say "Dashmon host scripts in $BIN:" "Scripts Dashmon de l'hôte dans $BIN :"
  for name in $COMPONENTS; do
    file=$(file_of "$name")
    owner=$(cron_owner "$name")
    if [ -f "$file" ]; then
      state="v$(version_of "$file")"
    else
      state=$(say "not installed" "non installé")
    fi
    printf '  %-16s %-16s %s\n' "$name" "$(label "$name")" "$state"
    cron_lines "$owner" "$name" | sed "s/^/      cron ($owner): /"
  done
  if [ -f "$(file_of setup)" ]; then
    printf '  %-16s %-16s v%s\n' setup dashmon-setup "$(version_of "$(file_of setup)")"
  fi
}

ask_frequency() {
  best=$(recommended "$1")
  if [ -n "$FREQUENCY_OPT" ]; then
    case "$FREQUENCY_OPT" in 1 | 2 | 3) echo "$FREQUENCY_OPT"; return ;; esac
    die "--frequency takes 1, 2 or 3." "--frequency prend 1, 2 ou 3."
  fi
  if ! interactive; then echo "$best"; return; fi
  say "How often?" "À quelle fréquence ?" >&2
  for index in 1 2 3; do
    text=$(if [ "$FR" = 1 ]; then frequency_field "$1" "$index" 4; else frequency_field "$1" "$index" 3; fi)
    mark=""
    [ "$index" = "$best" ] && mark=$(say " (recommended)" " (conseillé)")
    printf '  %d) %s%s   [%s]\n' "$index" "$text" "$mark" "$(frequency_field "$1" "$index" 1)" >&2
  done
  printf '> [%s] ' "$best" >&2
  read -r pick
  case "$pick" in 1 | 2 | 3) echo "$pick" ;; *) echo "$best" ;; esac
}

confirm() { # confirm "English" "Français" default(y|n)
  if ! interactive; then [ "$3" = y ]; return; fi
  if [ "$3" = y ]; then hint="[O/n]"; [ "$FR" = 1 ] || hint="[Y/n]"
  else hint="[o/N]"; [ "$FR" = 1 ] || hint="[y/N]"
  fi
  printf '%s %s ' "$(say "$1" "$2")" "$hint"
  read -r answer
  case "$answer" in "") [ "$3" = y ] ;; [yYoO]*) return 0 ;; *) return 1 ;; esac
}

check_tools() {
  case "$1" in
    apt-updates) need=apt-get ;;
    smart-dump) need=smartctl ;;
    wireguard-dump) need=wg ;;
    directory-sizes) need=du ;;
    *) need=docker ;;
  esac
  if ! command -v "$need" >/dev/null 2>&1; then
    say "Warning: '$need' is missing on this machine; the script will fail until it is installed." \
      "Attention : '$need' manque sur cette machine ; le script échouera tant qu'il n'est pas installé." >&2
    [ "$need" = smartctl ] && say "  sudo apt install smartmontools" "  sudo apt install smartmontools" >&2
  fi
  return 0
}

install_one() {
  name=$1
  known "$name" || die "Unknown script: $name (see: list)" "Script inconnu : $name (voir : list)"
  check_tools "$name"
  owner=$(cron_owner "$name")
  if user_script "$name" && [ "$owner" = root ]; then
    say "Warning: $(label "$name") runs as root; pass --user YOUR_USER for your own statistics." \
      "Attention : $(label "$name") tournera en root ; passez --user VOTRE_UTILISATEUR pour vos statistiques." >&2
  fi
  container=$(choose_container)
  index=$(ask_frequency "$name")
  schedule=$(frequency_field "$name" "$index" 1)
  extra=$(frequency_field "$name" "$index" 2)
  if [ "$name" = apt-updates ]; then
    if [ "$REBOOT_OPT" = 1 ] || confirm "Reboot automatically when an update requires it?" \
      "Redémarrer automatiquement quand une mise à jour l'exige ?" n; then
      extra="${extra:+$extra }DASHMON_APT_REBOOT=1"
    fi
  fi

  existing=$(cron_lines "$owner" "$name" | grep -v -F "$(marker "$name")" || true)
  if [ -n "$existing" ]; then
    say "A cron line written by hand already runs this script ($owner):" \
      "Une ligne cron écrite à la main lance déjà ce script ($owner) :"
    printf '  %s\n' "$existing"
    if ! confirm "Replace it?" "La remplacer ?" n && [ "$YES" = 0 ]; then
      fetch "$name"
      say "Script installed, cron line kept." "Script installé, ligne cron conservée."
      return
    fi
  fi

  fetch "$name"
  file=$(file_of "$name")
  if [ "$name" = directory-sizes ]; then
    command="$extra${extra:+ }sh $file --container $container"
  else
    command="${extra:+$extra }DASHMON_CONTAINER=$container $file"
  fi
  line="$schedule $command >/dev/null 2>&1 $(marker "$name")"
  current=$(cron_read "$owner" | runs "$name" -v)
  {
    [ -n "$current" ] && printf '%s\n' "$current"
    printf '%s\n' "$line"
  } | cron_write "$owner"
  # A copy from before the dashmon- names, run only by a replaced line.
  for former in $(printf '%s\n' "$existing" | tr ' ' '\n' | grep "bin/$name.sh\$" || true); do
    if [ -f "$former" ] && [ -z "$(cron_read "$owner" | grep -F "$former" || true)" ]; then
      rm -f "$former" && say "Former copy removed: $former" "Ancienne copie supprimée : $former"
    fi
  done
  say "Installed: $(label "$name") v$(version_of "$file"), cron of $owner:" \
    "Installé : $(label "$name") v$(version_of "$file"), cron de $owner :"
  printf '  %s\n' "$line"

  if [ "$name" = apt-updates ]; then
    say "APT really installs the updates: it first runs at the time above." \
      "APT installe vraiment les mises à jour : premier passage à l'heure ci-dessus."
    return
  fi
  if [ "$RUN_OPT" = 1 ] || { interactive && confirm "Run it once now, so the card appears?" \
    "Le lancer une fois maintenant, pour faire apparaître la carte ?" y; }; then
    run_now "$owner" "$command"
  fi
}

run_now() {
  if [ "$1" = root ] || [ "$(id -un)" = "$1" ]; then
    sh -c "$2" || say "The first run failed: see the message above." "Le premier passage a échoué : voir le message ci-dessus."
  elif command -v sudo >/dev/null 2>&1; then
    sudo -u "$1" -H sh -c "$2" || say "The first run failed: see the message above." "Le premier passage a échoué : voir le message ci-dessus."
  else
    say "Run it as $1: $2" "Lancez-le en tant que $1 : $2"
  fi
}

remove_one() {
  name=$1
  known "$name" || die "Unknown script: $name (see: list)" "Script inconnu : $name (voir : list)"
  owner=$(cron_owner "$name")
  for who in $(printf '%s\n%s\n' "$owner" root | sort -u); do
    if [ -n "$(cron_lines "$who" "$name")" ]; then
      cron_drop "$who" "$name"
      say "Cron line removed ($who)." "Ligne cron retirée ($who)."
    fi
  done
  rm -f "$(file_of "$name")"
  say "Removed: $(label "$name")." "Retiré : $(label "$name")."
  say "Its report stays in the container: the card shows the last one, then disappears with it." \
    "Son rapport reste dans le conteneur : la carte affiche le dernier relevé."
}

update_all() {
  updated=0
  for name in setup $COMPONENTS; do
    file=$(file_of "$name")
    [ -f "$file" ] || continue
    before=$(version_of "$file")
    fetch "$name"
    after=$(version_of "$file")
    if [ "$before" = "$after" ]; then
      say "  $(label "$name"): v$after, up to date" "  $(label "$name") : v$after, à jour"
    else
      say "  $(label "$name"): v${before:-?} -> v$after" "  $(label "$name") : v${before:-?} -> v$after"
    fi
    updated=$((updated + 1))
  done
  [ "$updated" -gt 0 ] || say "No Dashmon script installed in $BIN." "Aucun script Dashmon installé dans $BIN."
  say "The cron lines do not change." "Les lignes cron ne changent pas."
}

menu() {
  while :; do
    echo
    list
    echo
    say "  1-6) install, change or remove a script   u) update all   q) quit" \
      "  1-6) installer, modifier ou retirer un script   u) tout mettre à jour   q) quitter"
    printf '> '
    read -r pick || return 0
    case "$pick" in
      q | Q | "") return 0 ;;
      u | U) update_all ;;
      [1-6])
        name=$(echo "$COMPONENTS" | tr ' ' '\n' | sed -n "${pick}p")
        if [ -f "$(file_of "$name")" ]; then
          say "$(label "$name"): 1) change the frequency   2) remove   (other) back" \
            "$(label "$name") : 1) changer la fréquence   2) retirer   (autre) retour"
          printf '> '
          read -r action
          case "$action" in
            1) install_one "$name" ;;
            2) confirm "Remove $(label "$name") and its cron line?" \
              "Retirer $(label "$name") et sa ligne cron ?" n && remove_one "$name" ;;
          esac
        else
          install_one "$name"
        fi
        ;;
      *) say "Unknown choice." "Choix inconnu." ;;
    esac
  done
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  echo
  say "Scripts: $COMPONENTS" "Scripts : $COMPONENTS"
}

# --- arguments -----------------------------------------------------------

FREQUENCY_OPT=""
CONTAINER_OPT=""
USER_OPT=""
REBOOT_OPT=0
RUN_OPT=0
YES=0
ACTION=""
NAMES=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --frequency | --container | --user)
      [ "$#" -ge 2 ] || die "Missing value for $1" "Valeur manquante pour $1"
      case "$1" in
        --frequency) FREQUENCY_OPT=$2 ;;
        --container) CONTAINER_OPT=$2 ;;
        --user) USER_OPT=$2 ;;
      esac
      shift 2
      continue
      ;;
    --reboot) REBOOT_OPT=1 ;;
    --run) RUN_OPT=1 ;;
    --yes | -y) YES=1 ;;
    -h | --help | help) usage; exit 0 ;;
    -*) die "Unknown option: $1" "Option inconnue : $1" ;;
    *) if [ -z "$ACTION" ]; then ACTION=$1; else NAMES="$NAMES $1"; fi ;;
  esac
  shift
done
case "$CONTAINER_OPT$USER_OPT" in *[!A-Za-z0-9_.-]*)
  die "Container and user names: letters, digits, . _ - only." \
    "Noms de conteneur et d'utilisateur : lettres, chiffres, . _ - uniquement." ;;
esac

if [ "$ACTION" != list ] && [ ! -w "$BIN" ]; then
  die "Run it with sudo: $BIN is not writable." "Lancez-le avec sudo : $BIN n'est pas accessible en écriture."
fi
command -v curl >/dev/null 2>&1 || [ "$ACTION" = list ] || [ "$ACTION" = remove ] \
  || die "curl is missing: sudo apt install curl" "curl manque : sudo apt install curl"

case "$ACTION" in
  "") if [ -t 0 ]; then menu; else usage; fi ;;
  list) list ;;
  update) update_all ;;
  install | remove)
    [ -n "$NAMES" ] || die "Name the script(s): $COMPONENTS" "Nommez le ou les scripts : $COMPONENTS"
    for name in $NAMES; do
      if [ "$ACTION" = install ]; then install_one "$name"; else remove_one "$name"; fi
    done
    ;;
  *) die "Unknown command: $ACTION (list, install, remove, update)" \
    "Commande inconnue : $ACTION (list, install, remove, update)" ;;
esac
