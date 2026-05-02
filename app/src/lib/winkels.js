// Winkels voor categorisering van boodschappen.

export const WINKELS = [
  { id: '',         label: '— onbekend' },
  { id: 'ah',       label: 'AH' },
  { id: 'jumbo',    label: 'Jumbo' },
  { id: 'plus',     label: 'Plus' },
  { id: 'lidl',     label: 'Lidl' },
  { id: 'aldi',     label: 'Aldi' },
  { id: 'markt',    label: 'Markt' },
  { id: 'biologisch', label: 'Bio-winkel' },
  { id: 'anders',   label: 'Anders' },
];

export const WINKEL_BY_ID = Object.fromEntries(WINKELS.map(w => [w.id, w]));

export function winkelLabel(id) {
  return WINKEL_BY_ID[id]?.label ?? '— onbekend';
}
