# Mises a jour APT

La carte **Mises a jour APT** de la page Supervision affiche le dernier rapport
de mise a jour d'un hote Debian ou Ubuntu. Dashmon ne lance jamais `apt` lui-meme : une tache
cron locale execute le script, qui ecrit un rapport JSON atomique dans les
donnees du conteneur, a cote des dumps WireGuard et SMART.

Par defaut, cron s'execute chaque mercredi a 03:00. Le script utilise
`apt-get -y upgrade` : il installe les mises a jour qui ne demandent pas de
suppression ou de nouvelle dependance, puis signale un redemarrage requis.

## Installation

Installez les fichiers sur l'hote qui execute Docker :

```sh
sudo curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/apt-updates.sh -o /usr/local/sbin/apt-updates.sh
sudo chmod 755 /usr/local/sbin/apt-updates.sh
```

Lancez un premier passage puis consultez son rapport :

```sh
sudo /usr/local/sbin/apt-updates.sh
```

Le script ecrit par defaut dans `/app/data/apt-updates.json` du conteneur
`dashmon`, a cote de `wireguard.dump` et `smart.json`. Si son nom differe,
passez `DASHMON_CONTAINER=...` avant la commande.

Pour un chemin different **dans** le conteneur, utilisez
`DASHMON_APT_REPORT_CONTAINER_PATH`. Dashmon doit alors recevoir le meme chemin
via `APT_UPDATES_REPORT_FILE`.

## Horaire et redemarrage

Ajoutez cette ligne au crontab root avec `sudo crontab -e` :

```cron
0 3 * * 3 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

Le redemarrage automatique est **desactive**. Pour l'autoriser seulement apres
une mise a jour reussie qui le requiert, prefixez la commande cron :

```cron
0 3 * * 3 DASHMON_APT_REBOOT=1 /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

Le rapport est ecrit avant la demande de redemarrage, avec l'etat
`redemarrage demande`.

## Supervision Dashmon

Dans **Modifier la supervision**, ajoutez ou activez un hote de type **Local**,
puis ouvrez l'onglet **Mises a jour APT**. La carte affiche le nombre de mises
a jour installees, la date du dernier passage et une alerte lorsqu'un
redemarrage est requis.

En cas d'echec, ouvrez **Détail de l’échec** sur la carte : le rapport indique
l'etape (`update` ou `upgrade`), le code de sortie et un extrait borne de la
sortie APT. Les URL de depots sont masquees dans cet extrait, mais il peut
contenir d'autres informations sur le systeme : limitez l'acces a Dashmon.
Les anciens rapports ne contiennent pas de detail. Installez la version a jour
du script sur chaque hote ; l'image Dashmon seule ne met pas a jour ce script.
Pour un rapport deja en echec, consultez les journaux APT de l'hote, par exemple
`sudo tail -n 100 /var/log/apt/term.log` s'il existe, sans relancer de mise a jour.

## Variante bind mount

Si le script ne peut pas joindre Docker, montez un dossier de l'hote dans le
conteneur. Les deux chemins sont distincts : le script utilise le chemin hote,
Dashmon celui du conteneur.

```yaml
services:
  dashmon:
    volumes:
      - /srv/dashmon-reports:/reports:ro
    environment:
      APT_UPDATES_REPORT_FILE: /reports/apt-updates.json
```

La ligne cron devient alors :

```cron
0 3 * * 3 DASHMON_APT_REPORT_FILE=/srv/dashmon-reports/apt-updates.json /usr/local/sbin/apt-updates.sh >/dev/null 2>&1
```

Le chemin de lecture reste fixe par l'environnement, jamais par l'interface
web.
