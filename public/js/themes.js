// Thèmes : chargement natifs/custom, application, import/export/suppression, menu de sélection.
import { state } from "./state.js";
import { t } from "./i18n.js";
import { patchConfig } from "./api.js";
import { themeSelect } from "./dom.js";

const NATIVE_LABEL_KEY={
  "dark":"dark",
  "light":"light",
  "black":"black",
  "matrix":"matrix",
  "rainbow-dark":"rainbow",
  "rainbow-light":"rainbowLight"
};

function themeLabel(theme){
  if(theme.native){
    const key=NATIVE_LABEL_KEY[theme.id];
    if(key) return t(key);
  }
  return theme.name || theme.id;
}

function allThemes(){
  return [...state.themes.native,...state.themes.custom];
}

function injectThemeStyles(theme){
  let style=document.querySelector(`style[data-theme-id="${theme.id}"]`);
  if(!style){
    style=document.createElement("style");
    style.dataset.themeId=theme.id;
    document.head.appendChild(style);
  }

  const vars=theme.variables||{};
  const cssVars=Object.entries(vars)
    .map(([key,value])=>`  --${key}:${value};`)
    .join("\n");

  style.textContent=`[data-theme="${theme.id}"]{\n${cssVars}\n}\n\n${theme.css||""}`;
}

function buildThemeSelect(){
  themeSelect.innerHTML="";

  state.themes.native.forEach(theme=>{
    const option=document.createElement("option");
    option.value=theme.id;
    option.textContent=themeLabel(theme);
    themeSelect.appendChild(option);
  });

  if(state.themes.custom.length){
    const group=document.createElement("optgroup");
    group.label=t("customThemes");
    state.themes.custom.forEach(theme=>{
      const option=document.createElement("option");
      option.value=theme.id;
      option.textContent=themeLabel(theme);
      group.appendChild(option);
    });
    themeSelect.appendChild(group);
  }
}

export function applyThemeLabels(){
  themeSelect.querySelectorAll("option").forEach(option=>{
    const theme=allThemes().find(theme=>theme.id===option.value);
    if(theme) option.textContent=themeLabel(theme);
  });
}

export async function loadThemes(){
  try{
    const response=await fetch("/api/themes",{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);
    const data=await response.json();
    state.themes={
      native:Array.isArray(data.native) ? data.native.map(t=>({...t,native:true})) : [],
      custom:Array.isArray(data.custom) ? data.custom.map(t=>({...t,native:false})) : []
    };
  }catch(error){
    console.error("Chargement des thèmes impossible",error);
    state.themes={native:[],custom:[]};
  }

  allThemes().forEach(injectThemeStyles);

  buildThemeSelect();

  const known=[...allThemes().map(theme=>theme.id),"dark"];
  if(!known.includes(state.theme)) state.theme="dark";

  applyTheme();
}

export function applyTheme(){
  document.documentElement.dataset.theme=state.theme;
  try{
    const theme=currentTheme();
    if(theme?.variables){
      const vars=Object.entries(theme.variables)
        .map(([key,value])=>`--${key}:${value};`)
        .join("");
      localStorage.setItem("dashmon.theme",state.theme);
      localStorage.setItem("dashmon.themeVars",vars);
    }
  }catch(_error){}
}

export function setTheme(nextTheme){
  state.theme=nextTheme;
  applyTheme();
  patchConfig({theme:state.theme});
}

export function currentTheme(){
  return allThemes().find(theme=>theme.id===state.theme) || null;
}

export function downloadTheme(theme){
  const payload={
    id:theme.id,
    name:theme.name||theme.id,
    author:theme.author||"",
    description:theme.description||"",
    version:theme.version||"1.0.0",
    variables:theme.variables||{},
    css:theme.css||""
  };
  const blob=new Blob([JSON.stringify(payload,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=`theme-${theme.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importThemeFile(file){
  const text=await file.text();
  const theme=normalizeTheme(JSON.parse(text));
  if(!theme) throw new Error("Thème invalide");

  const response=await fetch("/api/themes/import",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(theme)
  });
  if(!response.ok) throw new Error("HTTP "+response.status);

  await reloadThemeState();
  return theme;
}

export async function deleteCustomTheme(themeId){
  const response=await fetch(`/api/themes/${encodeURIComponent(themeId)}`,{method:"DELETE"});
  if(!response.ok) throw new Error("HTTP "+response.status);
  if(state.theme===themeId) state.theme="dark";
  await reloadThemeState();
  applyTheme();
  patchConfig({theme:state.theme});
}

async function reloadThemeState(){
  await loadThemes();
}

function normalizeTheme(input){
  if(!input || typeof input!=="object" || Array.isArray(input)) return null;

  const id=String(input.id||input.name||"").trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g,"-")
    .replace(/^-+|-+$/g,"");

  if(!id) return null;

  const variables=input.variables||{};
  const required=["bg","surface","surface-2","surface-3","border","text","muted","accent","danger","shadow"];
  const optional=["success","error"];
  const clean={};
  for(const key of required){
    if(typeof variables[key]==="string" && variables[key].trim()){
      clean[key]=variables[key].trim();
    }
  }

  if(Object.keys(clean).length!==required.length) return null;

  for(const key of optional){
    const value=variables[key];
    if(typeof value==="string" && value.trim()) clean[key]=value.trim().slice(0,40);
  }

  return {
    id,
    name:String(input.name||id).trim().slice(0,80),
    author:String(input.author||"").trim().slice(0,80),
    description:String(input.description||"").trim().slice(0,300),
    version:String(input.version||"1.0.0").trim().slice(0,20),
    variables:clean,
    css:typeof input.css==="string" ? input.css : ""
  };
}
