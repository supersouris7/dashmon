#!/bin/sh
# dashmon-setup.sh
# Installs, updates and removes the Dashmon host scripts and their cron lines,
# on the primary and on every agent. Guide: docs/SCRIPTS.md.
#
#   sudo dashmon-setup.sh                      # menu
#   sudo dashmon-setup.sh list                 # what is installed
#   sudo dashmon-setup.sh install smart-dump   # script + cron line
#   sudo dashmon-setup.sh remove smart-dump    # cron line + script
#   sudo dashmon-setup.sh --all                # update every installed script
#   sudo dashmon-setup.sh auto                 # ... and from cron, every night
#   sudo dashmon-setup.sh auto off             # stop the automatic update
#
# --lang fr|en chooses the language (default: from LANG).
# install options: --frequency 1|2|3 (default: the recommended one),
# --container NAME (default: the Dashmon container found by docker ps),
# --user NAME (OpenCode and Claude Code: whose crontab), --reboot (APT),
# --run (first run now), --yes (no question).
#
# The cron lines it writes end with "# dashmon:NAME": that is how it finds
# them again. It never edits another line, except a line that runs a script
# it removes. Scripts update by themselves only after `auto` (opt-in).
set -eu

# Version of this script. It writes no report, so Dashmon never flags it:
# `update` refreshes it with the others. Raise it on every change.
SCRIPT_VERSION=7

RAW="${DASHMON_RAW_URL:-https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy}"
BIN="${DASHMON_BIN_DIR:-/usr/local/bin}"
COMPONENTS="apt-updates smart-dump wireguard-dump opencode-stats claude-stats directory-sizes"

case "${DASHMON_LANG:-${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}}" in fr*) FR=1 ;; *) FR=0 ;; esac
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
# The setup tool's own cron line is the automatic update.
title_of() { if [ "$1" = setup ]; then say "the automatic update" "la mise à jour automatique"; else label "$1"; fi; }

# What the script feeds, shown before installing it.
purpose() {
  case "$1" in
    apt-updates) say "installs the host updates (apt-get upgrade) and reports them" \
      "installe les mises à jour de l'hôte (apt-get upgrade) et en rend compte" ;;
    smart-dump) say "SMART state and temperature of the disks (smartctl)" \
      "état SMART et température des disques (smartctl)" ;;
    wireguard-dump) say "WireGuard peers and traffic (wg)" "pairs et trafic WireGuard (wg)" ;;
    opencode-stats) say "OpenCode usage of a user" "utilisation d'OpenCode par un utilisateur" ;;
    claude-stats) say "Claude Code usage of a user" "utilisation de Claude Code par un utilisateur" ;;
    directory-sizes) say "size of the directories chosen in Dashmon" \
      "taille des répertoires choisis dans Dashmon" ;;
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
    setup)
      echo "0 */6 * * *||every 6 hours|toutes les 6 heures|"
      echo "30 4 * * *||every night at 04:30|chaque nuit à 04:30|1"
      echo "30 4 * * 0||every Sunday at 04:30|le dimanche à 04:30|"
      ;;
    directory-sizes)
      echo "0 * * * *||every hour|toutes les heures|"
      echo "0 */6 * * *||every 6 hours|toutes les 6 heures|"
      echo "30 3 * * *||every night at 03:30|chaque nuit à 03:30|1"
      ;;
  esac
}
# when NAME "EXPR": the schedule in words, or the expression itself.
when() {
  words=$(frequencies "$1" | while IFS='|' read -r expr _ english french _; do
    if [ "$expr" = "$2" ]; then if [ "$FR" = 1 ]; then echo "$french"; else echo "$english"; fi; fi
  done)
  if [ -n "$words" ]; then printf '%s\n' "$words"; else printf '%s\n' "$2"; fi
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

# crontab never gets the terminal nor an editor: whatever a crontab version
# makes of its arguments, it cannot open one (nano showed up on a Pi).
cron_read() { EDITOR=false VISUAL=false crontab -u "$1" -l </dev/null 2>/dev/null || true; }
# cron_write USER < content: through a file, not "-".
cron_write() {
  cron_file=$(mktemp)
  cat >"$cron_file"
  if EDITOR=false VISUAL=false crontab -u "$1" "$cron_file" </dev/null; then
    rm -f "$cron_file"
  else
    rm -f "$cron_file"
    die "crontab refused the new table of $1." "crontab a refusé la nouvelle table de $1."
  fi
}
marker() { echo "# dashmon:$1"; }
# Lines that run this script: ours (marker), written by hand from a guide,
# or from before the dashmon- names (/usr/local/sbin/apt-updates.sh...).
# runs NAME [-v]: keeps the lines that run it, or with -v the others (its
# comment line too).
runs() {
  if [ "${2:-}" = -v ]; then
    grep -v -F -e "$(marker "$1")" -e "[dashmon:$1]" -e "/dashmon-$1.sh" -e "bin/$1.sh" || true
  else
    grep -F -e "$(marker "$1")" -e "/dashmon-$1.sh" -e "bin/$1.sh" || true
  fi
}
# The active lines only: a commented-out line runs nothing.
cron_lines() { cron_read "$1" | grep -v '^[[:space:]]*#' | runs "$2"; }
cron_drop() {
  current=$(cron_read "$1")
  printf '%s\n' "$current" | runs "$2" -v | cron_write "$1"
  cron_tidy "$1"
}

# The comment written above a line: what it runs and when, in words.
cron_comment() {
  t_expr=$(printf '%s\n' "$2" | awk '{ print $1, $2, $3, $4, $5 }')
  t_what=$(if [ "$1" = setup ]; then
    say "Automatic update of the Dashmon scripts" "Mise à jour automatique des scripts Dashmon"
  else label "$1"; fi)
  t_how=$(when "$1" "$t_expr")
  case "$2" in *DASHMON_APT_REBOOT=1*) t_how="$t_how, $(say "automatic reboot" "redémarrage auto")" ;; esac
  printf '# %s : %s [dashmon:%s]\n' "$t_what" "$t_how" "$1"
}

