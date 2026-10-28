"use strict";
const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"dashmon-apt-test-"));
const bin=path.join(dir,"bin");
fs.mkdirSync(bin);
function executable(name,body){fs.writeFileSync(path.join(bin,name),body,{mode:0o755});}
executable("id",'#!/bin/sh\nprintf "0\\n"\n');
executable("apt-get",`#!/bin/sh
if [ "$1" = update ] && [ "$TEST_FAILURE" = update ]; then
  printf 'E: source https://exemple.lan/repo failed\\nE: problem "quoted" \\\\ path\\n' >&2
  exit 42
fi
if [ "$1" = -y ] && [ "$TEST_FAILURE" = upgrade ]; then
  printf 'E: upgrade failed\\n' >&2
  exit 100
fi
if [ "$1" = -s ]; then printf 'Inst package\\n'; fi
exit 0
`);
try{
  for(const mode of ["update","upgrade","success"]){
    const report=path.join(dir,mode+".json");
    const result=spawnSync("sh",[path.join(__dirname,"..","deploy","apt-updates.sh")],{
      env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,TEST_FAILURE:mode,DASHMON_APT_REPORT_FILE:report,TMPDIR:dir},encoding:"utf8"
    });
    assert.equal(result.status,0,result.stderr);
    const data=JSON.parse(fs.readFileSync(report,"utf8"));
    assert.equal(data.nextRunAt,data.finishedAt+168*3600,"prochain passage a 7 jours par defaut");
    if(mode==="success"){
      assert.equal(data.status,"success");
      assert.equal(data.updated,1);
      assert.equal(data.error,undefined);
    }else{
      assert.equal(data.status,"failed");
      assert.equal(data.failedStep,mode);
      assert.equal(data.exitCode,mode==="update" ? 42 : 100);
      assert.ok(data.error.includes(mode==="update" ? 'problem "quoted" \\ path' : "upgrade failed"));
      assert.ok(!data.error.includes("https://"));
    }
  }
  const custom=path.join(dir,"interval.json");
  const customResult=spawnSync("sh",[path.join(__dirname,"..","deploy","apt-updates.sh")],{
    env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,DASHMON_APT_REPORT_FILE:custom,TMPDIR:dir,DASHMON_APT_INTERVAL_HOURS:"24"},encoding:"utf8"
  });
  assert.equal(customResult.status,0,customResult.stderr);
  const customData=JSON.parse(fs.readFileSync(custom,"utf8"));
  assert.equal(customData.nextRunAt,customData.finishedAt+24*3600,"intervalle personnalise");
  console.log("PASS APT : étapes, codes, échappement et masquage des URL");
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
