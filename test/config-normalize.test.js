"use strict";
const assert=require("assert");
const {createConfigNormalizer}=require("../lib/config-normalize");
const normalize=createConfigNormalizer({serializeWidget:value=>value||null,sanitizeReplication:value=>value||{}});
const config=normalize({
  dashboards:[{id:"first",name:"Principal"}],
  categories:[{name:"Divers",dashboardId:"first",color:"#AABBCC"}],
  hosts:[{id:"host",name:"Machine",monitoring:{type:"local",enabled:true}}],
  specialTile:{type:"fortune",category:"Divers"},
  webLinks:[{name:"Lien",url:"https://exemple.lan"}],
  usageCounts:{item:3.9},language:"fr"
});
assert.equal(config.categories[0].dashboardId,"first");
assert.equal(config.categories[0].color,"#aabbcc");
assert.equal(config.hosts[0].monitoring.enabled,true);
assert.equal(config.specialTile.type,"fortune");
assert.equal(config.webLinks[0].url,"https://exemple.lan/");
assert.equal(config.usageCounts.item,3);
assert.equal(config.language,"fr");
assert.equal(normalize({}).dashboards[0].id,"main");
console.log("PASS configuration : normalisation du tableau de bord");