# Rewrites a crontab readable: the other lines as they are, then the Dashmon
# lines together under a header, each with a blank line and its comment.
cron_tidy() {
  t_content=$(cron_read "$1")
  t_others=$(printf '%s\n' "$t_content" | grep -v -F -e '[dashmon' -e '# dashmon:' \
    | awk '{ line[NR] = $0 } NF && !first { first = NR } NF { last = NR }
      END { for (i = first; first && i <= last; i++) print line[i] }' | cat -s)
  t_blocks=""
  # "job", not "name": the callers keep their own $name.
  for t_job in $COMPONENTS setup; do
    t_line=$(printf '%s\n' "$t_content" | grep -v '^[[:space:]]*#' | grep -F "$(marker "$t_job")" | head -n 1)
    [ -n "$t_line" ] || continue
    t_blocks="$t_blocks
$(cron_comment "$t_job" "$t_line")
$t_line
"
  done
  {
    if [ -n "$t_others" ]; then printf '%s\n' "$t_others"; fi
    if [ -n "$t_others" ] && [ -n "$t_blocks" ]; then echo; fi
    if [ -n "$t_blocks" ]; then
      printf '%s\n' "$(say "# --- Dashmon: managed by dashmon-setup.sh (sudo dashmon-setup.sh list) [dashmon] ---" \
        "# --- Dashmon : géré par dashmon-setup.sh (sudo dashmon-setup.sh list) [dashmon] ---")"
      printf '%s' "$t_blocks"
    fi
  } | cron_write "$1"
}

invoking_user() {
  if [ -n "$USER_OPT" ]; then echo "$USER_OPT"
  elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then echo "$SUDO_USER"
  else id -un
  fi
}
cron_owners() { printf '%s\n%s\n' root "$(invoking_user)" | sort -u; }
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

# --- installed versions --------------------------------------------------

# Containers the cron lines write to, and the Dashmon containers running.
target_containers() {
  {
    for who in $(cron_owners); do
      cron_read "$who" | grep -v '^[[:space:]]*#' | grep -F '# dashmon:' \
        | sed -n -e 's/.*DASHMON_CONTAINER=\([A-Za-z0-9_.-]*\).*/\1/p' \
          -e 's/.*--container \([A-Za-z0-9_.-]*\).*/\1/p'
    done
    dashmon_containers
  } | sort -u
}

# Tells each Dashmon container which script versions are installed here:
# a card stops asking for the update as soon as its script is current,
# without waiting for its next run (APT runs once a week).
publish_versions() {
  command -v docker >/dev/null 2>&1 || return 0
  versions=""
  for item in $COMPONENTS; do
    if [ -f "$(file_of "$item")" ]; then
      versions="$versions\"$item\":$(version_of "$(file_of "$item")"),"
    fi
  done
  json="{\"versions\":{${versions%,}},\"writtenAt\":$(date +%s)}"
  for target in $(target_containers); do
    if ! printf '%s\n' "$json" | docker exec -i "$target" sh -c \
      'cat > /app/data/installed-scripts.json.tmp && mv -f /app/data/installed-scripts.json.tmp /app/data/installed-scripts.json' \
      >/dev/null 2>&1; then
      say "Container $target not reached: its cards learn the versions at the next runs." \
        "Conteneur $target injoignable : ses cartes verront les versions aux prochains passages."
    fi
  done
}

