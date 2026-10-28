"use strict";
// Point d'entree explicite ; l'image existante supporte toujours DASHMON_MODE.
process.env.DASHMON_MODE="agent";
require("./server").createApp().start().catch(error=>{
  console.error("Demarrage agent impossible :",error);
  process.exit(1);
});
