"use strict";
// Tests ciblés du résumé Docker (logique pure, aucun accès réseau).
const assert = require("assert");
const { computeDockerSummary } = require("../docker");

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

function image(id, tags){
  return { Id: id, RepoTags: tags };
}

const img1 = "sha256:image1";
const img2 = "sha256:image2";

// 1. Tout vert : 9 conteneurs actifs sur 9, toutes les images à jour.
check("9 actifs / 9 à jour",
  computeDockerSummary(
    [1,2,3,4,5,6,7,8,9].map(i => container("app:" + i, "sha256:app" + i)),
    [1,2,3,4,5,6,7,8,9].map(i => image("sha256:app" + i, ["app:" + i]))
  ),
  { total: 9, active: 9, updated: 9 });

// 2. Un conteneur arrêté : actifs 8/9, images toujours à jour.
check("8 actifs (1 arrêté), images à jour",
  computeDockerSummary(
    [1,2,3,4,5,6,7,8].map(i => container("app:" + i, "sha256:app" + i))
      .concat(container("app:9", "sha256:app9", "exited")),
    [1,2,3,4,5,6,7,8,9].map(i => image("sha256:app" + i, ["app:" + i]))
  ),
  { total: 9, active: 8, updated: 9 });

// 3. Image re-pullée (watchtower) : le conteneur tourne sur l'ancienne image →
// le tag pointe désormais vers une nouvelle image → non à jour.
check("tag re-pullé vers une nouvelle image -> non à jour",
  computeDockerSummary(
    [container("app:1", "sha256:old1")],
    [image("sha256:new1", ["app:1", "app:latest"])]
  ),
  { total: 1, active: 1, updated: 0 });

// 4. Tag introuvable localement (image supprimée) -> non à jour (ni vert ni orange certain).
check("tag introuvable -> non à jour",
  computeDockerSummary(
    [container("app:1", "sha256:old1")],
    []
  ),
  { total: 1, active: 1, updated: 0 });

// 5. Image à jour mais conteneur arrêté -> actifs comptés, updated Ok.
check("arrêté volontaire compté dans le total, image à jour",
  computeDockerSummary(
    [container("mail:latest", img1, "exited")],
    [image(img1, ["mail:latest"])]
  ),
  { total: 1, active: 0, updated: 1 });

// 6. Zéro conteneur.
check("conteneur vide",
  computeDockerSummary([], []),
  { total: 0, active: 0, updated: 0 });

// 7. Entrées malformées (réponses invalides) -> zéros sûrs, pas de crash.
check("réponses invalides",
  computeDockerSummary(null, "nope"),
  { total: 0, active: 0, updated: 0 });

// 8. Doublon de tag entre deux images : la dernière remporte (sémantique Docker).
check("dernier tag pullé gagne",
  computeDockerSummary(
    [container("web:latest", "sha256:B")],
    [image("sha256:A", ["web:latest"]), image("sha256:B", ["web:latest"])]
  ),
  { total: 1, active: 1, updated: 1 });

// 9. Tags "aucun" (<none>:<none>) ignorés.
check("tags <none> ignorés",
  computeDockerSummary(
    [container("app:1", "sha256:app1")],
    [image("sha256:app1", ["<none>:<none>"])]
  ),
  { total: 1, active: 1, updated: 0 });

if (failures) {
  console.error(failures + " échec(s)");
  process.exit(1);
}
console.log("Tous les tests passent");