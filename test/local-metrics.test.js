"use strict";
const assert=require("assert");
const {createLocalMetrics,clampPercent}=require("../lib/local-metrics");
let times={user:40,idle:60};
const system={
  cpus:()=>[{model:"CPU",times}],totalmem:()=>100,freemem:()=>25,
  type:()=>"Linux",release:()=>"test",arch:()=>"x64"
};
const filesystem={
  readdirSync:dir=>dir==="/sys/class/thermal" ? ["thermal_zone0"] : [],
  readFileSync:()=>"52500",
  statfsSync:()=>({blocks:100,bavail:30})
};
const metrics=createLocalMetrics({system,filesystem,sanitizeText:value=>value});
times={user:90,idle:110};
assert.equal(metrics.localCpuPercent(),50);
assert.equal(metrics.localCpuPercent(),null);
assert.equal(metrics.localRamPercent(),75);
assert.equal(metrics.localDiskPercent("/"),70);
assert.equal(metrics.localTemperature(),52.5);
assert.equal(metrics.localSystemDetails().cpuModel,"CPU");
assert.equal(clampPercent(120),100);
assert.equal(clampPercent(NaN),null);
console.log("PASS supervision : mesures locales isolees et testables");
