// Sélecteur d'icônes Font Awesome utilisé dans l'éditeur (cartes, hôtes, liens web).
import { state, ICON_OPTIONS, sanitizeIconClass } from "./state.js";
import { t } from "./i18n.js";

function positionPicker(current,menu){
  requestAnimationFrame(()=>{
    const rect=current.getBoundingClientRect();
    const width=242;
    const height=Math.min(menu.scrollHeight||280,280);
    let left=rect.left;
    let top=rect.bottom+6;

    if(left+width>window.innerWidth-8) left=Math.max(8,window.innerWidth-width-8);
    if(top+height>window.innerHeight-8) top=Math.max(8,rect.top-height-6);

    menu.style.left=`${left}px`;
    menu.style.top=`${top}px`;
  });
}

function buildPicker(currentIcon,onSelect){
  const picker=document.createElement("div");
  picker.className="icon-picker";

  const current=document.createElement("button");
  current.className="icon-picker-current";
  current.type="button";
  current.title=t("chooseIcon");
  current.innerHTML=`<i class="${sanitizeIconClass(currentIcon)}"></i>`;

  const menu=document.createElement("div");
  menu.className="icon-picker-menu";

  ICON_OPTIONS.forEach(iconClass=>{
    const choice=document.createElement("button");
    choice.className="icon-choice";
    choice.type="button";
    choice.title=iconClass
      .replace(/^fa-(solid|brands) fa-/,"")
      .replaceAll("-"," ");
    choice.innerHTML=`<i class="${iconClass}"></i>`;
    choice.addEventListener("click",e=>{
      e.stopPropagation();
      onSelect(iconClass);
      current.innerHTML=`<i class="${iconClass}"></i>`;
      picker.classList.remove("open");
    });
    menu.appendChild(choice);
  });

  current.addEventListener("click",e=>{
    e.stopPropagation();
    document.querySelectorAll(".icon-picker.open").forEach(p=>{
      if(p!==picker) p.classList.remove("open");
    });

    const willOpen=!picker.classList.contains("open");
    picker.classList.toggle("open",willOpen);
    if(!willOpen) return;

    positionPicker(current,menu);
  });

  picker.append(current,menu);
  return picker;
}

export function createIconPicker(category,index){
  return buildPicker(category.icon||"fa-solid fa-folder",iconClass=>{
    state.editCategories[index].icon=iconClass;
  });
}

export function createHostIconPicker(host,index){
  return buildPicker(host.icon||"fa-solid fa-server",iconClass=>{
    state.editHosts[index].icon=iconClass;
  });
}

export function createWebLinkIconPicker(link,index){
  return buildPicker(link.icon||"fa-solid fa-globe",iconClass=>{
    state.editWebLinks[index].icon=iconClass;
  });
}
