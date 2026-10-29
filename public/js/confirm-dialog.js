// Dialogue reutilisable : l'appelant fournit les libelles et les actions.
// Une seule confirmation peut etre ouverte a la fois.
export function createConfirmDialog({backdrop,icon,title,message,actions,documentRef=document}){
  let resolveCurrent=null;
  function cancel(){if(resolveCurrent) resolveCurrent("cancel");}
  function isOpen(){return resolveCurrent!==null;}
  function open(options){
    cancel();
    title.textContent=options.title;
    message.textContent=options.message;
    icon.className="confirm-icon"+(options.icon ? " fa-solid "+options.icon : "");
    icon.hidden=!options.icon;
    actions.className="confirm-actions"+(options.actions.length>2 ? " multi" : "");
    actions.replaceChildren();
    return new Promise(resolve=>{
      const finish=value=>{
        if(resolveCurrent!==finish) return;
        resolveCurrent=null;
        backdrop.classList.remove("show");
        backdrop.setAttribute("aria-hidden","true");
        resolve(value);
      };
      resolveCurrent=finish;
      for(const action of options.actions){
        const button=documentRef.createElement("button");
        button.type="button";
        button.className=action.className||"action-btn";
        button.textContent=action.label;
        button.addEventListener("click",()=>finish(action.id));
        actions.appendChild(button);
      }
      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden","false");
      actions.querySelector("button")?.focus();
    });
  }
  backdrop.addEventListener("click",event=>{if(event.target===backdrop) cancel();});
  return {open,cancel,isOpen};
}
