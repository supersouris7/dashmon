# AGENTS.md

Dashmon est un depot **public**. Cette page fixe les regles a appliquer sur tout changement.

## Regle principale : aucune donnee personnelle

Ne commit ni ne documente jamais, dans aucun fichier du depot :

- un nom d'hote, un FQDN ou une IP de l'infrastructure reelle du developpeur
- un identifiant personnel (pseudo, nom d'utilisateur, compte, adresse)
- un token, une cle, un mot de passe, un ID d'instance ou de stack, reel ou fictif
- une URL ou un port pointant sur un service prive du developpeur

Cela vaut pour le code, la documentation, les exemples, les fixtures de test et
les messages de commit. Un secret *reference* par son nom dans un workflow
(`${{ secrets.MON_SECRET }}`) est autorise ; sa valeur ne l'est jamais.

## Avant chaque push

1. Verifier que le diff ne contient aucune valeur ci-dessus.
2. Relire aussi les fichiers **preexistants** touches : un depot public peut
   contenir une fixture copiee d'un environnement reel. C'est arrivé ici avec
   `portainer.lan`, un pseudo de joueur et une IP en `192.168.x`.
3. En cas de doute, remplacer par les valeurs de documentation deja admises dans
   le depot : plages `192.0.2.0/24` et `198.51.100.0/24` (RFC 5737), domaines
   `exemple.lan` / `portainer.exemple.lan`.
4. Reference : le branding `supersouris7` dans le README et les valeurs par
   defaut est voulu et ne doit pas etre neutralise.

## Portee de la documentation

La documentation est ecrite pour l'utilisateur final (installation, usage,
contribution), jamais pour l'infrastructure personnelle du developpeur. Si une
fonctionnalite est specifique a un envoi local, elle ne va pas dans le depot.

## Chaine de livraison

`push sur main` -> `.github/workflows/docker.yml` (buildx multi-architecture)
-> `supersouris7/dashmon:unstable` sur Docker Hub. Le developpeur tire ensuite
l'image dans Portainer en local. Le runner GitHub-hosted n'a pas acces au
reseau local : ne pas introduire de job qui contacterait un service prive.

## Verification

```powershell
npm ci
npm test          # les 3 suites doivent passer
actionlint        # doit sortir avec 0
```

## Suite de commit

Francais, au present de l'indicatif, prefixe de topic. Voir `git log --oneline`.
