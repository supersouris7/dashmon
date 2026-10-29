"use strict";
const assert=require("assert");
const path=require("path");
const {pathToFileURL}=require("url");
async function main(){
  const {agentUrl,replicationEntries,serializeReplicationEntries}=await import(pathToFileURL(path.join(__dirname,"../public/js/replication-draft.js")).href);
  assert.equal(agentUrl("exemple.lan"),"http://exemple.lan/");
  assert.equal(agentUrl("http://exemple.lan/?param=1"),"");
  const entries=replicationEntries({secondaries:["http://exemple.lan/"],agentNames:{"http://exemple.lan/":"Agent"},agentHosts:{"http://exemple.lan/":"host"}});
  entries.push({url:"http://[",name:"Brouillon",host:""});
  const config=serializeReplicationEntries(entries,new Set(["host"]));
  assert.deepEqual(config.secondaries,["http://exemple.lan/"]);
  assert.equal(config.agentNames["http://exemple.lan/"],"Agent");
  assert.equal(config.agentHosts["http://exemple.lan/"],"host");
  assert.equal(entries.length,2);
  console.log("PASS pairage : brouillon et serialisation separes");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
