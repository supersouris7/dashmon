// Editor buttons show an icon AND a word ("Icon", "Colour", "Delete"), never
// a lone pictogram: the action reads at a glance.

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
