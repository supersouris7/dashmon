// Web links panel: name, URL, icon and optional counter of each link.
import { webLinksEditor, addWebLinkBtn } from "../dom.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { createWebLinkIconPicker } from "./icon-picker.js";
import { LINK_COUNTER_TYPES } from "../config/normalize.js";
import { confirmDelete } from "../editor.js";
import { moveItem } from "./drag.js";
import { setIconLabel } from "./labelled-button.js";

export function renderWebLinksEditor() {
  webLinksEditor.innerHTML = "";
  state.editWebLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "web-link-row";
    row.draggable = true;

    const drag = document.createElement("div");
    drag.className = "drag-handle";
    drag.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';

    const name = document.createElement("input");
    name.className = "edit-input";
    name.placeholder = t("nameLabel");
    name.value = link.name || "";
    name.addEventListener("input", () => (state.editWebLinks[index].name = name.value));

    const url = document.createElement("input");
    url.className = "edit-input web-link-url";
    url.placeholder = "https://...";
    url.value = link.url || "";
    url.addEventListener("input", () => (state.editWebLinks[index].url = url.value));

    const iconPicker = createWebLinkIconPicker(link, index);

    const counterWrap = document.createElement("div");
    counterWrap.className = "web-link-counter-wrap";

    const currentCounter =
      link.counter && LINK_COUNTER_TYPES.includes(link.counter.type) ? link.counter : null;

    const counterType = document.createElement("select");
    counterType.className = "edit-select web-link-counter-type";
    counterType.title = t("linkCounterLabel");
    [
      ["", t("linkCounterNone")],
      ["github", t("linkCounterGitHub")],
      ["dockerhub", t("linkCounterDockerHub")],
      ["youtube", t("linkCounterYoutube")]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      counterType.appendChild(option);
    });
    counterType.value = currentCounter ? currentCounter.type : "";

    const counterTarget = document.createElement("input");
    counterTarget.className = "edit-input web-link-counter-target";
    counterTarget.value = currentCounter ? currentCounter.target : "";
    counterTarget.hidden = !currentCounter;
    const targetPlaceholder = type =>
      t(type === "youtube" ? "linkCounterChannelPlaceholder" : "linkCounterRepoPlaceholder");
    counterTarget.placeholder = targetPlaceholder(currentCounter ? currentCounter.type : "");

    counterType.addEventListener("change", () => {
      const type = counterType.value;
      if (!type) {
        state.editWebLinks[index].counter = null;
        counterTarget.hidden = true;
        counterTarget.value = "";
        return;
      }
      state.editWebLinks[index].counter = { type, target: counterTarget.value || "" };
      counterTarget.hidden = false;
      counterTarget.placeholder = targetPlaceholder(type);
    });
    counterTarget.addEventListener("input", () => {
      if (state.editWebLinks[index].counter) {
        state.editWebLinks[index].counter.target = counterTarget.value;
      }
    });

    counterWrap.append(counterType, counterTarget);

    const del = document.createElement("button");
    del.className = "small-icon-btn delete-btn";
    del.type = "button";
    del.title = t("deleteLabel");
    setIconLabel(del, "fa-solid fa-trash", t("deleteLabel"));
    del.addEventListener("click", async () => {
      if (!(await confirmDelete(t("confirmDeleteWebLink")))) return;
      state.editWebLinks.splice(index, 1);
      renderWebLinksEditor();
    });

    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", e => e.preventDefault());
    row.addEventListener("drop", e => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(from) || from === index) return;
      moveItem(state.editWebLinks, from, index);
      renderWebLinksEditor();
    });

    row.append(drag, name, url, counterWrap, iconPicker, del);
    webLinksEditor.appendChild(row);
  });
}

addWebLinkBtn.addEventListener("click", () => {
  state.editWebLinks.push({ name: "", url: "", icon: "fa-solid fa-globe", counter: null });
  renderWebLinksEditor();
  requestAnimationFrame(() => {
    const rows = [...webLinksEditor.querySelectorAll(".web-link-row")];
    rows[rows.length - 1]?.querySelector(".edit-input")?.focus();
  });
});
