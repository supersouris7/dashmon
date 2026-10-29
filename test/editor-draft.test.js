"use strict";
const assert=require("assert");
const path=require("path");
const {pathToFileURL}=require("url");
async function main(){
  const {prepareEditorDraft}=await import(pathToFileURL(path.join(__dirname,"../public/js/editor-draft.js")).href);
  const draft={
    services:[{name:"Ancien"}],editDashboards:[{id:"main",name:"Principal"}],
    editCategories:[{name:"Divers",dashboardId:"main",color:"#aabbcc"}],
    editHosts:[{id:"host",name:"Machine",color:"#aabbcc",monitoring:{enabled:true,type:"local"}},
      {id:"other",name:"Autre",monitoring:{enabled:true,type:"local"}}],
    editServices:[{name:" Nouveau ",host:"Machine",category:"Divers"}],editWebLinks:[],editSpecialTile:null
  };
  const result=prepareEditorDraft(draft);
  assert.equal(result.services[0].name,"Nouveau");
  assert.equal(result.services[0].host,"Machine");
  assert.equal(result.hosts[1].monitoring.enabled,false);
  assert.equal(draft.editHosts[1].monitoring.enabled,true);
  assert.deepEqual(result.removedNames,["Ancien"]);
  assert.equal(result.categories[0].color,"#aabbcc");
  console.log("PASS editeur : preparation des brouillons sans mutation");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
