// Pure measurements: the navigation may hold a variable number of tabs. Below
// `minimumSearch` pixels the search leaves the toolbar for a line of its own.
export function hideToolbarSearch(available, navigation, actions, gaps, minimumSearch = 200) {
  return available < navigation + actions + gaps + minimumSearch;
}

// Offset of the menu's right edge, normally aligned on the button.
export function menuRightOffset(left, right, viewport, margin = 8) {
  const width = right - left;
  const target = Math.max(margin, Math.min(left, viewport - margin - width));
  return left - target;
}
