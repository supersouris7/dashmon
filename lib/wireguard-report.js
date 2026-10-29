"use strict";
const fs=require("fs");
const {sanitizeText}=require("./sanitize");
const MAX_INTERFACES=10;
const MAX_PEERS=200;

function handshakeSeconds(value){
  if(value===null || value===undefined || value==="") return null;
  let n=Number(value);
  if(!Number.isFinite(n)){
    const parsed=Date.parse(String(value));
    if(!Number.isFinite(parsed)) return null;
    n=parsed/1000;
  }else if(n>1e12) n/=1000;
  return Number.isFinite(n) && n>0 ? Math.floor(n) : null;
}
function byteCount(value){
  if(value===null || value===undefined || value==="") return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0 ? Math.floor(n) : null;
}
function normalizePeer(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const peer={
    name:sanitizeText(raw.name || raw.publicKey || raw.public_key,80),
    endpoint:sanitizeText(raw.endpoint,120),
    latestHandshake:handshakeSeconds(raw.latestHandshake!==undefined ? raw.latestHandshake : raw.latest_handshake),
    rx:byteCount(raw.rx),tx:byteCount(raw.tx)
  };
  if(typeof raw.connected==="boolean") peer.connected=raw.connected;
  return peer;
}
function normalizeWireguard(raw){
  if(!raw || typeof raw!=="object") return null;
  const list=Array.isArray(raw) ? raw : Array.isArray(raw.interfaces) ? raw.interfaces : [raw];
  const interfaces=list.slice(0,MAX_INTERFACES).map(item=>{
    if(!item || typeof item!=="object" || Array.isArray(item)) return null;
    return {interface:sanitizeText(item.interface || item.name || item.iface,50),
      peers:(Array.isArray(item.peers) ? item.peers : []).slice(0,MAX_PEERS).map(normalizePeer).filter(Boolean)};
  }).filter(Boolean);
  return interfaces.length ? interfaces : null;
}
function readWireguardDump(file,{filesystem=fs}={}){
  let stat,text;
  try{stat=filesystem.statSync(file);}catch(_error){return null;}
  if(!stat.isFile() || stat.size>1_000_000) return null;
  try{text=filesystem.readFileSync(file,"utf8");}catch(_error){return null;}
  const byInterface=new Map();
  for(const line of text.split(/\r?\n/)){
    if(!line) continue;
    const fields=line.split("\t");
    const name=fields[0]||"";
    if(!name) continue;
    if(fields.length>=9){
      const entry=byInterface.get(name) || {interface:name,peers:[]};
      byInterface.set(name,entry);
      const handshake=Number(fields[5]);
      entry.peers.push({name:fields[1],endpoint:fields[3]==="(none)" ? "" : fields[3],
        latestHandshake:Number.isFinite(handshake)&&handshake>0 ? handshake : null,rx:fields[6],tx:fields[7]});
    }else if(!byInterface.has(name)) byInterface.set(name,{interface:name,peers:[]});
  }
  const fetchedAt=Math.floor(stat.mtimeMs/1000);
  return {interfaces:normalizeWireguard([...byInterface.values()])||[],
    fetchedAt:Number.isFinite(fetchedAt)&&fetchedAt>0 ? fetchedAt : null};
}
module.exports={readWireguardDump,normalizeWireguard};
