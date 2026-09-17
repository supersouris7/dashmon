// Bibliothèque et gestionnaire d'images PNG (import, sélection, suppression).
import { t } from "./i18n.js";
import {
  imageLibrary, imageGrid, uploadPngBtn, closeImageLibraryBtn, pngUpload,
  managePngUpload, manageUploadBtn, manageDeleteBtn, manageSelectionCount,
  imageManagerGrid
} from "./dom.js";

let activeIconSetter=null;
let managedImageSelection=new Set();

async function getImageLibrary(){
  const response=await fetch("/api/icons",{cache:"no-store"});
  if(!response.ok) throw new Error("HTTP "+response.status);
  return response.json();
}

async function renderImageLibrary(){
  imageGrid.innerHTML="";

  try{
    const images=await getImageLibrary();

    if(!images.length){
      const empty=document.createElement("div");
      empty.className="image-library-empty";
      empty.textContent=t("noImages");
      imageGrid.appendChild(empty);
      return;
    }

    images.forEach(file=>{
      const button=document.createElement("button");
      button.type="button";
      button.className="image-choice";
      button.title=file;

      const img=document.createElement("img");
      img.src=`icons/${encodeURIComponent(file)}`;
      img.alt="";

      button.append(img);
      button.addEventListener("click",()=>{
        if(activeIconSetter){
          activeIconSetter(`icons/${file}`);
        }
        closeImageLibrary();
      });

      imageGrid.appendChild(button);
    });
  }catch(error){
    console.error("Lecture des images impossible",error);
    const empty=document.createElement("div");
    empty.className="image-library-empty";
    empty.textContent=t("imagesLoadError");
    imageGrid.appendChild(empty);
  }
}

export function openImageLibrary(setter){
  activeIconSetter=setter;
  imageLibrary.classList.add("show");
  imageLibrary.setAttribute("aria-hidden","false");
  renderImageLibrary();
}

export function closeImageLibrary(){
  imageLibrary.classList.remove("show");
  imageLibrary.setAttribute("aria-hidden","true");
  activeIconSetter=null;
}

function updateImageManagerSelection(){
  const count=managedImageSelection.size;
  manageDeleteBtn.disabled=count===0;
  manageSelectionCount.textContent=count
    ? `${count} ${count>1 ? t("imagesSelected") : t("imageSelected")}`
    : "";
}

export async function renderImageManager(){
  imageManagerGrid.innerHTML="";
  managedImageSelection.clear();
  updateImageManagerSelection();

  try{
    const images=await getImageLibrary();

    if(!images.length){
      const empty=document.createElement("div");
      empty.className="image-manager-empty";
      empty.textContent=t("noImages");
      imageManagerGrid.appendChild(empty);
      return;
    }

    images.forEach(file=>{
      const item=document.createElement("label");
      item.className="image-manager-item";
      item.title=file;

      const checkbox=document.createElement("input");
      checkbox.type="checkbox";
      checkbox.value=file;

      const img=document.createElement("img");
      img.src=`icons/${encodeURIComponent(file)}`;
      img.alt="";

      const syncSelection=()=>{
        if(checkbox.checked){
          managedImageSelection.add(file);
          item.classList.add("selected");
        }else{
          managedImageSelection.delete(file);
          item.classList.remove("selected");
        }
        updateImageManagerSelection();
      };

      checkbox.addEventListener("change",syncSelection);
      item.append(checkbox,img);
      imageManagerGrid.appendChild(item);
    });
  }catch(error){
    console.error("Lecture des images impossible",error);
    const empty=document.createElement("div");
    empty.className="image-manager-empty";
    empty.textContent=t("imagesLoadError");
    imageManagerGrid.appendChild(empty);
  }
}

async function uploadManagedImages(files){
  const pngFiles=[...files].filter(file=>
    file.type==="image/png" || file.name.toLowerCase().endsWith(".png")
  );
  if(!pngFiles.length) return;

  let failures=0;
  for(const file of pngFiles){
    try{
      const response=await fetch("/api/icons",{
        method:"POST",
        headers:{
          "Content-Type":"image/png",
          "X-File-Name":encodeURIComponent(file.name)
        },
        body:file
      });
      if(!response.ok) failures++;
    }catch(_error){
      failures++;
    }
  }

  await renderImageManager();
  if(failures){
    alert(t("imagesUploadPartial").replace("{count}",String(failures)));
  }
}

uploadPngBtn.addEventListener("click",()=>pngUpload.click());
closeImageLibraryBtn.addEventListener("click",closeImageLibrary);

imageLibrary.addEventListener("click",e=>{
  if(e.target===imageLibrary) closeImageLibrary();
});

pngUpload.addEventListener("change",async()=>{
  const file=pngUpload.files?.[0];
  if(!file) return;

  if(file.type!=="image/png" && !file.name.toLowerCase().endsWith(".png")){
    alert("Seules les images PNG sont acceptées.");
    pngUpload.value="";
    return;
  }

  try{
    const response=await fetch("/api/icons",{
      method:"POST",
      headers:{
        "Content-Type":"image/png",
        "X-File-Name":encodeURIComponent(file.name)
      },
      body:file
    });

    const result=await response.json();
    if(!response.ok) throw new Error(result.error||"Import impossible");

    if(activeIconSetter){
      activeIconSetter(`icons/${result.file}`);
    }

    await renderImageLibrary();
  }catch(error){
    console.error(error);
    alert("Import de l’image impossible.");
  }finally{
    pngUpload.value="";
  }
});

manageUploadBtn.addEventListener("click",()=>managePngUpload.click());

managePngUpload.addEventListener("change",async()=>{
  if(managePngUpload.files?.length){
    await uploadManagedImages(managePngUpload.files);
  }
  managePngUpload.value="";
});

manageDeleteBtn.addEventListener("click",async()=>{
  const files=[...managedImageSelection];
  if(!files.length) return;

  const confirmed=confirm(t("confirmDeleteImages").replace("{count}",String(files.length)));
  if(!confirmed) return;

  let failures=0;
  for(const file of files){
    try{
      const response=await fetch(`/api/icons/${encodeURIComponent(file)}`,{method:"DELETE"});
      if(!response.ok) failures++;
    }catch(_error){
      failures++;
    }
  }

  await renderImageManager();
  if(failures){
    alert(t("imagesDeletePartial").replace("{count}",String(failures)));
  }
});
