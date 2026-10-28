"use strict";
const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const net=require("net");
const crypto=require("crypto");
const {spawn}=require("child_process");

const root=path.join(__dirname,"..");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"dashmon-agent-test-"));
const password=crypto.randomBytes(24).toString("hex");
const token=crypto.randomBytes(24).toString("hex");
const auth="Basic "+Buffer.from("admin:"+password).toString("base64");
const children=[];
const loopback=[127,0,0,1].join(".");

async function freePort(){
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,loopback,resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
async function start(mode,port,folder){
  const child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:folder,CONFIG_FILE:path.join(folder,"config.json"),DASHMON_MODE:mode,DASHMON_PASSWORD:password,DASHMON_SYNC_TOKEN:token},stdio:"ignore"});
  children.push(child);
  const base=`http://${loopback}:${port}`;
  for(let i=0;i<100;i++){
    if(child.exitCode!==null) throw new Error("Serveur arrêté au démarrage");
    try{if((await fetch(base+"/healthz")).ok) return base;}catch(_error){}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("Démarrage trop long");
}
async function main(){
  const agentDir=path.join(dir,"agent");
  fs.mkdirSync(agentDir);
  fs.writeFileSync(path.join(agentDir,"config.json"),JSON.stringify({hosts:[{id:"local",name:"Ancien",monitoring:{enabled:true,type:"local"}},{id:"other",name:"Distant",monitoring:{enabled:true,type:"proxmox"}}],replication:{role:"secondary"}}));
  const agent=await start("agent",await freePort(),agentDir);
  let response=await fetch(agent+"/api/sync/metrics");
  assert.equal(response.status,401);
  response=await fetch(agent+"/api/sync/metrics",{headers:{"X-Dashmon-Sync-Token":token}});
  assert.equal(response.status,200);
  let data=await response.json();
  assert.equal(data.hosts.length,1);
  assert.equal(data.hosts[0].name,"Ancien");
  response=await fetch(agent+"/api/config",{headers:{Authorization:auth}});
  assert.equal(response.status,404);
  response=await fetch(agent+"/api/agent/config",{method:"PUT",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({name:"Agent",monitoring:{smart:{enabled:false},wireguard:{enabled:false}}})});
  assert.equal(response.status,200);
  data=JSON.parse(fs.readFileSync(path.join(agentDir,"config.json"),"utf8"));
  assert.equal(data.hosts.length,2);
  assert.equal(data.hosts.find(host=>host.id==="local").name,"Agent");
  response=await fetch(agent+"/api/sync/metrics",{headers:{"X-Dashmon-Sync-Token":token}});
  data=await response.json();
  assert.equal(data.hosts[0].name,"Agent");
  assert.equal(data.hosts[0].smart,null);
  assert.equal(data.hosts[0].wireguard,null);
  const primaryDir=path.join(dir,"primary");
  const primary=await start("dashboard",await freePort(),primaryDir);
  response=await fetch(primary+"/api/config",{headers:{Authorization:auth}});
  const config=await response.json();
  config.replication={role:"primary",instanceName:"Dashmon",secondaries:[agent]};
  response=await fetch(primary+"/api/config",{method:"PUT",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify(config)});
  assert.equal(response.status,200);
  response=await fetch(primary+"/api/replication/metrics",{headers:{Authorization:auth}});
  data=await response.json();
  assert.equal(data.instances[0].ok,true);
  assert.equal(data.instances[0].hosts[0].name,"Agent");
  console.log("PASS agent : authentification, migration, configuration et collecte principale");
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await Promise.all(children.map(child=>new Promise(resolve=>{
    if(child.exitCode!==null) return resolve();
    child.once("exit",resolve);
    child.kill("SIGTERM");
  })));
  fs.rmSync(dir,{recursive:true,force:true});
});
