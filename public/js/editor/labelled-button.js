// Editor buttons show an icon AND a word ("Icon", "Colour"): the action reads
// at a glance. The trash is the exception (setDeleteIcon): it is universal
// and sits at the end of every row.

// visual: a Font Awesome class name, or an element (an image, a swatch).
export function setIconLabel(button, visual, text) {
  let icon = visual;
  if (typeof visual === "string") {
    icon = document.createElement("i");
    icon.className = visual;
    icon.setAttribute("aria-hidden", "true");
  }
  const label = document.createElement("span");
  label.textContent = text;
  button.classList.add("labelled-btn");
  button.replaceChildren(icon, label);
}

// Square trash button of a settings row: no word, the label stays for
// assistive technologies and as a tooltip.
export function setDeleteIcon(button, text) {
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-trash";
  icon.setAttribute("aria-hidden", "true");
  button.title = text;
  button.setAttribute("aria-label", text);
  button.replaceChildren(icon);
}
