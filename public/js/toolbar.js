// Mesures pures : la navigation peut contenir un nombre variable d'onglets.
export function hideToolbarSearch(available, navigation, actions, gaps, minimumSearch=140){
  return available < navigation + actions + gaps + minimumSearch;
}

// Decalage du bord droit du menu, normalement aligne sur le bouton.
export function menuRightOffset(left, right, viewport, margin=8){
  const width=right-left;
  const target=Math.max(margin,Math.min(left,viewport-margin-width));
  return left-target;
}
