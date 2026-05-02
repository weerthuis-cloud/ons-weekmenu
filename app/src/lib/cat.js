// Categorie / slot → visuele tinten en hues.
// Mapping uit prototype: ontbijt=mustard, lunch=leaf, diner=tomato.
// Snacks krijgen subtielere tints zodat de hoofdmaaltijden visueel domineren.

export const SLOT_VISUAL = {
  ontbijt:       { chip: 'mustard', hue: 85,  emoji: '☀',  korte: 'Ontbijt' },
  snack_ochtend: { chip: 'leaf',    hue: 145, emoji: '☕', korte: 'Tussendoor' },
  lunch:         { chip: 'leaf',    hue: 145, emoji: '◑',  korte: 'Lunch' },
  snack_middag:  { chip: 'plum',    hue: 340, emoji: '🍎', korte: 'Tussendoor' },
  diner:         { chip: 'tomato',  hue: 28,  emoji: '☾',  korte: 'Diner' },
  snack_avond:   { chip: 'berry',   hue: 260, emoji: '🌙', korte: 'Tussendoor' },
};

// Snel hue vinden voor een meal-type (voor FoodPh-placeholder)
export function hueForSlot(slotId) {
  return SLOT_VISUAL[slotId]?.hue ?? 80;
}

export function chipForSlot(slotId) {
  return SLOT_VISUAL[slotId]?.chip ?? '';
}

// Persoon → kleur (consistent met tokens.css)
export const PERSOON_VISUAL = {
  peter:   { chip: 'berry', hue: 260, label: 'Peter' },
  miranda: { chip: 'plum',  hue: 340, label: 'Miranda' },
  beiden:  { chip: 'leaf',  hue: 145, label: 'Beiden' },
};

// Standaard-tijden voor display in DayView (alleen suggestie)
export const SLOT_TIME = {
  ontbijt:       '07:30',
  snack_ochtend: '10:30',
  lunch:         '12:30',
  snack_middag:  '15:30',
  diner:         '18:30',
  snack_avond:   '21:00',
};
