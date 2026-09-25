// Éditeur de configuration : services, catégories, hôtes, liens web, import/export config.
import { state, clone, normalize, normalizeConfig, compareNames } from "./state.js";
import { t, applyLanguage } from "./i18n.js";
import { saveConfig, putConfig, fetchConfig } from "./api.js";
import { render, updateViewButton, updateOpenModeMenu, updateGroupModeMenu, updateSortModeMenu, applyBanner, applyFavicon } from "./render.js";
import { applyTheme } from "./themes.js";
import { refreshHostMetrics } from "./metrics.js";
import { openImageLibrary, renderImageManager } from "./images.js";
import { createIconPicker, createHostIconPicker, createWebLinkIconPicker } from "./icons.js";
import {
  serviceEditor, categoryEditor, hostEditor, webLinksEditor,
  editorSearch, editorCategoryFilter, editorHostFilter,
  modalBackdrop, closeBtn, cancelBtn, saveBtn,
  addServiceBtn, addCategoryBtn, addWebLinkBtn, addHostBtn,
  exportConfigBtn, importConfigBtn, configImportInput,
  widgetConfig, widgetConfigBody, widgetConfigCloseBtn
} from "./dom.js";

function moveItem(list,fromIndex,toIndex){
  if(fromIndex===toIndex) return;
  const [item]=list.splice(fromIndex,1);
  list.splice(toIndex,0,item);
}

function makeDraggable(row,list,index,rerender){
  row.draggable=true;

  row.addEventListener("dragstart",e=>{
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",String(index));
  });

  row.addEventListener("dragend",()=>{
    row.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(el=>el.classList.remove("drag-over"));
  });

  row.addEventListener("dragover",e=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    row.classList.add("drag-over");
  });

  row.addEventListener("dragleave",()=>{
    row.classList.remove("drag-over");
  });

  row.addEventListener("drop",e=>{
    e.preventDefault();
    row.classList.remove("drag-over");

    const fromIndex=Number(e.dataTransfer.getData("text/plain"));
    if(!Number.isInteger(fromIndex) || fromIndex<0 || fromIndex>=list.length) return;

    moveItem(list,fromIndex,index);
    rerender();
  });
}

function refreshEditorCategoryFilter(){
  const current=editorCategoryFilter.value;
  const names=[...new Set(state.editCategories.map(c=>c.name).filter(Boolean))];
  editorCategoryFilter.innerHTML=`<option value="">${t("allCategories")}</option>`;
  names.forEach(name=>{
    const option=document.createElement("option");
    option.value=name;
    option.textContent=name;
    editorCategoryFilter.appendChild(option);
  });
  editorCategoryFilter.value=names.includes(current) ? current : "";
}

