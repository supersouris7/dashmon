"use strict";
const fs=require("fs");
const crypto=require("crypto");

// Un seul processus possede le fichier ; les compteurs de clics sont traites
// separement pour ne pas rendre obsoletes les brouillons d'edition.
class ConfigStore{
  constructor(file){this.file=file;}
  read(){return JSON.parse(fs.readFileSync(this.file,"utf8"));}
  revision(config){
    const copy={...config};
    delete copy.usageCounts;
    return '"'+crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex")+'"';
  }
  write(value){
    const temporary=`${this.file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try{
      fs.writeFileSync(temporary,JSON.stringify(value,null,2)+"\n","utf8");
      fs.renameSync(temporary,this.file);
    }finally{try{fs.unlinkSync(temporary);}catch(_error){}}
  }
}
module.exports={ConfigStore};
