"use strict";
const assert=require("assert");
const {verifyRequestOrigin}=require("../lib/request-origin");

function check(method,origin,host,secure=false){
  let result="allowed";
  const req={method,secure,get:name=>({Origin:origin,Host:host})[name]};
  const res={status:code=>({json:()=>{result=code;}})};
  verifyRequestOrigin(req,res,()=>{});
  return result;
}

assert.equal(check("POST","http://exemple.lan","exemple.lan"),"allowed");
assert.equal(check("POST","https://exemple.lan","exemple.lan",true),"allowed");
assert.equal(check("POST","http://exemple.lan:8080","exemple.lan:8080"),"allowed");
assert.equal(check("POST","http://autre.exemple.lan","exemple.lan"),403);
assert.equal(check("POST","invalid","exemple.lan"),403);
assert.equal(check("POST",undefined,"exemple.lan"),"allowed");
assert.equal(check("GET","http://autre.exemple.lan","exemple.lan"),"allowed");
console.log("PASS sécurité : contrôle d'origine des requêtes");
