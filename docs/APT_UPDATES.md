# Mises a jour APT

La carte **Mises a jour APT** de la page Supervision affiche le dernier rapport
de mise a jour d'un hote Debian ou Ubuntu. Dashmon ne lance jamais `apt` lui-meme : une tache
cron locale execute le script, qui ecrit un rapport JSON atomique dans les
donnees du conteneur, a cote des dumps WireGuard et SMART.

Par defaut, cron s'execute chaque mercredi a 03:00. Il applique les mises a
jour avec `apt-get -y upgrade`, compte les paquets avant l'installation et
signale si un redemarrage est requis.

## Installation

Installez les fichiers sur l'hote qui execute Docker :

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/apt-updates.sh -o /usr/local/sbin/apt-updates.sh
sudo chmod 755 /usr/local/sbin/apt-updates.sh
sudo install -m 600 /dev/null /etc/default/dashmon-apt-updates
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/apt-updates.cron -o /etc/cron.d/dashmon-apt-updates
sudo chmod 644 /etc/cron.d/dashmon-apt-updates
```

Lancez un premier passage puis consultez son rapport :

```sh
sudo /usr/local/sbin/apt-updates.sh
```

Le script ecrit par defaut dans `/app/data/apt-updates.json` du conteneur
`dashmon`, a cote de `wireguard.dump` et `smart.json`. Si son nom differe,
ajoutez `DASHMON_CONTAINER=...` dans
`/etc/default/dashmon-apt-updates`.

Pour un chemin different **dans** le conteneur, utilisez
`DASHMON_APT_REPORT_CONTAINER_PATH`. Dashmon doit alors recevoir le meme chemin
via `APT_UPDATES_REPORT_FILE`.

## Horaire et redemarrage

Le fichier `/etc/cron.d/dashmon-apt-updates` est configure pour mercredi 03:00.
Pour choisir un autre horaire, editez la derniere ligne :

```sh
sudo editor /etc/cron.d/dashmon-apt-updates
```

Le redemarrage automatique est **desactive**. Pour l'autoriser seulement apres
une mise a jour reussie qui le requiert, ajoutez dans
`/etc/default/dashmon-apt-updates` :

```ini
DASHMON_APT_REBOOT=1
```

Le rapport est ecrit avant le redemarrage, avec l'etat `redemarrage lance`.

## Supervision Dashmon

Dans **Modifier la supervision**, ajoutez ou activez un hote de type **Local**,
puis ouvrez l'onglet **Mises a jour APT**. La carte affiche le nombre de mises
a jour installees, la date du dernier passage et une alerte lorsqu'un
redemarrage est requis.

## Variante bind mount

Si le script ne peut pas joindre Docker, montez un dossier de l'hote dans le
conteneur et definissez `APT_UPDATES_REPORT_FILE` pour Dashmon. Definissez le
meme chemin hote dans `DASHMON_APT_REPORT_FILE` dans
`/etc/default/dashmon-apt-updates`. Le chemin de lecture reste fixe par
l'environnement, jamais par l'interface web.
