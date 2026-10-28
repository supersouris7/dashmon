"use strict";
const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const net=require("net");
const http=require("http");
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
  fs.writeFileSync(path.join(agentDir,"apt-updates.json"),JSON.stringify({status:"failed",failedStep:"upgrade",exitCode:100,error:"Erreur APT",finishedAt:Math.floor(Date.now()/1000)}));
  const agent=await start("agent",await freePort(),agentDir);
  let response=await fetch(agent+"/api/sync/metrics");
  assert.equal(response.status,401);
  response=await fetch(agent+"/api/sync/metrics",{headers:{"X-Dashmon-Sync-Token":token}});
  assert.equal(response.status,200);
  let data=await response.json();
  assert.equal(data.hosts.length,1);
  assert.equal(data.hosts[0].name,"Ancien");
  assert.equal(data.hosts[0].aptUpdates.error,"Erreur APT");
  assert.equal(data.hosts[0].aptUpdates.failedStep,"upgrade");
  assert.equal(data.hosts[0].aptUpdates.exitCode,100);
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
  fs.mkdirSync(primaryDir);
  fs.writeFileSync(path.join(primaryDir,"config.json"),JSON.stringify({hosts:[{id:"local",name:"Local",monitoring:{type:"local",enabled:false}},{id:"legacy",name:"Hôte",monitoring:{type:"proxmox",enabled:true}}]}));
  const primary=await start("dashboard",await freePort(),primaryDir);
  response=await fetch(primary+"/api/agents/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:agent})});
  assert.equal(response.status,401);
  response=await fetch(primary+"/api/agents/test",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({url:agent})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  response=await fetch(primary+"/api/agents/test",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({url:"file:///etc/passwd"})});
  assert.equal(response.status,400);
  assert.equal((await response.json()).reason,"invalid_url");
  let fakeStatus=401;
  const fake=http.createServer((_req,res)=>{res.writeHead(fakeStatus,{"Content-Type":"application/json"});res.end("{}");});
  await new Promise(resolve=>fake.listen(0,loopback,resolve));
  try{
    const url=`http://${loopback}:${fake.address().port}`;
    const options={method:"POST",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({url})};
    response=await fetch(primary+"/api/agents/test",options);
    assert.equal((await response.json()).reason,"unauthorized");
    fakeStatus=200;
    response=await fetch(primary+"/api/agents/test",options);
    assert.equal((await response.json()).reason,"invalid_response");
  }finally{ await new Promise(resolve=>fake.close(resolve)); }
  response=await fetch(primary+"/api/config",{headers:{Authorization:auth}});
  const config=await response.json();
  assert.equal(config.hosts.filter(host=>host.monitoring?.enabled && host.monitoring.type==="local").length,1);
  assert.ok(config.hosts.some(host=>host.id==="legacy"));
  response=await fetch(primary+"/api/host-metrics",{headers:{Authorization:auth}});
  const localMetrics=(await response.json()).hosts;
  assert.equal(localMetrics.length,1);
  assert.equal(localMetrics[0].id,"local");
  config.replication={role:"primary",instanceName:"Dashmon",secondaries:[agent],agentNames:{[agent]:"Supervision distante"}};
  response=await fetch(primary+"/api/config",{method:"PUT",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify(config)});
  assert.equal(response.status,200);
  response=await fetch(primary+"/api/config",{headers:{Authorization:auth}});
  const saved=await response.json();
  assert.equal(saved.replication.agentNames[new URL(agent).href],"Supervision distante");
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