# --- download ------------------------------------------------------------

# Downloads deploy/NAME.sh next to its target, then renames it: a run in
# progress keeps reading the old file, and a cut download changes nothing.
# download NAME: deploy/NAME.sh checked, in $(file_of NAME).new.
download() {
  temporary="$(file_of "$1").new"
  if ! curl -fsSL "$RAW/$1.sh" -o "$temporary"; then
    rm -f "$temporary"
    die "Download failed: $RAW/$1.sh" "Échec du téléchargement : $RAW/$1.sh"
  fi
  if ! head -n 1 "$temporary" | grep -q '^#!' || [ -z "$(version_of "$temporary")" ]; then
    rm -f "$temporary"
    die "Unexpected content: $RAW/$1.sh" "Contenu inattendu : $RAW/$1.sh"
  fi
  chmod 755 "$temporary"
}
fetch() {
  download "$1"
  mv "$(file_of "$1").new" "$(file_of "$1")"
}

# --- commands ------------------------------------------------------------

# One line: version, schedule in words, whose crontab.
status_text() {
  file=$(file_of "$1")
  if [ ! -f "$file" ]; then say "not installed" "non installé"; return; fi
  owner=$(cron_owner "$1")
  version="v$(version_of "$file")"
  line=$(cron_lines "$owner" "$1" | head -n 1)
  if [ -z "$line" ]; then
    say "$version, no cron job" "$version, sans tâche cron"
    return
  fi
  expr=$(printf '%s\n' "$line" | awk '{ print $1, $2, $3, $4, $5 }')
  case "$line" in
    *"$(marker "$1")"*) how=$(when "$1" "$expr") ;;
    *) how=$(say "cron line written by hand ($expr)" "ligne cron écrite à la main ($expr)") ;;
  esac
  case "$line" in *DASHMON_APT_REBOOT=1*) how="$how, $(say "automatic reboot" "redémarrage auto")" ;; esac
  say "$version, $how (cron of $owner)" "$version, $how (cron de $owner)"
}

# Pads to a width in characters, accents included.
pad() {
  printf '%s' "$1"
  missing=$(($2 - $(printf '%s' "$1" | wc -m)))
  if [ "$missing" -gt 0 ]; then printf "%${missing}s" ""; fi
}

# list [full]: numbered as in the menu; full adds the cron lines.
list() {
  say "Dashmon scripts on this machine:" "Scripts Dashmon de cette machine :"
  index=0
  for name in $COMPONENTS; do
    index=$((index + 1))
    printf '  %d) %s %s\n' "$index" "$(pad "$(label "$name")" 17)" "$(status_text "$name")"
    if [ "${1:-}" = full ]; then
      cron_lines "$(cron_owner "$name")" "$name" | sed 's/^/       /'
    fi
  done
  if [ -f "$(file_of setup)" ]; then
    printf '     %s v%s\n' "$(pad dashmon-setup 17)" "$(version_of "$(file_of setup)")"
  fi
  printf '  a) %s %s\n' "$(pad "$(say "Auto update" "Mise à jour auto")" 17)" "$(auto_status)"
}

auto_status() {
  line=$(cron_lines root setup | head -n 1)
  if [ -z "$line" ]; then
    say "off (sudo dashmon-setup.sh auto)" "désactivée (sudo dashmon-setup.sh auto)"
    return
  fi
  expr=$(printf '%s\n' "$line" | awk '{ print $1, $2, $3, $4, $5 }')
  say "$(when setup "$expr") (cron of root)" "$(when setup "$expr") (cron de root)"
}

# auto [on|off]: the setup tool updates every installed script from cron.
auto_update() {
  case "${1:-on}" in
    off)
      if [ -n "$(cron_lines root setup)" ]; then cron_drop root setup; fi
      say "Automatic update off." "Mise à jour automatique désactivée."
      ;;
    on)
      # Installed at its usual place, so cron finds it.
      [ -f "$(file_of setup)" ] || fetch setup
      index=$(ask_frequency setup)
      line="$(frequency_field setup "$index" 1) $(file_of setup) --all >/dev/null 2>&1 $(marker setup)"
      current=$(cron_read root | runs setup -v)
      {
        [ -n "$current" ] && printf '%s\n' "$current"
        printf '%s\n' "$line"
      } | cron_write root
      cron_tidy root
      say "Automatic update on, cron of root:" "Mise à jour automatique activée, cron de root :"
      printf '  %s\n' "$line"
      say "It updates the installed scripts only: no new script, no cron change." \
        "Elle ne met à jour que les scripts installés : aucun nouveau script, aucune tâche cron changée."
      ;;
    *) die "auto takes on or off." "auto prend on ou off." ;;
  esac
}

