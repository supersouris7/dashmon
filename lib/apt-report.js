"use strict";
const fs=require("fs");
const {sanitizeText}=require("./sanitize");

function nonnegativeInteger(value){
  const number=Number(value);
  return Number.isFinite(number) && number>=0 ? Math.floor(number) : null;
}

// Le chemin vient de l'administration, jamais d'une requete du navigateur.
function readAptUpdatesReport(file,{filesystem=fs}={}){
  let stat;
  try{stat=filesystem.statSync(file);}catch(_error){return null;}
  if(!stat.isFile() || stat.size>100000) return null;
  let raw;
  try{raw=JSON.parse(filesystem.readFileSync(file,"utf8"));}catch(_error){return null;}
  if(!raw || (raw.status!=="success" && raw.status!=="failed")) return null;
  const next=nonnegativeInteger(raw.nextRunAt);
  const finished=nonnegativeInteger(raw.finishedAt);
  return {
    status:raw.status,
    failedStep:raw.failedStep==="update" || raw.failedStep==="upgrade" ? raw.failedStep : null,
    exitCode:Number.isInteger(raw.exitCode) && raw.exitCode>=0 && raw.exitCode<=255 ? raw.exitCode : null,
    error:typeof raw.error==="string" ? sanitizeText(raw.error,4000) : "",
    updated:nonnegativeInteger(raw.updated)||0,
    rebootRequired:raw.rebootRequired===true,
    rebootRequested:raw.rebootRequested===true,
    finishedAt:finished||Math.floor(stat.mtimeMs/1000),
    nextRunAt:next && (!finished || next>finished) ? next : null
  };
}
module.exports={readAptUpdatesReport};
