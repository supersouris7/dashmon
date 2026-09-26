// Statut des services et métriques CPU/RAM des hôtes (boucles de rafraîchissement).
import { state, sanitizeIconClass } from "./state.js";
import { render, focusHostGroup, updateStatusIndicators } from "./render.js";
import { t } from "./i18n.js";
import { hostMetrics } from "./dom.js";

function renderHostMetrics(){
  if(!hostMetrics) return;

  const monitoredHosts=state.hosts.filter(host=>host.monitoring?.enabled===true);
  if(!monitoredHosts.length){
    hostMetrics.innerHTML="";
    hostMetrics.style.display="none";
    return;
  }

  const visibleHosts=monitoredHosts.slice(0,3);
  const needsRebuild=(hostMetrics.children.length!==visibleHosts.length)
    || [...hostMetrics.children].some((box,i)=>box.dataset?.host!==visibleHosts[i]?.name);

  if(needsRebuild || hostMetrics.dataset.built!=="1"){
    hostMetrics.dataset.built="1";
    hostMetrics.innerHTML="";
    hostMetrics.style.display="flex";

    visibleHosts.forEach(host=>{
      const box=document.createElement("div");
      box.className="host-metric";
      box.dataset.host=host.name;
      box.title=host.name;

      const name=document.createElement("div");
      name.className="host-metric-name";
      name.textContent=host.name;
      name.title=t("focusHost");

      const makeLine=(label,value)=>{
        const line=document.createElement("div");
        line.className="host-metric-line";

        const labelEl=document.createElement("span");
        labelEl.textContent=label;

        const bar=document.createElement("span");
        bar.className="host-metric-bar";

        const fill=document.createElement("span");
        fill.className="host-metric-fill";
        const numeric=Number(value);
        fill.style.width=Number.isFinite(numeric) ? `${Math.max(0,Math.min(100,numeric))}%` : "0%";
        bar.appendChild(fill);

        const val=document.createElement("span");
        val.className="host-metric-value";
        val.textContent=Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "—";

        line.append(labelEl,bar,val);
        return line;
      };

      box.append(name,makeLine("CPU",0),makeLine("RAM",0));
      box.addEventListener("click",()=>focusHostGroup(host.name));
      hostMetrics.appendChild(box);
    });
  }

  visibleHosts.forEach(host=>{
    const metric=state.hostMetricsData.find(item=>item.name===host.name);
    const box=[...hostMetrics.children].find(el=>el.dataset?.host===host.name);
    if(!box) return;

    box.className=`host-metric ${metric?.ok===false ? "error" : ""}`;
    box.title=metric?.error || host.name;

    const fills=box.querySelectorAll(".host-metric-fill");
    const values=box.querySelectorAll(".host-metric-value");
    const nameEl=box.querySelector(".host-metric-name");
    if(state.hostsDisplay==="icon" && host.icon){
      nameEl.innerHTML=`<i class="${sanitizeIconClass(host.icon)}"></i>`;
    }else{
      nameEl.textContent=host.name;
    }
    [["CPU",metric?.cpu],["RAM",metric?.ram]].forEach(([label,value],i)=>{
      const numeric=Number(value);
      const pct=Number.isFinite(numeric) ? Math.max(0,Math.min(100,numeric)) : 0;
      fills[i].style.width=`${pct}%`;
      fills[i].classList.toggle("critical",pct>=80);
      values[i].textContent=Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "—";
    });
  });
}

export async function refreshHostMetrics(){
  if(!state.hosts.some(host=>host.monitoring?.enabled===true)){
    state.hostMetricsData=[];
    renderHostMetrics();
    return;
  }

  renderHostMetrics();

  try{
    const response=await fetch("/api/host-metrics",{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);
    const data=await response.json();
    state.hostMetricsData=Array.isArray(data.hosts) ? data.hosts : [];
  }catch(error){
    state.hostMetricsData=state.hosts
      .filter(host=>host.monitoring?.enabled===true)
      .map(host=>({name:host.name,ok:false,error:error.message}));
  }

  renderHostMetrics();
}

async function refreshStatus(){
  try{
    const response=await fetch("/api/status",{cache:"no-store"});
    if(!response.ok) return;
    state.serviceStatus=await response.json();
    updateStatusIndicators();
  }catch(_error){}
}

export async function manualRefresh(){
  try{
    const response=await fetch("/api/refresh",{method:"POST",cache:"no-store"});
    if(!response.ok) return false;
    state.serviceStatus=await response.json();
    updateStatusIndicators();
    return true;
  }catch(_error){
    return false;
  }
}

function pageHidden(){
  return typeof document!=="undefined" && document.visibilityState==="hidden";
}

export function startStatusLoop(){
  refreshStatus();
  state.statusTimer=setInterval(()=>{ if(!pageHidden()) refreshStatus(); },60000);
}

export function startHostMetricsLoop(){
  refreshHostMetrics();
  clearInterval(state.hostMetricsTimer);
  state.hostMetricsTimer=setInterval(()=>{ if(!pageHidden()) refreshHostMetrics(); },15000);
}

export function setupVisibilityPause(){
  document.addEventListener("visibilitychange",()=>{
    if(!pageHidden()){
      refreshStatus();
      refreshHostMetrics();
    }
  });
}
