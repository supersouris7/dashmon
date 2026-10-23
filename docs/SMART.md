# Supervision SMART

Dashmon peut afficher l'etat SMART, la temperature et les compteurs d'usure
des disques de l'hote Docker. Cette supervision est locale : le script est a
executer sur la machine qui heberge le conteneur Dashmon.

## Installation

Installez `smartmontools`, puis recuperez le script :

```sh
sudo apt install smartmontools
curl -fsSL https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy/smart-dump.sh -o /usr/local/sbin/smart-dump.sh
sudo chmod 755 /usr/local/sbin/smart-dump.sh
```

Le script detecte les disques accessibles avec `smartctl --scan-open`, lance
`smartctl -j -q noserial -a` pour chacun, puis ecrit le resultat dans
`/app/data/smart.json` du conteneur `dashmon` :

```sh
sudo /usr/local/sbin/smart-dump.sh
```

Le nom du conteneur et le chemin peuvent etre fournis en arguments :

```sh
sudo /usr/local/sbin/smart-dump.sh dashmon /app/data/smart.json
```

Pour limiter les disques releves, definissez `DASHMON_SMART_DEVICES` :

```sh
sudo DASHMON_SMART_DEVICES="/dev/sda /dev/sdb" /usr/local/sbin/smart-dump.sh
```

Les boitiers USB ne rendent pas tous SMART accessible. Si `smartctl` requiert
une option de type de peripherique, adaptez une copie locale du script.

## Planification

Un releve toutes les quinze minutes est suffisant. Ajoutez cette ligne avec
`sudo crontab -e` :

```cron
*/15 * * * * /usr/local/sbin/smart-dump.sh >/dev/null 2>&1
```

## Configuration Dashmon

Ajoutez un hote de supervision de type **Local**, puis ouvrez l'onglet
**SMART**. La liste des disques est facultative : vide, elle affiche tous les
disques du releve ; renseignez par exemple `/dev/sda, /dev/sdb` pour filtrer.
Cliquez sur **Enregistrer** puis **Appliquer**.

Le serveur lit par defaut `/app/data/smart.json`. Pour un autre chemin monte
dans le conteneur, definissez `SMART_DUMP_FILE` dans l'environnement de
Dashmon. Le script peut alors ecrire le fichier hote via `DASHMON_SMART_DUMP`.

## Securite

Le script utilise `-q noserial` : les numeros de serie des disques ne sont pas
places dans le dump. Le fichier est ecrit de facon atomique afin que Dashmon ne
lise jamais un releve incomplet.