function getEditorHostNames(){
  const names=[];
  const seen=new Set();

  const addName=value=>{
    const name=(value||"").trim();
    if(!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  state.editHosts.forEach(host=>addName(host.name));
  state.editServices.forEach(service=>addName(service.host));
  return names;
}

function refreshEditorHostFilter(){
  const current=editorHostFilter.value;
  editorHostFilter.innerHTML="";

  const allOption=document.createElement("option");
  allOption.value="";
  allOption.textContent=t("allHosts");
  editorHostFilter.appendChild(allOption);

  getEditorHostNames().forEach(hostName=>{
    const option=document.createElement("option");
    option.value=hostName;
    option.textContent=hostName;
    editorHostFilter.appendChild(option);
  });

  editorHostFilter.value=[...editorHostFilter.options].some(option=>option.value===current)
    ? current
    : "";
}

export function renderServiceEditor(){
  serviceEditor.innerHTML="";
  refreshEditorCategoryFilter();
  refreshEditorHostFilter();
  const search=normalize(editorSearch.value);
  const categoryFilter=editorCategoryFilter.value;
  const hostFilter=editorHostFilter.value;

  const hostNames=getEditorHostNames();

  const sortedServices=state.editServices
    .map((service,index)=>({service,index}))
    .sort((a,b)=>compareNames(a.service.name,b.service.name));

  sortedServices.forEach(({service,index})=>{
    if(search && !normalize(service.name).includes(search)) return;
    if(categoryFilter && (service.category||"Autres")!==categoryFilter) return;
    if(hostFilter && (service.host||"")!==hostFilter) return;
    const row=document.createElement("div");
    row.className="service-row";
    row._serviceRef=service;

    const name=document.createElement("input");
    name.className="edit-input";
    name.placeholder=t("nameLabel");
    name.value=service.name||"";
    name.addEventListener("input",()=>state.editServices[index].name=name.value);

    const host=document.createElement("select");
    host.className="edit-select";
    host.title=t("hostLabel");

    const currentHost=(service.host||"").trim();

    const noHostOption=document.createElement("option");
    noHostOption.value="";
    noHostOption.textContent=t("noHost");
    host.appendChild(noHostOption);

    hostNames.forEach(hostName=>{
      const option=document.createElement("option");
      option.value=hostName;
      option.textContent=hostName;
      host.appendChild(option);
    });

    host.value=currentHost;
    if(host.value!==currentHost){
      const fallback=document.createElement("option");
      fallback.value=currentHost;
      fallback.textContent=currentHost;
      host.appendChild(fallback);
      host.value=currentHost;
    }

    host.addEventListener("change",()=>{
      state.editServices[index].host=host.value;
    });

    const category=document.createElement("select");
    category.className="edit-select";
    const categoryNames=[...new Set([
      ...state.editCategories.map(c=>c.name).filter(Boolean),
      service.category||"Autres"
    ])];
    categoryNames.forEach(categoryName=>{
      const option=document.createElement("option");
      option.value=categoryName;
      option.textContent=categoryName;
      if(categoryName===(service.category||"Autres")) option.selected=true;
      category.appendChild(option);
    });
    category.addEventListener("change",()=>state.editServices[index].category=category.value);

    const url=document.createElement("input");
    url.className="edit-input";
    url.placeholder=t("urlLabel");
    url.value=service.url||"";
    url.addEventListener("input",()=>state.editServices[index].url=url.value);

    const iconField=document.createElement("div");
    iconField.className="image-field icon-only-field";

    const chooseIcon=document.createElement("button");
    chooseIcon.className="image-library-btn";
    chooseIcon.type="button";
    chooseIcon.title=t("choosePng");

    if(service.icon){
      const preview=document.createElement("img");
      preview.src=service.icon;
      preview.alt="";
      preview.className="editor-icon-preview";
      preview.onerror=()=>{
        chooseIcon.innerHTML='<i class="fa-solid fa-image"></i>';
      };
      chooseIcon.appendChild(preview);
    }else{
      chooseIcon.innerHTML='<i class="fa-solid fa-image"></i>';
    }

    chooseIcon.addEventListener("click",()=>openImageLibrary(value=>{
      state.editServices[index].icon=value;
      renderServiceEditor();
    }));

    iconField.append(chooseIcon);

    const monitor=document.createElement("button");
    monitor.className=`monitor-toggle ${service.monitor!==false ? "active" : ""} ${service.monitor==="soft" ? "soft" : ""}`;
    monitor.type="button";
    monitor.title=service.monitor===false
      ? t("monitorDisabled")
      : service.monitor==="soft" ? t("monitorSoft") : t("monitorEnabled");
    monitor.innerHTML=service.monitor==="soft"
      ? '<i class="fa-solid fa-eye"></i>'
      : '<i class="fa-solid fa-heart-pulse"></i>';
    monitor.addEventListener("click",()=>{
      const current=state.editServices[index].monitor;
      state.editServices[index].monitor=current===false ? true : current==="soft" ? false : "soft";
      renderServiceEditor();
    });

    const remove=document.createElement("button");
    remove.className="small-icon-btn delete-btn";
    remove.type="button";
    remove.title=t("deleteLabel");
    remove.innerHTML='<i class="fa-solid fa-trash"></i>';
    remove.addEventListener("click",()=>{
      state.editServices.splice(index,1);
      renderServiceEditor();
    });

    const actions=document.createElement("div");
    actions.className="service-actions";
    actions.append(iconField,monitor,remove);

    const widgetWrap=document.createElement("div");
    widgetWrap.className="service-widget";

    const widgetType=document.createElement("select");
    widgetType.className="edit-select widget-type";
    widgetType.title=t("widgetLabel");
    [["",t("widgetStandard")],["duplicati",t("widgetDuplicati")],["lichess",t("widgetLichess")],["adguard",t("widgetAdGuard")]].forEach(([value,label])=>{
      const option=document.createElement("option");
      option.value=value;
      option.textContent=label;
      widgetType.appendChild(option);
    });
    widgetType.value=service.widget?.type==="duplicati" ? "duplicati"
      : service.widget?.type==="lichess" ? "lichess" : service.widget?.type==="adguard" ? "adguard" : "";
    widgetType.addEventListener("change",()=>{
      state.editServices[index].widget=widgetType.value==="duplicati"
        ? {type:"duplicati",password:(service.widget&&service.widget.password)||""}
        : widgetType.value==="lichess"
          ? {type:"lichess",username:(service.widget&&service.widget.username)||""}
          : widgetType.value==="adguard"
            ? {type:"adguard",
               username:(service.widget&&service.widget.username)||"",
               password:(service.widget&&service.widget.password)||""}
            : null;
      renderServiceEditor();
    });
    widgetWrap.appendChild(widgetType);

    const widgetConfigBtn=document.createElement("button");
    widgetConfigBtn.type="button";
    widgetConfigBtn.className="small-icon-btn widget-config-btn"+(service.widget ? "" : " disabled");
    widgetConfigBtn.title=service.widget ? t("widgetConfigTitle") : "";
    widgetConfigBtn.innerHTML='<i class="fa-solid fa-ellipsis"></i>';
    widgetConfigBtn.addEventListener("click",()=>{
      if(service.widget){
        openWidgetConfig(index);
      }
    });
    widgetWrap.appendChild(widgetConfigBtn);

    row.append(name,host,category,url,actions,widgetWrap);
    serviceEditor.appendChild(row);
  });
}

let widgetConfigIndex=-1;

export function openWidgetConfig(index){
  widgetConfigIndex=index;
  renderWidgetConfig();
  widgetConfig.classList.add("show");
  widgetConfig.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

export function closeWidgetConfig(){
  widgetConfig.classList.remove("show");
  widgetConfig.setAttribute("aria-hidden","true");
  widgetConfigIndex=-1;
  document.body.classList.remove("modal-open");
}

function renderWidgetConfig(){
  widgetConfigBody.innerHTML="";
  const service=state.editServices[widgetConfigIndex];
  if(!service||!service.widget) return;

  if(service.widget.type==="duplicati"){
    const helper=document.createElement("label");
    helper.className="widget-cfg-field";
    const helperLabel=document.createElement("span");
    helperLabel.textContent=t("widgetDuplicatiPassword");
    helper.appendChild(helperLabel);
    const password=document.createElement("input");
    password.className="edit-input";
    password.type="password";
    password.autocomplete="new-password";
    const secret=service.widget.password||"";
    const secured=secret.startsWith("aes1.");
    password.placeholder=secured ? t("passwordConfigured") : t("duplicatiPasswordPlaceholder");
    password.value=secured ? "" : secret;
    password.addEventListener("input",()=>{
      if(state.editServices[widgetConfigIndex]?.widget && password.value){
        state.editServices[widgetConfigIndex].widget.password=password.value;
      }
    });
    helper.appendChild(password);
    widgetConfigBody.appendChild(helper);
    return;
  }

  if(service.widget.type==="lichess"){
    const helper=document.createElement("label");
    helper.className="widget-cfg-field";
    const helperLabel=document.createElement("span");
    helperLabel.textContent=t("widgetLichess");
    helper.appendChild(helperLabel);
    const username=document.createElement("input");
    username.className="edit-input";
    username.type="text";
    username.autocomplete="off";
    username.placeholder=t("widgetLichessPlaceholder");
    username.value=service.widget.username||"";
    username.addEventListener("input",()=>{
      if(state.editServices[widgetConfigIndex]?.widget){
        state.editServices[widgetConfigIndex].widget.username=username.value;
      }
    });
    helper.appendChild(username);

    const variantWrap=document.createElement("label");
    variantWrap.className="widget-cfg-field";
    const variantLabel=document.createElement("span");
    variantLabel.textContent=t("widgetLichessVariant");
    variantWrap.appendChild(variantLabel);
    const variant=document.createElement("select");
    variant.className="edit-select";
    [["",t("widgetLichessAuto")],["classical",t("widgetLichessClassical")],
     ["rapid",t("widgetLichessRapid")],["blitz",t("widgetLichessBlitz")]].forEach(([value,label])=>{
      const option=document.createElement("option");
      option.value=value;
      option.textContent=label;
      variant.appendChild(option);
    });
    variant.value=service.widget.variant||"";
    variant.addEventListener("change",()=>{
      if(state.editServices[widgetConfigIndex]?.widget){
        state.editServices[widgetConfigIndex].widget.variant=variant.value;
      }
    });
    variantWrap.appendChild(variant);
    widgetConfigBody.append(helper,variantWrap);
    return;
  }

  if(service.widget.type==="adguard"){
    const userField=document.createElement("label");
    userField.className="widget-cfg-field";
    const userLabel=document.createElement("span");
    userLabel.textContent=t("widgetAdGuardUsername");
    userField.appendChild(userLabel);
    const username=document.createElement("input");
    username.className="edit-input";
    username.type="text";
    username.autocomplete="off";
    username.placeholder=t("widgetAdGuardUsername");
    username.value=service.widget.username||"";
    username.addEventListener("input",()=>{
      if(state.editServices[widgetConfigIndex]?.widget){
        state.editServices[widgetConfigIndex].widget.username=username.value;
      }
    });
    userField.appendChild(username);

    const passField=document.createElement("label");
    passField.className="widget-cfg-field";
    const passLabel=document.createElement("span");
    passLabel.textContent=t("widgetAdGuardPassword");
    passField.appendChild(passLabel);
    const password=document.createElement("input");
    password.className="edit-input";
    password.type="password";
    password.autocomplete="new-password";
    const secret=service.widget.password||"";
    const secured=secret.startsWith("aes1.");
    password.placeholder=secured ? t("passwordConfigured") : t("duplicatiPasswordPlaceholder");
    password.value=secured ? "" : secret;
    password.addEventListener("input",()=>{
      if(state.editServices[widgetConfigIndex]?.widget && password.value){
        state.editServices[widgetConfigIndex].widget.password=password.value;
      }
    });
    passField.appendChild(password);

    widgetConfigBody.append(userField,passField);
    return;
  }
}

export function renderWebLinksEditor(){
  webLinksEditor.innerHTML="";
  state.editWebLinks.forEach((link,index)=>{
    const row=document.createElement("div");
    row.className="web-link-row";
    row.draggable=true;

    const drag=document.createElement("div");
    drag.className="drag-handle";
    drag.innerHTML='<i class="fa-solid fa-grip-vertical"></i>';

    const name=document.createElement("input");
    name.className="edit-input";
    name.placeholder=t("nameLabel");
    name.value=link.name||"";
    name.addEventListener("input",()=>state.editWebLinks[index].name=name.value);

    const url=document.createElement("input");
    url.className="edit-input web-link-url";
    url.placeholder="https://...";
    url.value=link.url||"";
    url.addEventListener("input",()=>state.editWebLinks[index].url=url.value);

    const iconPicker=createWebLinkIconPicker(link,index);

    const del=document.createElement("button");
    del.className="small-icon-btn delete-btn";
    del.type="button";
    del.title=t("deleteLabel");
    del.innerHTML='<i class="fa-solid fa-trash"></i>';
    del.addEventListener("click",()=>{
      state.editWebLinks.splice(index,1);
      renderWebLinksEditor();
    });

    row.addEventListener("dragstart",e=>{
      e.dataTransfer.setData("text/plain",String(index));
      e.dataTransfer.effectAllowed="move";
    });
    row.addEventListener("dragover",e=>e.preventDefault());
    row.addEventListener("drop",e=>{
      e.preventDefault();
      const from=Number(e.dataTransfer.getData("text/plain"));
      if(Number.isNaN(from) || from===index) return;
      moveItem(state.editWebLinks,from,index);
      renderWebLinksEditor();
    });

    row.append(drag,name,url,iconPicker,del);
    webLinksEditor.appendChild(row);
  });
}

export function renderCategoryEditor(){
  categoryEditor.innerHTML="";

  state.editCategories.forEach((category,index)=>{
    const row=document.createElement("div");
    row.className="category-row";

    const drag=document.createElement("div");
    drag.className="drag-handle";
    drag.title=t("move");
    drag.innerHTML='<i class="fa-solid fa-grip-vertical"></i>';

    const name=document.createElement("input");
    name.className="edit-input";
    name.placeholder=t("categoryName");
    name.value=category.name||"";

    const originalName=category.name||"";
    name.addEventListener("input",()=>{
      const previous=state.editCategories[index].name;
      const next=name.value;
      state.editCategories[index].name=next;
      state.editServices.forEach(service=>{
        if(service.category===previous || (previous===originalName && service.category===originalName)){
          service.category=next;
        }
      });
    });

    const picker=createIconPicker(category,index);

    const remove=document.createElement("button");
    remove.className="small-icon-btn delete-btn";
    remove.type="button";
    remove.title=t("deleteLabel");
    remove.innerHTML='<i class="fa-solid fa-trash"></i>';
    remove.addEventListener("click",()=>{
      const removedName=state.editCategories[index].name;
      state.editCategories.splice(index,1);
      state.editServices.forEach(service=>{
        if(service.category===removedName) service.category="Autres";
      });
      renderCategoryEditor();
      renderServiceEditor();
    });

    row.append(drag,name,picker,remove);
    makeDraggable(row,state.editCategories,index,renderCategoryEditor);
    categoryEditor.appendChild(row);
  });
}

export function renderHostEditor(){
  hostEditor.innerHTML="";

  state.editHosts.forEach((host,index)=>{
    host.monitoring=host.monitoring && typeof host.monitoring==="object"
      ? host.monitoring
      : {enabled:false,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:"",tokenId:"",tokenSecret:""};

    const row=document.createElement("div");
    row.className="host-row";

    const drag=document.createElement("div");
    drag.className="drag-handle";
    drag.title=t("move");
    drag.innerHTML='<i class="fa-solid fa-grip-vertical"></i>';

    const name=document.createElement("input");
    name.className="edit-input";
    name.placeholder=t("hostName");
    name.value=host.name||"";
    name.addEventListener("input",()=>{
      const previous=state.editHosts[index].name;
      const next=name.value;
      state.editHosts[index].name=next;
      state.editServices.forEach(service=>{
        if(service.host===previous) service.host=next;
      });
      renderServiceEditor();
    });

    const picker=createHostIconPicker(host,index);

    const monitor=document.createElement("button");
    monitor.className=`monitor-toggle host-monitor-toggle ${host.monitoring.enabled ? "active" : ""}`;
    monitor.type="button";
    monitor.title=host.monitoring.enabled ? t("hostMonitoringEnabled") : t("hostMonitoringDisabled");
    monitor.innerHTML='<i class="fa-solid fa-chart-simple"></i>';
    monitor.addEventListener("click",()=>{
      state.editHosts[index].monitoring.enabled=!state.editHosts[index].monitoring.enabled;
      renderHostEditor();
    });

    const type=document.createElement("select");
    type.className="edit-select host-monitor-type";
    type.title=t("hostMonitoringType");
    [
      ["local",t("hostTypeLocal")],
      ["linux",t("hostTypeLinux")],
      ["proxmox",t("hostTypeProxmox")]
    ].forEach(([value,label])=>{
      const option=document.createElement("option");
      option.value=value;
      option.textContent=label;
      type.appendChild(option);
    });
    type.value=host.monitoring.type||"local";

    const params=document.createElement("div");
    params.className="host-params";

    const auth=document.createElement("div");
    auth.className="host-auth";

    const url=document.createElement("input");
    url.className="edit-input";
    url.value=host.monitoring.url||"";

    const node=document.createElement("input");
    node.className="edit-input";
    node.value=host.monitoring.node||"";

    const tokenEnv=document.createElement("input");
    tokenEnv.className="edit-input";
    tokenEnv.value=host.monitoring.tokenEnv||"";

    const tokenIdEnv=document.createElement("input");
    tokenIdEnv.className="edit-input";
    tokenIdEnv.value=host.monitoring.tokenId||host.monitoring.tokenIdEnv||"";

    const tokenSecretEnv=document.createElement("input");
    tokenSecretEnv.className="edit-input";
    tokenSecretEnv.value=host.monitoring.tokenSecret||host.monitoring.tokenSecretEnv||"";

    const updateTypeFields=()=>{
      params.innerHTML="";
      auth.innerHTML="";
      const currentType=type.value;

      if(currentType==="local"){
        const none=document.createElement("span");
        none.className="host-no-params";
        none.textContent=t("noParameters");
        params.appendChild(none);

        const localAuth=document.createElement("span");
        localAuth.className="host-no-params";
        localAuth.textContent=t("noAuthentication");
        auth.appendChild(localAuth);
        return;
      }

      if(currentType==="proxmox"){
        url.placeholder=t("proxmoxUrl");
        url.title=t("proxmoxUrl");
        tokenIdEnv.placeholder=t("proxmoxTokenIdEnv");
        tokenIdEnv.title=t("proxmoxTokenIdEnv");
        tokenSecretEnv.placeholder=t("proxmoxTokenSecretEnv");
        tokenSecretEnv.title=t("proxmoxTokenSecretEnv");
        params.appendChild(url);
        auth.append(tokenIdEnv,tokenSecretEnv);
        return;
      }

      url.placeholder=t("metricsUrl");
      url.title=t("metricsUrl");
      tokenEnv.placeholder=t("bearerTokenEnv");
      tokenEnv.title=t("bearerTokenEnv");
      params.appendChild(url);
      auth.appendChild(tokenEnv);
    };
    updateTypeFields();

    type.addEventListener("change",()=>{
      state.editHosts[index].monitoring.type=type.value;
      updateTypeFields();
      refreshEditorHostFilter();
    });
    url.addEventListener("input",()=>state.editHosts[index].monitoring.url=url.value);
    node.addEventListener("input",()=>state.editHosts[index].monitoring.node=node.value);
    tokenEnv.addEventListener("input",()=>state.editHosts[index].monitoring.tokenEnv=tokenEnv.value);
    tokenIdEnv.addEventListener("input",()=>{state.editHosts[index].monitoring.tokenIdEnv=tokenIdEnv.value;state.editHosts[index].monitoring.tokenId="";});
    tokenSecretEnv.addEventListener("input",()=>{state.editHosts[index].monitoring.tokenSecretEnv=tokenSecretEnv.value;state.editHosts[index].monitoring.tokenSecret="";});

    const remove=document.createElement("button");
    remove.className="small-icon-btn delete-btn";
    remove.type="button";
    remove.title=t("deleteLabel");
    remove.innerHTML='<i class="fa-solid fa-trash"></i>';
    remove.addEventListener("click",()=>{
      const removedName=state.editHosts[index].name;
      state.editHosts.splice(index,1);
      state.editServices.forEach(service=>{
        if(service.host===removedName) service.host="";
      });
      if(editorHostFilter.value===removedName) editorHostFilter.value="";
      renderHostEditor();
      renderServiceEditor();
    });

    row.append(drag,name,picker,monitor,type,params,auth,remove);
    makeDraggable(row,state.editHosts,index,()=>{
      renderHostEditor();
      renderServiceEditor();
    });
    hostEditor.appendChild(row);
  });
}

export function openEditor(){
  const rect=document.querySelector(".toolbar").getBoundingClientRect();
  document.documentElement.style.setProperty("--toolbar-h",Math.max(0,rect.bottom)+"px");
  state.editServices=clone(state.services);
  state.editCategories=clone(state.categories);
  state.editHosts=clone(state.hosts);
  state.editWebLinks=clone(state.webLinks);
  editorSearch.value="";
  editorCategoryFilter.value="";
  editorHostFilter.value="";
  renderServiceEditor();
  renderCategoryEditor();
  renderHostEditor();
  renderWebLinksEditor();
  modalBackdrop.classList.add("show");
  modalBackdrop.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

export function closeEditor(){
  modalBackdrop.classList.remove("show");
  modalBackdrop.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  closeWidgetConfig();
  document.querySelectorAll(".icon-picker.open").forEach(p=>p.classList.remove("open"));
}

widgetConfigCloseBtn.addEventListener("click",closeWidgetConfig);
widgetConfig.addEventListener("click",e=>{
  if(e.target===widgetConfig) closeWidgetConfig();
});

addServiceBtn.addEventListener("click",()=>{
  const newService={
    name:"",
    host:"",
    category:state.editCategories[0]?.name||"Autres",
    url:"",
    icon:"",
    monitor:true,
    widget:null
  };
  state.editServices.push(newService);
  renderServiceEditor();

  requestAnimationFrame(()=>{
    const rows=[...serviceEditor.querySelectorAll(".service-row")];
    const row=rows.find(item=>item._serviceRef===newService);
    const input=row?.querySelector(".edit-input");
    if(input){
      input.focus();
      input.select();
    }
  });
});

addCategoryBtn.addEventListener("click",()=>{
  const newCategory={name:"",icon:"fa-solid fa-folder"};
  state.editCategories.push(newCategory);
  renderCategoryEditor();
  renderServiceEditor();

  requestAnimationFrame(()=>{
    const rows=[...categoryEditor.querySelectorAll(".category-row")];
    const row=rows[rows.length-1];
    const input=row?.querySelector(".edit-input");
    if(input){
      input.focus();
      input.select();
    }
  });
});

addWebLinkBtn.addEventListener("click",()=>{
  state.editWebLinks.push({name:"",url:"",icon:"fa-solid fa-globe"});
  renderWebLinksEditor();
  requestAnimationFrame(()=>{
    const rows=[...webLinksEditor.querySelectorAll(".web-link-row")];
    rows[rows.length-1]?.querySelector(".edit-input")?.focus();
  });
});

addHostBtn.addEventListener("click",()=>{
  const newHost={name:t("newHost"),icon:"fa-solid fa-server",monitoring:{enabled:true,type:"local",url:"",node:"",tokenEnv:"",tokenIdEnv:"",tokenSecretEnv:"",tokenId:"",tokenSecret:""}};
  state.editHosts.push(newHost);
  renderHostEditor();
  renderServiceEditor();

  requestAnimationFrame(()=>{
    const rows=[...hostEditor.querySelectorAll(".host-row")];
    const row=rows[rows.length-1];
    const input=row?.querySelector(".edit-input");
    if(input){
      input.focus();
      input.select();
    }
  });
});

importConfigBtn.addEventListener("click",()=>configImportInput.click());

configImportInput.addEventListener("change",async()=>{
  const file=configImportInput.files && configImportInput.files[0];
  configImportInput.value="";
  if(!file) return;

  try{
    const text=await file.text();
    const raw=JSON.parse(text);
    const imported=normalizeConfig(raw);

    if(!Array.isArray(raw.services) || !Array.isArray(raw.categories)){
      throw new Error("Structure invalide");
    }

    await putConfig(imported);

    state.services=clone(imported.services);
    state.categories=clone(imported.categories);
    state.hosts=clone(imported.hosts);
    state.collapsed={...imported.collapsed};
    state.viewMode=imported.viewMode;
    state.openMode=imported.openMode;
    state.groupMode=imported.groupMode;
    state.theme=imported.theme;
    state.language=imported.language;
    state.sortMode=imported.sortMode;
    state.usageCounts={...imported.usageCounts};
    state.webLinks=clone(imported.webLinks);
    state.webLinksCollapsed=imported.webLinksCollapsed;
    state.smallIcons=imported.smallIcons;
    state.hostsDisplay=imported.hostsDisplay;
    state.bannerIcon=imported.bannerIcon;
    state.bannerUrl=imported.bannerUrl;
    state.favicon=imported.favicon;
    state.faviconEnabled=imported.faviconEnabled!==false;

    state.editServices=clone(state.services);
    state.editCategories=clone(state.categories);
    state.editHosts=clone(state.hosts);
    state.editWebLinks=clone(state.webLinks);

    applyTheme();
    applyBanner();
    applyFavicon();
    applyLanguage();
    updateViewButton();
    updateOpenModeMenu();
    updateGroupModeMenu();
    updateSortModeMenu();
    renderServiceEditor();
    renderCategoryEditor();
    renderHostEditor();
    renderWebLinksEditor();
    render();
    refreshHostMetrics();
  }catch(error){
    console.error("Import de configuration impossible",error);
    alert("Fichier de configuration invalide.");
  }
});

exportConfigBtn.addEventListener("click",async()=>{
  try{
    const config=await fetchConfig();
    const blob=new Blob([JSON.stringify(config,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="dashmon-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }catch(error){
    console.error("Export de la configuration impossible",error);
    alert("Export de la configuration impossible.");
  }
});

document.querySelectorAll(".edit-tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".edit-tab").forEach(elm=>elm.classList.remove("active"));
    document.querySelectorAll(".edit-panel").forEach(panel=>panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.panel).classList.add("active");
    if(tab.dataset.panel==="imagesPanel") renderImageManager();
  });
});

closeBtn.addEventListener("click",closeEditor);
cancelBtn.addEventListener("click",closeEditor);
modalBackdrop.addEventListener("click",e=>{
  if(e.target===modalBackdrop) closeEditor();
});

saveBtn.addEventListener("click",async()=>{
  const cleanedCategories=state.editCategories
    .map(c=>({name:(c.name||"").trim(),icon:c.icon||"fa-solid fa-folder"}))
    .filter(c=>c.name);

  const splitToken=(value)=>{
    const trimmed=String(value||"").trim();
    return /^[A-Z_][A-Z0-9_]*$/.test(trimmed)
      ? {alias:trimmed, literal:""}
      : {alias:"", literal:trimmed};
  };

  const cleanedHosts=state.editHosts
    .map(h=>{
      const tokenId=splitToken(h.monitoring?.tokenId||h.monitoring?.tokenIdEnv);
      const tokenSecret=splitToken(h.monitoring?.tokenSecret||h.monitoring?.tokenSecretEnv);
      return {
      name:(h.name||"").trim(),
      icon:h.icon||"fa-solid fa-server",
      monitoring:{
        enabled:h.monitoring?.enabled===true,
        type:["local","linux","proxmox"].includes(h.monitoring?.type) ? h.monitoring.type : "local",
        url:(h.monitoring?.url||"").trim(),
        node:(h.monitoring?.node||"").trim(),
        tokenEnv:(h.monitoring?.tokenEnv||"").trim(),
        tokenIdEnv:tokenId.alias,
        tokenSecretEnv:tokenSecret.alias,
        tokenId:tokenId.literal,
        tokenSecret:tokenSecret.literal
      }
    };
    })
    .filter(h=>h.name);

  const validNames=new Set(cleanedCategories.map(c=>c.name));
  const validHosts=new Set(cleanedHosts.map(h=>h.name));

  const cleanedServices=state.editServices
    .map(service=>({
      name:(service.name||"").trim(),
      host:validHosts.has((service.host||"").trim()) ? (service.host||"").trim() : "",
      category:validNames.has(service.category) ? service.category : (cleanedCategories[0]?.name||"Autres"),
      url:(service.url||"").trim(),
      icon:(service.icon||"").trim(),
      monitor:service.monitor===false ? false : service.monitor==="soft" ? "soft" : true,
      widget:service.widget&&service.widget.type==="duplicati"
        ? {type:"duplicati",password:String(service.widget.password||"").slice(0,2000)}
        : service.widget&&service.widget.type==="lichess"
          ? {type:"lichess",username:String(service.widget.username||"").slice(0,200),
             variant:String(service.widget.variant||"").slice(0,50)}
          : service.widget&&service.widget.type==="adguard"
            ? {type:"adguard",
               username:String(service.widget.username||"").slice(0,200),
               password:String(service.widget.password||"").slice(0,2000)}
            : null
    }))
    .filter(service=>service.name);

  const cleanedWebLinks=state.editWebLinks
    .map(link=>({
      name:(link.name||"").trim(),
      url:(link.url||"").trim(),
      icon:(link.icon||"").trim()
    }))
    .filter(link=>link.name && link.url);

  state.services=cleanedServices;
  state.categories=cleanedCategories;
  state.hosts=cleanedHosts;
  state.webLinks=cleanedWebLinks;

  const validCollapsedKeys=new Set([
    ...state.categories.map(c=>`category:${c.name}`),
    ...state.hosts.map(h=>`host:${h.name}`),
    ...state.categories.map(c=>c.name)
  ]);
  state.collapsed=Object.fromEntries(
    Object.entries(state.collapsed).filter(([name])=>validCollapsedKeys.has(name))
  );

  render();
  await saveConfig(true);
  refreshHostMetrics();
  closeEditor();
});

let editorSearchTimer=null;
editorSearch.addEventListener("input",()=>{
  clearTimeout(editorSearchTimer);
  editorSearchTimer=setTimeout(renderServiceEditor,150);
});
editorCategoryFilter.addEventListener("change",renderServiceEditor);
editorHostFilter.addEventListener("change",renderServiceEditor);
