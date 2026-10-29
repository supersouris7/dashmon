"use strict";

const assert = require("assert");
const { pathToFileURL } = require("url");
const path = require("path");

async function main(){
  const requests=[];
  global.fetch=async (_url,options)=>{
    requests.push(options);
    return {ok:true,status:200,headers:{get:()=> '"revision"'}};
  };
  const {patchConfig}=await import(pathToFileURL(path.join(__dirname,"../public/js/api.js")).href);
  patchConfig({theme:"dark"});
  patchConfig({language:"fr"});
  patchConfig({theme:"light"});
  await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(requests.length,1);
  assert.deepEqual(JSON.parse(requests[0].body),{theme:"light",language:"fr"});
  await patchConfig({language:"en"},true);
  assert.equal(requests.length,2);
  assert.deepEqual(JSON.parse(requests[1].body),{language:"en"});
  assert.equal(requests[1].headers["If-Match"],'"revision"');
  console.log("PASS configuration : les modifications rapides sont fusionnees");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
