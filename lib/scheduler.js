"use strict";
// Mutualise les cycles et execute une demande forcee apres le cycle en cours.
function createScheduler({runCycle}){
  let inflight=null;
  let pendingForce=false;
  return async function refresh(force=false){
    if(inflight){
      if(force) pendingForce=true;
      return inflight;
    }
    const task=(async()=>{
      let next=force;
      do{
        pendingForce=false;
        await runCycle(next);
        next=pendingForce;
      }while(next);
    })();
    inflight=task;
    try{await task;}finally{if(inflight===task) inflight=null;}
  };
}
module.exports={createScheduler};
