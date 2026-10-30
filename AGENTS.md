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

```bash
npm ci
npm run format:check   # la mise en forme Prettier doit etre respectee
npm test               # toutes les suites de test/run.js doivent passer
actionlint             # doit sortir avec 0
```

`npm run test:browser` (Chromium requis) verifie en plus le parcours complet
dans un navigateur. L'organisation du code est decrite dans
`docs/ARCHITECTURE.md`.

## Suite de commit

Francais, au present de l'indicatif, prefixe de topic. Voir `git log --oneline`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Analyse de sécurité avec Semgrep

Semgrep est disponible dans le PATH du serveur OpenCode.

Commande :
semgrep scan --config p/default --metrics=off .

### Utilisation

- Exécuter Semgrep après une modification significative du code.
- Vérifier les modifications touchant les API, les entrées utilisateur,
  les fichiers, les permissions, les secrets ou la sécurité.
- Avant de proposer un commit contenant du code, effectuer une analyse.
- Ne pas lancer Semgrep pour une simple modification documentaire.

### Traitement des résultats

- Examiner en priorité les alertes concernant les fichiers modifiés.
- Distinguer les vulnérabilités confirmées des faux positifs.
- Ne jamais corriger automatiquement une alerte sans analyse.
- Ne pas désactiver des règles uniquement pour supprimer les alertes.
- Relancer les tests et Semgrep après les corrections.
- Signaler les alertes restantes à l'utilisateur.

### Contraintes

- Respecter les instructions Graphify et les règles de confidentialité.
- Ne jamais transmettre de secrets à un service externe.
- Ne pas installer de dépendances supplémentaires sans nécessité.
- Ne pas supprimer de fonctionnalités pour satisfaire Semgrep.
