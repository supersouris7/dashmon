// Moving editor items. The model is changed before asking for a new render;
// bounds are checked on receipt.
export function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

export function makeDraggable(row, list, index, rerender) {
  row.draggable = true;
  row.addEventListener("dragstart", event => {
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(item => item.classList.remove("drag-over"));
  });
  row.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", event => {
    event.preventDefault();
    row.classList.remove("drag-over");
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= list.length) return;
    moveItem(list, fromIndex, index);
    rerender();
  });
}
