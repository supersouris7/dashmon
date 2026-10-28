# Installer Dashmon et ses agents

## Choisir son installation

- **Principal** : le tableau de bord, à installer une seule fois.
- **Agent** : facultatif ; à installer sur chaque autre machine à superviser.
- **Portainer** : copier la stack dans **Stacks → Add stack → Web editor**.
- **Docker Compose** : copier la même stack dans `compose.yaml`, puis lancer
  `docker compose up -d` depuis son dossier.

Les exemples utilisent `unstable`, mis à jour depuis `main`. Pour une release
stable, remplacez-le par une version publiée contenant les agents. Les exemples
créent des volumes Docker nommés : ne les supprimez pas lors d'une mise à jour.

## 1. Préparer les secrets

Générez **deux valeurs distinctes**, une pour la clé de chiffrement du principal
et une pour le jeton commun aux agents :

```sh
openssl rand -base64 32
openssl rand -base64 32
```

Choisissez aussi un mot de passe pour le principal et, pour chaque agent, un
mot de passe pour sa page locale. Ne publiez jamais ces valeurs.

| Variable | Principal | Agent |
| --- | --- | --- |
| `DASHMON_PASSWORD` | Mot de passe du tableau de bord | Mot de passe de la page locale ; peut être différent |
| `DASHMON_MASTER_KEY` | Clé de chiffrement des secrets des widgets | Inutile |
| `DASHMON_SYNC_TOKEN` | Jeton partagé, nécessaire pour les agents | **Même valeur que sur le principal** |

Conservez une sauvegarde de la clé maîtresse : si elle change, les secrets des
widgets précédemment chiffrés deviennent illisibles. Sans clé, ils sont stockés
en clair. Pour une installation sans agent, le jeton peut rester vide.

### Où saisir les valeurs ?

**Portainer :** dans la page de la stack, sous **Environment variables**, ajoutez
les noms et leurs valeurs, puis cliquez sur **Deploy the stack**. Les variables
sont accessibles aux administrateurs de Portainer : protégez cet accès.

**Docker Compose :** dans le même dossier que `compose.yaml`, créez un fichier
`.env` privé et ouvrez-le dans votre éditeur :

```sh
umask 077
touch .env
nano .env
```

Saisissez les noms ci-dessous avec vos valeurs. Pour l'agent, la clé maîtresse
peut être omise. Ne commitez jamais `.env`.

```dotenv
DASHMON_PASSWORD=
DASHMON_MASTER_KEY=
DASHMON_SYNC_TOKEN=
```

## 2. Installer le principal

Copiez cette stack dans Portainer ou dans `compose.yaml` :

```yaml
services:
  dashmon:
    image: supersouris7/dashmon:unstable
    container_name: dashmon
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    ports:
      - "8080:8080"
    environment:
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Renseignez DASHMON_PASSWORD}
      DASHMON_MASTER_KEY: ${DASHMON_MASTER_KEY:-}
      DASHMON_SYNC_TOKEN: ${DASHMON_SYNC_TOKEN:-}
    volumes:
      - dashmon-data:/app/data

volumes:
  dashmon-data:
```

Avec Compose, depuis le dossier contenant `compose.yaml` et `.env` :

```sh
docker compose up -d
docker compose ps
```

Ouvrez l'adresse de votre serveur avec le port **8080** et connectez-vous. Dans
`8080:8080`, le premier nombre est le port du serveur ; changez-le s'il est déjà
occupé. Le second est le port interne de Dashmon : laissez-le à `8080`.

Ces ports sont publiés sur les interfaces du serveur. Limitez l'accès par
pare-feu et utilisez HTTPS ou un réseau privé de confiance. Pour un accès
exclusivement local par un proxy sur le même serveur, utilisez
`127.0.0.1:8080:8080` à la place.

## 3. Installer un agent

Sur la machine à superviser, créez une **autre stack** et renseignez son mot
de passe ainsi que le **même** `DASHMON_SYNC_TOKEN` que sur le principal :

