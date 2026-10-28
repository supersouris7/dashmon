# HTTPS avec nginx

Dashmon parle HTTP à l'intérieur de son conteneur. Pour servir le tableau de
bord en HTTPS, placez **nginx devant Dashmon** : nginx présente le certificat
et transmet les requêtes à Dashmon sur la boucle locale.

Ce guide couvre le cas le plus simple : nginx installé sur la même machine que
Docker. Une variante avec nginx dans Docker est proposée en fin de page.

## Avant de commencer

- Dashmon fonctionne déjà et répond sur le port `8080`
  (voir [Installer Dashmon](DEMARRAGE.md)).
- Un nom DNS pointe vers la machine :
  - nom public : `dashmon.example.com`, utilisable avec Let's Encrypt ;
  - nom local : `dashmon.exemple.lan`, utilisable avec un certificat interne.
- Les ports **80** et **443** sont accessibles depuis les appareils qui doivent
  ouvrir Dashmon. Le port `8080` ne doit plus être exposé à l'extérieur.

Remplacez `dashmon.example.com` par votre nom réel dans toutes les commandes
ci-dessous. Pour un nom local, remplacez-le par `dashmon.exemple.lan` et suivez
la section « Certificat pour un nom local ».

## 1. Préparer Dashmon

Dans la stack Dashmon :

1. Publiez le port sur la boucle locale uniquement :
   `127.0.0.1:8080:8080` à la place de `8080:8080`. nginx, installé sur la même
   machine, sera le seul à pouvoir joindre Dashmon.
2. Ajoutez la variable `TRUST_PROXY` avec la valeur `1`. Sans elle, Dashmon ne
   sait pas que la requête arrive en HTTPS : le cookie de session n'est pas
   marqué `Secure` et l'adresse réelle du client est perdue.
3. Redéployez la stack.

Avec Docker Compose, les deux lignes à obtenir ressemblent à ceci :

```yaml
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      TRUST_PROXY: "1"
      # ... vos autres variables
```

Dans Portainer, modifiez le champ **Ports** et ajoutez `TRUST_PROXY` dans
**Environment variables**, puis **Update the stack**.

Vérifiez que Dashmon répond encore en local :

```sh
curl http://127.0.0.1:8080/healthz
```

La réponse doit contenir `{"ok":true}`. Si elle échoue, corrigez d'abord ce
point : nginx ne pourra pas faire mieux.

## 2. Installer nginx et certbot

Sur Debian, Ubuntu ou Raspberry Pi OS :

```sh
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Si un site par défaut occupe déjà le port 80 et que vous n'en avez pas besoin :

```sh
sudo rm -f /etc/nginx/sites-enabled/default
```

## 3. Configurer le proxy HTTP

Créez le fichier `/etc/nginx/sites-available/dashmon.conf` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dashmon.example.com;

    # Import d'icônes PNG : la limite doit rester au-dessus de 10 Mo.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Activez le site et rechargez nginx :

```sh
sudo ln -sf /etc/nginx/sites-available/dashmon.conf /etc/nginx/sites-enabled/dashmon.conf
sudo nginx -t
sudo systemctl reload nginx
```

Ouvrez maintenant `http://dashmon.example.com` : la page de connexion Dashmon
doit s'afficher. Si vous voyez la page « Welcome to nginx », le site par défaut
est encore actif : supprimez le lien indiqué à l'étape 2.

## 4. Ajouter le certificat

### Nom public : Let's Encrypt

Avec un nom qui existe dans le DNS public et un port 80 joignable depuis
Internet, certbot fait tout : certificat, HTTPS et redirection HTTP → HTTPS.

```sh
sudo certbot --nginx -d dashmon.example.com
```

Répondez aux questions en choisissant la **redirection** vers HTTPS. Certbot
modifie lui-même le fichier nginx. Vérifiez ensuite le renouvellement
automatique :

```sh
sudo certbot renew --dry-run
```

Certbot installe une minuterie systemd ; aucun cron supplémentaire n'est
nécessaire.

### Nom local : certificat interne

Let's Encrypt ne peut pas délivrer de certificat pour un nom qui n'existe que
sur votre réseau local (`.lan`, `.home`, `.local`…). Utilisez un certificat
auto-signé, ou mieux, une autorité interne (par exemple `mkcert`) si vous
voulez éviter l'avertissement du navigateur sur plusieurs appareils.

Exemple auto-signé, à copier tel quel en adaptant le nom :

```sh
sudo mkdir -p /etc/nginx/tls
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout /etc/nginx/tls/dashmon-key.pem \
  -out /etc/nginx/tls/dashmon.pem \
  -subj "/CN=dashmon.exemple.lan" \
  -addext "subjectAltName=DNS:dashmon.exemple.lan"
sudo chmod 600 /etc/nginx/tls/dashmon-key.pem
```

Remplacez ensuite le contenu de `/etc/nginx/sites-available/dashmon.conf` par :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dashmon.exemple.lan;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dashmon.exemple.lan;

    ssl_certificate     /etc/nginx/tls/dashmon.pem;
    ssl_certificate_key /etc/nginx/tls/dashmon-key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Rechargez nginx :

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Le navigateur affiche un avertissement tant que le certificat n'est pas
approuvé. Importez `/etc/nginx/tls/dashmon.pem` dans les appareils concernés,
ou utilisez une autorité interne déjà approuvée. **N'ajoutez pas d'exception
permanente dans le navigateur** et ne désactivez pas la vérification TLS.