ask_frequency() {
  best=$(recommended "$1")
  if [ -n "$FREQUENCY_OPT" ]; then
    case "$FREQUENCY_OPT" in 1 | 2 | 3) echo "$FREQUENCY_OPT"; return ;; esac
    die "--frequency takes 1, 2 or 3." "--frequency prend 1, 2 ou 3."
  fi
  if ! interactive; then echo "$best"; return; fi
  say "How often should $(title_of "$1") run?" "À quelle fréquence lancer $(title_of "$1") ?" >&2
  for index in 1 2 3; do
    text=$(if [ "$FR" = 1 ]; then frequency_field "$1" "$index" 4; else frequency_field "$1" "$index" 3; fi)
    mark=""
    [ "$index" = "$best" ] && mark=$(say " (recommended)" " (conseillé)")
    printf '  %d) %s %s\n' "$index" "$(pad "$text$mark" 44)" "$(frequency_field "$1" "$index" 1)" >&2
  done
  printf '%s ' "$(say "Choice [Enter = $best]:" "Choix [Entrée = $best] :")" >&2
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

# Does this user work with OpenCode or Claude Code here?
user_has_tool() {
  home=$(getent passwd "$2" 2>/dev/null | cut -d: -f6)
  [ -n "$home" ] || return 1
  case "$1" in
    claude-stats) [ -d "${CLAUDE_CONFIG_DIR:-$home/.claude}/projects" ] ;;
    opencode-stats) [ -d "$home/.local/share/opencode" ] || [ -x "$home/.opencode/bin/opencode" ] ;;
  esac
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
  if user_script "$name" && ! user_has_tool "$name" "$owner"; then
    say "$(label "$name") does not seem to be used by $owner on this machine." \
      "$(label "$name") ne semble pas utilisé par $owner sur cette machine."
    if ! confirm "Install it anyway?" "L'installer quand même ?" n && [ "$YES" = 0 ]; then
      say "Nothing installed." "Rien n'a été installé."
      return 0
    fi
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
  cron_tidy "$owner"
  # A copy from before the dashmon- names, run only by a replaced line.
  for former in $(printf '%s\n' "$existing" | tr ' ' '\n' | grep "bin/$name.sh\$" || true); do
    if [ -f "$former" ] && [ -z "$(cron_read "$owner" | grep -F "$former" || true)" ]; then
      rm -f "$former" && say "Former copy removed: $former" "Ancienne copie supprimée : $former"
    fi
  done
  publish_versions
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
  publish_versions
  say "Its report stays in the container: the card shows the last one, then disappears with it." \
    "Son rapport reste dans le conteneur : la carte affiche le dernier relevé."
}

update_all() {
  updated=0
  for name in setup $COMPONENTS; do
    file=$(file_of "$name")
    [ -f "$file" ] || continue
    before=$(version_of "$file")
    download "$name"
    after=$(version_of "$file.new")
    if cmp -s "$file.new" "$file"; then
      rm -f "$file.new"
      say "  $(label "$name"): v$after, up to date" "  $(label "$name") : v$after, à jour"
    else
      mv "$file.new" "$file"
      say "  $(label "$name"): v${before:-?} -> v$after, updated" "  $(label "$name") : v${before:-?} -> v$after, mis à jour"
      # The rest is done by the new version, so one --all is enough.
      if [ "$name" = setup ] && [ -z "${DASHMON_SETUP_RESTARTED:-}" ]; then
        language=en
        [ "$FR" = 1 ] && language=fr
        exec env DASHMON_SETUP_RESTARTED=1 DASHMON_LANG="$language" \
          sh "$file" --all ${USER_OPT:+--user "$USER_OPT"}
      fi
    fi
    # A script without its cron job feeds no card.
    if [ "$name" != setup ] && [ -z "$(cron_lines "$(cron_owner "$name")" "$name")" ]; then
      say "    no cron job: sudo dashmon-setup.sh install $name" \
        "    sans tâche cron : sudo dashmon-setup.sh install $name"
    fi
    updated=$((updated + 1))
  done
  [ "$updated" -gt 0 ] || say "No Dashmon script installed in $BIN." "Aucun script Dashmon installé dans $BIN."
  # Older installs wrote bare lines: same jobs, laid out with their comments.
  for who in $(cron_owners); do
    if [ -n "$(cron_read "$who" | grep -F '# dashmon:' || true)" ]; then cron_tidy "$who"; fi
  done
  publish_versions
  say "The cron jobs do not change (only laid out with their comments)." \
    "Les tâches cron ne changent pas (seulement remises en forme, avec leurs commentaires)."
}