```yaml
services:
  dashmon-agent:
    image: supersouris7/dashmon:unstable
    container_name: dashmon-agent
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    ports:
      - "8081:8080"
    environment:
      DASHMON_MODE: agent
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Renseignez DASHMON_PASSWORD}
      DASHMON_SYNC_TOKEN: ${DASHMON_SYNC_TOKEN:?Renseignez DASHMON_SYNC_TOKEN}
    volumes:
      - dashmon-agent-data:/app/data
      # Facultatif : disque de l'hôte, en lecture seule.
      # - /:/host:ro

volumes:
  dashmon-agent-data:
```

Avec Compose, créez un dossier distinct, placez-y cette stack et son propre
`.env`, puis lancez `docker compose up -d`. Les noms de conteneur ci-dessus
permettent d'utiliser directement les commandes des guides d'intégration ;
adaptez-les si vous installez plusieurs instances sur le même serveur.

Le volume nommé conserve les réglages de l'agent. Pour utiliser un dossier de
l'hôte à la place, remplacez `dashmon-agent-data:/app/data` par le chemin
absolu de votre dossier suivi de `:/app/data`, puis retirez la section `volumes`
finale. Le dossier doit être inscriptible par l'UID `1000` du conteneur.

1. Ouvrez l'adresse de l'agent avec son port publié, ici `8081`, puis
   connectez-vous avec **son** mot de passe.
2. Renseignez le nom de l'hôte et les options souhaitées. Pour mesurer le disque
   de l'hôte, décommentez le montage `/host:ro`, redéployez et indiquez `/host`
   dans le champ du chemin disque. Sinon la mesure concerne le conteneur.
3. Sur le principal : **Modifier la supervision → Agents**. Ajoutez l'adresse
   complète de l'agent, par exemple `http://exemple.lan:8081`, puis donnez un
   nom à l'onglet si souhaité.
4. Cliquez sur **Tester la connexion**, puis sur **Enregistrer**. Le bouton
   **Paramétrer** ouvre la page de l'agent. L'onglet apparaît dans Supervision.

Le test utilise le réseau et le certificat du **principal** ; le bouton
Paramétrer utilise le navigateur. Ne testez qu'une adresse de confiance : le
jeton lui est transmis. Restreignez le port de l'agent et protégez le trafic par
HTTPS ou un réseau privé de confiance.

## 4. Ajouter WireGuard, SMART ou APT

Installez les scripts **sur chaque hôte concerné**, pas dans l'agent. Pour un
agent, renseignez le nom de son conteneur dans les commandes et le cron. Les
guides fournissent les commandes complètes :

- [WireGuard : installer et planifier le relevé](WIREGUARD.md)
- [SMART : installer et planifier le relevé](SMART.md)
- [APT : installer et planifier les mises à jour](APT_UPDATES.md)

Les rapports restent facultatifs. APT **installe réellement des mises à jour** ;
son redémarrage automatique est désactivé sauf activation explicite.

## 5. Mettre à jour et sauvegarder

**Portainer :** ouvrez la stack, puis **Pull and redeploy** en demandant le
téléchargement de l'image. Conservez le volume et les variables d'environnement.

**Compose :** dans le dossier de chaque stack :

```sh
docker compose pull
docker compose up -d
```

Sauvegardez le volume de données du principal et sa clé maîtresse séparément.
Les agents ont chacun leur propre volume de configuration. Mettre à jour une
image ne met pas à jour les scripts installés sur les hôtes.

## Dépannage rapide

| Problème | Vérification |
| --- | --- |
| Port déjà utilisé | `sudo ss -ltnp` ; changez le port à gauche dans `ports`. |
| Agent inaccessible | Vérifiez son port, le pare-feu et l'adresse depuis le principal. |
| Jeton refusé | Vérifiez que `DASHMON_SYNC_TOKEN` est identique sur les deux stacks, puis redéployez. |
| Erreur de certificat ou DNS | Voir [DNS et certificats](../deploy/DEPLOYMENT.md#6-monitoring-lan-domains-lan-local). |
| Aucune donnée SMART, APT ou WireGuard | Vérifiez le script et le nom du conteneur sur l'hôte concerné. |
| Dossier monté non inscriptible | Le conteneur utilise l'UID `1000` ; vérifiez le propriétaire et les droits du dossier. |

La [documentation de déploiement](../deploy/DEPLOYMENT.md) couvre également le
proxy, le DNS, les certificats et le socket Docker facultatif.
