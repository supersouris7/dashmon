// Couche API backend : lecture/écriture de la configuration (avec anti-rebond).
import { state } from "./state.js";

let configSaveTimer;
let configSaveChain=Promise.resolve();
let configPatchTimer;

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
      webLinksSeedVersion:state.webLinksSeedVersion,
      smallIcons:state.smallIcons,
      hostsDisplay:state.hostsDisplay,
      bannerIcon:state.bannerIcon,
      bannerUrl:state.bannerUrl,
      favicon:state.favicon,
      faviconEnabled:state.faviconEnabled
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

// Mise à jour partielle (PATCH) : pour les toggles/selects légers, évite
// d'écrire tout le config.json à chaque clic.
export function patchConfig(patch,immediate=false){
  clearTimeout(configPatchTimer);
  const run=()=>{
    const payload=JSON.stringify(patch);
    configSaveChain=configSaveChain
      .catch(()=>{})
      .then(async()=>{
        const response=await fetch("/api/config",{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:payload
        });
        if(!response.ok) throw new Error("HTTP "+response.status);
      })
      .catch(error=>console.error("Mise à jour de config.json impossible",error));
    return configSaveChain;
  };
  if(immediate) return run();
  configPatchTimer=setTimeout(run,150);
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

// Compteur de clics : incrément local + persistance légère compatible
// navigation de page (le gros PUT /api/config est interrompu au clic).
export function bumpUsage(key){
  if(!key) return;
  state.usageCounts[key]=Number(state.usageCounts[key]||0)+1;
  const payload=JSON.stringify({key});
  try{
    if(typeof navigator!=="undefined" && navigator.sendBeacon){
      navigator.sendBeacon("/api/usage",new Blob([payload],{type:"application/json"}));
    }else{
      fetch("/api/usage",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:payload,
        keepalive:true
      }).catch(()=>{});
    }
  }catch(_error){
    saveConfig(true);
  }
}