> N'activez pas HSTS avec un certificat auto-signé : le navigateur forcerait
> ensuite HTTPS pour ce nom, sans possibilité de revenir en arrière simplement.
> HSTS est utile uniquement quand le certificat est valide et renouvelé
> automatiquement, par exemple avec Let's Encrypt.

## 5. Vérifier

1. Ouvrez `https://dashmon.example.com` : le cadenas doit apparaître.
2. Connectez-vous : la session doit rester active après un rechargement.
3. Dans les outils du navigateur, vérifiez que le cookie de session porte
   l'attribut `Secure`.
4. Depuis le serveur :

   ```sh
   curl -I https://dashmon.example.com
   sudo ss -ltnp | grep 8080
   ```

   La première commande doit répondre `200` ou `302`. La seconde doit montrer
   `127.0.0.1:8080`, et non `0.0.0.0:8080`.

## Utiliser Dashmon avec des agents en HTTPS

Le principal joint un agent depuis **son serveur**, pas depuis le navigateur.
Si l'agent est lui aussi servi en HTTPS :

- dans **Paramètres → Pairage**, saisissez l'adresse complète, par exemple
  `https://agent.exemple.lan:8443` ; sans schéma, Dashmon ajoute `http://` ;
- le certificat de l'agent doit être approuvé par le **principal**. Pour une
  autorité interne, montez son certificat et renseignez `NODE_EXTRA_CA_CERTS`
  (voir [Certificats d'autorité privée](../deploy/DEPLOYMENT.md#7-private-ca-certificates)) ;
- évitez `DASHBOARD_INSECURE_TLS=1`, qui désactive la vérification pour tous
  les échanges sortants du principal.

Un agent accessible uniquement sur un réseau de confiance peut rester en HTTP.
Ne l'exposez jamais directement sur Internet.

## Variante : nginx dans Docker

Si vous préférez garder nginx dans Docker, placez-le sur le même réseau que
Dashmon et ne publiez plus le port de Dashmon :

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
    expose:
      - "8080"
    environment:
      DASHMON_PASSWORD: ${DASHMON_PASSWORD:?Renseignez DASHMON_PASSWORD}
      TRUST_PROXY: "1"
    volumes:
      - dashmon-data:/app/data

  nginx:
    image: nginx:alpine
    container_name: dashmon-nginx
    restart: unless-stopped
    depends_on:
      - dashmon
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./dashmon.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro

volumes:
  dashmon-data:
```

Dans `./dashmon.conf`, utilisez le même bloc `server` que ci-dessus en
remplaçant `proxy_pass http://127.0.0.1:8080;` par :

```nginx
        proxy_pass http://dashmon:8080;
```

Les certificats restent gérés sur l'hôte (Let's Encrypt existant ou autorité
interne) : montez le dossier qui les contient, puis adaptez les chemins
`ssl_certificate` et `ssl_certificate_key` dans `./dashmon.conf`. Après un
renouvellement, rechargez nginx dans le conteneur :

```sh
docker exec dashmon-nginx nginx -s reload
```

Le plus simple pour un premier passage en HTTPS reste toutefois nginx installé
directement sur l'hôte : certbot y gère le certificat et le renouvellement sans
montage supplémentaire.

## Dépannage

| Symptôme | À vérifier |
| --- | --- |
| `502 Bad Gateway` | Dashmon tourne-t-il ? `curl http://127.0.0.1:8080/healthz`. Le port publié est-il bien `127.0.0.1:8080:8080` ? |
| `413 Request Entity Too Large` | Augmentez `client_max_body_size` dans nginx (12 Mo conseillés pour les icônes PNG). |
| Boucle de connexion ou cookie non `Secure` | `TRUST_PROXY=1` est absent, ou `X-Forwarded-Proto $scheme` manque dans nginx. Redéployez Dashmon après avoir ajouté la variable. |
| Page « Welcome to nginx » | Le site par défaut est encore actif : `sudo rm -f /etc/nginx/sites-enabled/default`, puis rechargez nginx. |
| Certbot échoue | Le nom doit pointer vers le serveur et le port 80 doit être joignable depuis Internet. Vérifiez le DNS et le pare-feu. |
| Avertissement de certificat en local | Le certificat auto-signé n'est pas approuvé sur cet appareil. Importez le certificat ou utilisez une autorité interne. |
| L'agent HTTPS est refusé | Le principal ne fait pas confiance à l'autorité de l'agent. Montez le certificat et utilisez `NODE_EXTRA_CA_CERTS` ; ne désactivez pas la vérification. |
| Le renouvellement ne prend pas effet | Rechargez nginx : `sudo systemctl reload nginx`, ou `docker exec dashmon-nginx nginx -s reload` si nginx est en conteneur. |

Pour les autres variables d'environnement, le DNS local et les certificats
d'autorité privée, consultez [deploy/DEPLOYMENT.md](../deploy/DEPLOYMENT.md).
