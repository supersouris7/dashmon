"use strict";
const crypto=require("crypto");
const SECRET_PREFIX="aes1.";

// Le format aes1 existant reste lisible pour les configurations deja installees.
function createSecretCodec(masterKey){
  const key=masterKey ? crypto.createHash("sha256").update(masterKey,"utf8").digest() : null;
  function isEncryptedSecret(value){return typeof value==="string" && value.startsWith(SECRET_PREFIX);}
  function encryptSecret(value){
    if(key===null) return String(value||"");
    const iv=crypto.randomBytes(12);
    const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
    const encrypted=Buffer.concat([cipher.update(String(value||""),"utf8"),cipher.final()]);
    return `${SECRET_PREFIX}${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  }
  function decryptSecret(value){
    if(!isEncryptedSecret(value)) return String(value||"");
    if(key===null) return "";
    try{
      const parts=value.slice(SECRET_PREFIX.length).split(".");
      if(parts.length!==3) return "";
      const iv=Buffer.from(parts[0],"base64");
      const tag=Buffer.from(parts[1],"base64");
      const data=Buffer.from(parts[2],"base64");
      const decipher=crypto.createDecipheriv("aes-256-gcm",key,iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
    }catch(_error){return "";}
  }
  return {isEncryptedSecret,encryptSecret,decryptSecret};
}
module.exports={createSecretCodec};
