import { state } from "./state.js";
import { t } from "./i18n.js";

const REPO="https://github.com/supersouris7/dashmon";

function field(label,control){
  const result=document.createElement("label");
  result.className="host-monitor-field";
  const span=document.createElement("span");
  span.textContent=label;
  result.append(span,control);
  return result;
}
function hint(text){
  const result=document.createElement("p");
  result.className="host-monitor-hint";
  result.textContent=text;
  return result;
}
function help(introKey,scriptUrl,scriptKey,docUrl,docKey){
  const box=document.createElement("div");
  box.className="wireguard-help";
  const intro=document.createElement("p");
  intro.className="wireguard-help-text";
  intro.textContent=t(introKey);
  const links=document.createElement("p");
  links.className="wireguard-help-text";
  const script=document.createElement("a");
  script.href=scriptUrl;script.target="_blank";script.rel="noopener";script.textContent=t(scriptKey);
  const doc=document.createElement("a");
  doc.href=docUrl;doc.target="_blank";doc.rel="noopener";doc.textContent=t(docKey);
  links.append(script,document.createTextNode(" · "),doc);
  box.append(intro,links);
  return box;
}
function hostIndexes(){
  const result=[];
  state.editHosts.forEach((host,index)=>{if(host.monitoring?.enabled && host.monitoring.type==="local") result.push(index);});
  return result;
}
function hostBlock(host){
  const block=document.createElement("div");
  block.className="host-monitor-panel wireguard-editor-item";
  const head=document.createElement("div");
  head.className="wireguard-editor-head";
  const icon=document.createElement("i");
  icon.className=host.icon||"fa-solid fa-server";
  icon.setAttribute("aria-hidden","true");
  const name=document.createElement("span");
  name.textContent=host.name||t("hostName");
  head.append(icon,name);block.appendChild(head);
  return block;
}
function toggleButton(enabled,title,icon,onClick){
  const button=document.createElement("button");
  button.type="button";
  button.className="monitor-toggle "+(enabled ? "active" : "");
  button.title=title;
  button.setAttribute("aria-pressed",String(enabled));
  const symbol=document.createElement("i");
  symbol.className=icon;
  button.appendChild(symbol);
  button.addEventListener("click",onClick);
  return button;
}

export function renderWireguardEditor(){
  const list=document.getElementById("wireguardEditor");
  if(!list) return;
  list.replaceChildren(help("wireguardHelpIntro",REPO+"/raw/main/deploy/wireguard-dump.sh","wireguardHelpScript",REPO+"/blob/main/docs/WIREGUARD.md","wireguardHelpDoc"));
  const indexes=hostIndexes();
  if(!indexes.length){list.appendChild(hint(t("wireguardNoHost")));return;}
  indexes.forEach(index=>{
    const host=state.editHosts[index],prefs=host.monitoring.wireguard;
    const block=hostBlock(host);
    const toggle=toggleButton(prefs.enabled,prefs.enabled ? t("wireguardShowPeers") : t("wireguardHidden"),"fa-solid fa-shield-halved",()=>{
      prefs.enabled=!prefs.enabled;renderWireguardEditor();
    });
    block.appendChild(field(t("wireguardShowPeers"),toggle));
    const iface=document.createElement("input");
    iface.className="edit-input";iface.value=prefs.interface||"";iface.placeholder=t("phWireguardInterface");
    iface.addEventListener("input",()=>{prefs.interface=iface.value;});
    block.append(field(t("wireguardInterface"),iface),hint(t("wireguardLocalHint")));
    list.appendChild(block);
  });
}

export function renderSmartEditor(){
  const list=document.getElementById("smartEditor");
  if(!list) return;
  list.replaceChildren(help("smartHelpIntro",REPO+"/raw/main/deploy/smart-dump.sh","smartHelpScript",REPO+"/blob/main/docs/SMART.md","smartHelpDoc"));
  const indexes=hostIndexes();
  if(!indexes.length){list.appendChild(hint(t("smartNoHost")));return;}
  indexes.forEach(index=>{
    const host=state.editHosts[index],prefs=host.monitoring.smart;
    const block=hostBlock(host);
    const toggle=toggleButton(prefs.enabled,t("smartShowDisks"),"fa-solid fa-database",()=>{
      prefs.enabled=!prefs.enabled;renderSmartEditor();
    });
    block.appendChild(field(t("smartShowDisks"),toggle));
    const disks=document.createElement("input");
    disks.className="edit-input";disks.value=(prefs.disks||[]).join(", ");disks.placeholder=t("phSmartDisks");
    disks.addEventListener("input",()=>{prefs.disks=[...new Set(disks.value.split(",").map(value=>value.trim()).filter(Boolean))].slice(0,20);});
    block.appendChild(field(t("smartDisks"),disks));
    const metrics=Array.isArray(state.hostMetrics) ? state.hostMetrics.find(item=>item?.id===host.id) : null;
    const detected=Array.isArray(metrics?.smart) ? metrics.smart.map(item=>item?.device).filter(Boolean) : [];
    if(detected.length){
      const choices=document.createElement("div");choices.className="smart-disk-choices";
      const label=document.createElement("span");label.textContent=t("smartDetectedDisks");choices.appendChild(label);
      detected.forEach(device=>{
        const choice=document.createElement("button");
        const hasFilter=(prefs.disks||[]).length>0;
        const selected=!hasFilter || (prefs.disks||[]).includes(device);
        choice.type="button";choice.className="smart-disk-choice"+(selected ? " active" : "");
        choice.setAttribute("aria-pressed",String(selected));choice.textContent=device;
        choice.addEventListener("click",()=>{
          const current=prefs.disks||[];
          prefs.disks=!hasFilter ? detected.filter(value=>value!==device)
            : selected ? current.filter(value=>value!==device) : [...new Set([...current,device])].slice(0,20);
          renderSmartEditor();
        });
        choices.appendChild(choice);
      });
      block.appendChild(choices);
    }
    block.appendChild(hint(t("smartEditorHint")));
    list.appendChild(block);
  });
}
