"use strict";

const PROTOCOL={major:1,minor:0};
const CAPABILITIES=["host-metrics","wireguard","smart","apt-updates"];

// Le contrat reste additif : un pair sans protocole est un agent historique.
function assess(payload,{now=Date.now(),lastSuccessAt=null}={}){
  if(!payload || !Array.isArray(payload.hosts)) return {status:"unavailable",reason:"invalid_response",lastSuccessAt};
  if(payload.protocol==null){
    return {status:"available",legacy:true,collectedAt:null,lastSuccessAt:new Date(now).toISOString()};
  }
  if(!payload.protocol || payload.protocol.major!==PROTOCOL.major || !Number.isInteger(payload.protocol.minor) || payload.protocol.minor<0){
    return {status:"unavailable",reason:"incompatible_protocol",lastSuccessAt};
  }
  const collection=payload.collection;
  const collected=Date.parse(collection?.collectedAt);
  const maxAge=Number(collection?.maxAgeMs);
  if(!payload.agent || typeof payload.agent.id!=="string" || !payload.agent.id || !Array.isArray(payload.agent.capabilities)
      || !collection || !Number.isFinite(collected) || !Number.isFinite(maxAge) || maxAge<5000 || maxAge>10800000
      || !["available","unavailable"].includes(collection.status)){
    return {status:"unavailable",reason:"invalid_response",lastSuccessAt};
  }
  if(collection.status==="unavailable") return {status:"unavailable",reason:"collection_failed",collectedAt:collection.collectedAt,lastSuccessAt};
  const stale=collected>now+300000 || now-collected>maxAge;
  return {status:stale ? "stale" : "available",legacy:false,collectedAt:collection.collectedAt,
    lastSuccessAt:typeof collection.lastSuccessAt==="string" && Number.isFinite(Date.parse(collection.lastSuccessAt)) ? collection.lastSuccessAt : lastSuccessAt,
    protocol:payload.protocol,agent:payload.agent};
}
module.exports={PROTOCOL,CAPABILITIES,assess};
