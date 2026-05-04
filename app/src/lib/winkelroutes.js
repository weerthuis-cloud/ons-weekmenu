// Winkel-routes per supermarkt. Volgorde van categorieën zoals je ze in een
// gemiddeld filiaal tegenkomt, lopend van ingang naar kassa. Niet filiaal-
// specifiek (Nieuw-Vennep ≈ andere filialen) — feedback in de winkel kan
// later finetunen.
//
// Categorie-IDs corresponderen met lib/categorie.js: CATEGORIES[].id.

export const ROUTES = {
  standaard: null,  // gebruik categoryOrder uit categorie.js
  ah: [
    'groente_fruit',
    'brood_granen',
    'zuivel_eieren',
    'vlees_vis',
    'kruiden_sausen',
    'houdbaar',
    'drank',
    'overig',
  ],
  jumbo: [
    'groente_fruit',
    'vlees_vis',
    'zuivel_eieren',
    'brood_granen',
    'kruiden_sausen',
    'houdbaar',
    'drank',
    'overig',
  ],
  lidl: [
    'groente_fruit',
    'brood_granen',
    'zuivel_eieren',
    'vlees_vis',
    'houdbaar',
    'kruiden_sausen',
    'drank',
    'overig',
  ],
};

export const ROUTE_LABELS = {
  standaard: 'Standaard',
  ah:        'AH',
  jumbo:     'Jumbo',
  lidl:      'Lidl',
};

// Sorteer-helper: hoger = verderop in de winkel. -1 betekent "gebruik default".
export function routeOrderIndex(catId, routeId) {
  const r = ROUTES[routeId];
  if (!r) return -1;
  const idx = r.indexOf(catId);
  return idx === -1 ? 999 : idx;
}
