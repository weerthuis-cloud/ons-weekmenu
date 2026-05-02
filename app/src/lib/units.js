// Hoeveelheids-eenheden voor ingrediënten.
// Gegroepeerd per soort, met conversie naar basis-eenheid voor aggregatie.

export const UNITS = [
  { id: '',         label: '—',           kind: null,    base: null, factor: 1 },
  { id: 'g',        label: 'gram',        kind: 'mass',  base: 'g',  factor: 1 },
  { id: 'kg',       label: 'kilo',        kind: 'mass',  base: 'g',  factor: 1000 },
  { id: 'ml',       label: 'milliliter',  kind: 'vol',   base: 'ml', factor: 1 },
  { id: 'l',        label: 'liter',       kind: 'vol',   base: 'ml', factor: 1000 },
  { id: 'st',       label: 'stuks',       kind: 'count', base: 'st', factor: 1 },
  { id: 'el',       label: 'eetlepel',    kind: 'count', base: 'el', factor: 1 },
  { id: 'tl',       label: 'theelepel',   kind: 'count', base: 'tl', factor: 1 },
  { id: 'snufje',   label: 'snufje',      kind: 'count', base: 'snufje', factor: 1 },
  { id: 'naar_smaak', label: 'naar smaak', kind: 'count', base: 'naar_smaak', factor: 1 },
];

export const UNIT_BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));

// Aggregatie-key: hetzelfde voor (g+kg) en (ml+l) zodat ze samen optellen
export function aggKey(unitId) {
  const u = UNIT_BY_ID[unitId];
  return u?.base ?? unitId ?? '';
}

// Toon waarde + unit netjes ("250 g", "1.5 l", "3 stuks")
export function formatQty(qty, unitBase) {
  if (qty == null) return '';
  if (unitBase === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)} kg`;
  if (unitBase === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)} l`;
  const labels = { g: 'g', ml: 'ml', st: 'st', el: 'el', tl: 'tl', snufje: 'snufje', naar_smaak: '' };
  const label = labels[unitBase] ?? unitBase ?? '';
  const rounded = Number.isInteger(qty) ? qty : Number(qty.toFixed(2));
  return `${rounded}${label ? ' ' + label : ''}`.trim();
}
