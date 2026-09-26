"use strict";
// Tests ciblés du résumé Docker (logique pure, aucun accès réseau).
// Sémantique fiable : un conteneur n'est "non à jour" que sur preuve positive
// (tag local re-pullé vers une autre image). Sinon il est compté à jour et
// tracé dans `unknown` (à raffiner au registre distant par le backend).
const assert = require("assert");
const { computeDockerSummary, parseImageRef } = require("../docker");

let failures = 0;
function check(name, actual, expected){
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name + " — " + error.message);
  }
}

function container(image, imageId, state){
  return { Image: image, ImageID: imageId, State: state || "running" };
}

function image(id, tags, digests){
  return { Id: id, RepoTags: tags, RepoDigests: digests || [] };
}

const img1 = "sha256:image1";
const img2 = "sha256:image2";

// --- computeDockerSummary ---
// 1. Tout vert : 9 conteneurs actifs, images locales à jour (vérification
//    registre non incluse ici -> unknown = 9).
check("9 actifs / 9 à jour (local)",
  computeDockerSummary(
    [1,2,3,4,5,6,7,8,9].map(i => container("app:" + i, "sha256:app" + i)),
    [1,2,3,4,5,6,7,8,9].map(i => image("sha256:app" + i, ["app:" + i], ["app:" + i + "@sha256:xyz" + i]))
  ),
  { total: 9, active: 9, updated: 9, unknown: 9 });

// 2. Un conteneur arrêté : actifs 8/9, toujours compté dans le total.
check("8 actifs (1 arrêté)",
  computeDockerSummary(
    [1,2,3,4,5,6,7,8].map(i => container("app:" + i, "sha256:app" + i))
      .concat(container("app:9", "sha256:app9", "exited")),
    [1,2,3,4,5,6,7,8,9].map(i => image("sha256:app" + i, ["app:" + i]))
  ),
  { total: 9, active: 8, updated: 9, unknown: 9 });

// 3. Image re-pullée (watchtower) : le tag pointe vers une nouvelle image ->
//    mise à jour disponible, prouvée localement. Ne compte ni updated ni unknown.
check("tag re-pullé -> mise à jour (preuve locale)",
  computeDockerSummary(
    [container("app:1", "sha256:old1")],
    [image("sha256:new1", ["app:1", "app:latest"])]
  ),
  { total: 1, active: 1, updated: 0, unknown: 0 });

// 4. Tag introuvable localement : pas de preuve de mise à jour -> compté à jour,
//    mais tracé unknown (le backend vérifiera le registre distant).
check("tag introuvable -> à jour (opt) + unknown",
  computeDockerSummary(
    [container("app:1", "sha256:old1")],
    []
  ),
  { total: 1, active: 1, updated: 1, unknown: 1 });

// 5. Image à jour, conteneur arrêté volontairement.
check("arrêté volontaire compté, image à jour",
  computeDockerSummary(
    [container("mail:latest", img1, "exited")],
    [image(img1, ["mail:latest"])]
  ),
  { total: 1, active: 0, updated: 1, unknown: 1 });

// 6. Référence par digest : immuable, toujours à jour, jamais inconnue.
check("référence par digest -> à jour",
  computeDockerSummary(
    [container("nginx@sha256:abc", "sha256:abc")],
    [image("sha256:abc", ["nginx@sha256:abc"], ["nginx@sha256:abc"])]
  ),
  { total: 1, active: 1, updated: 1, unknown: 0 });

// 7. Zéro conteneur.
check("conteneur vide",
  computeDockerSummary([], []),
  { total: 0, active: 0, updated: 0, unknown: 0 });

// 8. Entrées malformées -> zéros sûrs, pas de crash.
check("réponses invalides",
  computeDockerSummary(null, "nope"),
  { total: 0, active: 0, updated: 0, unknown: 0 });

// 9. Doublon de tag : la dernière image pullée gagne (sémantique Docker).
check("dernier tag pullé gagne",
  computeDockerSummary(
    [container("web:latest", "sha256:B")],
    [image("sha256:A", ["web:latest"]), image("sha256:B", ["web:latest"])]
  ),
  { total: 1, active: 1, updated: 1, unknown: 1 });

// 10. Tags <none> ignorés (image sans tag -> unresolved).
check("tags <none> ignorés",
  computeDockerSummary(
    [container("app:1", "sha256:app1")],
    [image("sha256:app1", ["<none>:<none>"])]
  ),
  { total: 1, active: 1, updated: 1, unknown: 1 });

// --- parseImageRef ---
function ref(name, expected){
  const { registry, repo, tag, pinned, digest } = parseImageRef(name);
  check("parse " + name,
    { registry, repo, tag, pinned, digest },
    expected);
}
ref("nginx:latest", { registry:"", repo:"nginx", tag:"latest", pinned:false, digest:"" });
ref("library/nginx", { registry:"", repo:"library/nginx", tag:"latest", pinned:false, digest:"" });
ref("ghcr.io/owner/app:1.0", { registry:"ghcr.io", repo:"owner/app", tag:"1.0", pinned:false, digest:"" });
ref("192.168.1.10:5000/app:1.0", { registry:"192.168.1.10:5000", repo:"app", tag:"1.0", pinned:false, digest:"" });
ref("docker.io/library/nginx:latest", { registry:"docker.io", repo:"library/nginx", tag:"latest", pinned:false, digest:"" });
ref("nginx@sha256:abc", { registry:"", repo:"nginx", tag:"latest", pinned:true, digest:"sha256:abc" });

if (failures) {
  console.error(failures + " échec(s)");
  process.exit(1);
}
console.log("Tous les tests passent");