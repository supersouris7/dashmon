// What the user is doing on the Supervision page survives a refresh: the
// page is rebuilt every interval, so the keyboard focus, the open <details>
// and the scroll position are noted before and put back after. A refresh
// while text is selected in the page waits until the selection is gone:
// copying a command must not be interrupted.

// An element is found again by its card (type, keys, rank among the cards of
// that type) and its path of child indexes inside the card.
const typeOf = card => [...card.classList].find(name => name.startsWith("supervision-card-")) || "";
const keysOf = card =>
  Object.entries(card.dataset)
    .map(([name, value]) => name + "=" + value)
    .join("&");

function cardIdentity(card, root) {
  const type = typeOf(card);
  const keys = keysOf(card);
  const twins = [...root.querySelectorAll(".supervision-card")].filter(
    other => typeOf(other) === type && keysOf(other) === keys
  );
  return { type, keys, rank: twins.indexOf(card) };
}

export function locate(element, root) {
  const card = element?.closest?.(".supervision-card");
  if (!card || !root.contains(card)) return null;
  const path = [];
  for (let node = element; node !== card; node = node.parentElement) {
    path.unshift([...node.parentElement.children].indexOf(node));
  }
  return { ...cardIdentity(card, root), path };
}

export function find(place, root) {
  if (!place) return null;
  const card = [...root.querySelectorAll(".supervision-card")].filter(
    candidate => typeOf(candidate) === place.type && keysOf(candidate) === place.keys
  )[place.rank];
  let node = card || null;
  for (const index of place.path) node = node?.children[index] || null;
  return node;
}

export function selectionInside(root) {
  const selection = typeof window === "undefined" ? null : window.getSelection();
  return !!selection && !selection.isCollapsed && root.contains(selection.anchorNode);
}

export function snapshot(root) {
  return {
    focus: locate(document.activeElement, root),
    open: [...root.querySelectorAll("details[open]")].map(details => locate(details, root)),
    scroll: window.scrollY
  };
}

export function restore(root, saved) {
  for (const place of saved.open) {
    const details = find(place, root);
    if (details?.tagName === "DETAILS") details.open = true;
  }
  const focused = find(saved.focus, root);
  if (focused && typeof focused.focus === "function") focused.focus({ preventScroll: true });
  // The rebuilt page may have been shorter for a moment: back to where it was.
  if (window.scrollY !== saved.scroll) window.scrollTo(0, saved.scroll);
}