clear_screen() { if [ -t 1 ]; then printf '\033[H\033[2J'; fi; }
pause() {
  printf '\n%s ' "$(say "Press Enter to go back to the menu." "Entrée pour revenir au menu.")"
  read -r _ || true
}

# One script: what it does, then install it, or change or remove it.
menu_script() {
  name=$1
  echo
  say "$(label "$name"): $(purpose "$name")." "$(label "$name") : $(purpose "$name")."
  if [ -f "$(file_of "$name")" ]; then
    say "Now: $(status_text "$name")" "Actuellement : $(status_text "$name")"
    say "  1) change the frequency   2) remove it   Enter) back" \
      "  1) changer la fréquence   2) le retirer   Entrée) retour"
    printf '%s ' "$(say "Choice:" "Choix :")"
    read -r action || action=""
    case "$action" in
      1) install_one "$name" ;;
      2) if confirm "Remove $(label "$name") and its cron job?" \
        "Retirer $(label "$name") et sa tâche cron ?" n; then remove_one "$name"; fi ;;
      *) say "Nothing changed." "Rien n'a changé." ;;
    esac
  elif confirm "Install it?" "L'installer ?" y; then
    install_one "$name"
  else
    say "Nothing changed." "Rien n'a changé."
  fi
}

menu() {
  while :; do
    clear_screen
    say "Dashmon setup: the scripts that feed the Supervision cards" \
      "Dashmon setup : les scripts qui alimentent les cartes de Supervision"
    echo
    list
    echo
    say "Type the number of a script (1-6), u to update them all now, a for the automatic update, q to quit." \
      "Tapez le numéro d'un script (1-6), u pour tout mettre à jour maintenant, a pour la mise à jour auto, q pour quitter."
    [ "$FR" = 1 ] || echo "(En français : sudo dashmon-setup.sh --lang fr)"
    printf '> '
    read -r pick || return 0
    case "$pick" in
      q | Q) return 0 ;;
      "") ;;
      u | U) echo; update_all; pause ;;
      a | A)
        echo
        say "Automatic update: every installed script, from cron. Now: $(auto_status)" \
          "Mise à jour automatique des scripts installés, par cron. Actuellement : $(auto_status)"
        say "  1) turn on or change the frequency   2) turn off   Enter) back" \
          "  1) activer ou changer la fréquence   2) désactiver   Entrée) retour"
        printf '%s ' "$(say "Choice:" "Choix :")"
        read -r action || action=""
        case "$action" in 1) auto_update on ;; 2) auto_update off ;; *) say "Nothing changed." "Rien n'a changé." ;; esac
        pause
        ;;
      [1-6])
        menu_script "$(echo "$COMPONENTS" | tr ' ' '\n' | sed -n "${pick}p")"
        pause
        ;;
      *) say "Unknown choice: $pick" "Choix inconnu : $pick"; pause ;;
    esac
  done
}

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
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
    --frequency | --container | --user | --lang)
      [ "$#" -ge 2 ] || die "Missing value for $1" "Valeur manquante pour $1"
      case "$1" in
        --frequency) FREQUENCY_OPT=$2 ;;
        --container) CONTAINER_OPT=$2 ;;
        --user) USER_OPT=$2 ;;
        --lang) case "$2" in fr*) FR=1 ;; *) FR=0 ;; esac ;;
      esac
      shift 2
      continue
      ;;
    --reboot) REBOOT_OPT=1 ;;
    --run) RUN_OPT=1 ;;
    --yes | -y) YES=1 ;;
    --all | -all | -a) ACTION=update ;;
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
  list) list full ;;
  update) update_all ;;
  auto) auto_update $NAMES ;;
  install | remove)
    [ -n "$NAMES" ] || die "Name the script(s): $COMPONENTS" "Nommez le ou les scripts : $COMPONENTS"
    for name in $NAMES; do
      if [ "$ACTION" = install ]; then install_one "$name"; else remove_one "$name"; fi
    done
    ;;
  *) die "Unknown command: $ACTION (list, install, remove, update, auto)" \
    "Commande inconnue : $ACTION (list, install, remove, update, auto)" ;;
esac
