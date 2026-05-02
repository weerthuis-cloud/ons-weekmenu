// Maaltijdslots in chronologische volgorde, met labels en emoji's voor de UI.

export const SLOTS = [
  { id: 'ontbijt',       label: 'Ontbijt',       short: 'Ontbijt', emoji: '🌅' },
  { id: 'snack_ochtend', label: 'Tussendoor',    short: 'Och',     emoji: '☕' },
  { id: 'lunch',         label: 'Lunch',         short: 'Lunch',   emoji: '🥗' },
  { id: 'snack_middag',  label: 'Tussendoor',    short: 'Mid',     emoji: '🍎' },
  { id: 'diner',         label: 'Diner',         short: 'Diner',   emoji: '🍽️' },
  { id: 'snack_avond',   label: 'Tussendoor',    short: 'Av',      emoji: '🌙' },
];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));

export function slotLabel(id) {
  return SLOT_BY_ID[id]?.label ?? id;
}
