// Offset of the menu's right edge, normally aligned on the button.
export function menuRightOffset(left, right, viewport, margin = 8) {
  const width = right - left;
  const target = Math.max(margin, Math.min(left, viewport - margin - width));
  return left - target;
}
