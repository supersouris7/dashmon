// Couche API backend : lecture/écriture de la configuration (avec anti-rebond).
import { state } from "./state.js";

let configSaveTimer;
let configSaveChain=Promise.resolve();

export function saveConfig(immediate=false){
  clearTimeout(configSaveTimer);

  const run=()=>{
    const payload=JSON.stringify({
      services:state.services,
      categories:state.categories,
      hosts:state.hosts,
      collapsed:state.collapsed,
      viewMode:state.viewMode,
      openMode:state.openMode,
      groupMode:state.groupMode,
      theme:state.theme,
      language:state.language,
      sortMode:state.sortMode,
      usageCounts:state.usageCounts,
      webLinks:state.webLinks,
      webLinksCollapsed:state.webLinksCollapsed,
      webLinksSeedVersion:state.webLinksSeedVersion
    });
    configSaveChain=configSaveChain
      .catch(()=>{})
      .then(async()=>{
        const response=await fetch("/api/config",{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:payload
        });
        if(!response.ok) throw new Error("HTTP "+response.status);
      })
      .catch(error=>console.error("Enregistrement de config.json impossible",error));
    return configSaveChain;
  };

  if(immediate) return run();
  configSaveTimer=setTimeout(run,120);
  return configSaveChain;
}

export async function fetchConfig(){
  const response=await fetch("/api/config",{cache:"no-store"});
  if(!response.ok) throw new Error("HTTP "+response.status);
  return response.json();
}

export async function putConfig(body){
  const response=await fetch("/api/config",{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  if(!response.ok) throw new Error("HTTP "+response.status);
}
