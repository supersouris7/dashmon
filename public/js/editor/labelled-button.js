// Small buttons of the settings rows (icon, colour, configure, delete): a
// 38 px square without a word. The name stays as a tooltip and for assistive
// technologies.

// visual: a Font Awesome class name, or an element (an image, a swatch).
export function setIconButton(button, visual, text) {
  let icon = visual;
  if (typeof visual === "string") {
    icon = document.createElement("i");
    icon.className = visual;
    icon.setAttribute("aria-hidden", "true");
  }
  button.classList.add("square-btn");
  button.title = text;
  button.setAttribute("aria-label", text);
  button.replaceChildren(icon);
}

export function setDeleteIcon(button, text) {
  setIconButton(button, "fa-solid fa-trash", text);
}
