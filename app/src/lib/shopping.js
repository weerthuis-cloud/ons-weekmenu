// Boodschappenlijst-aggregatie: van week_meals naar afvinkbare lijst.
// Groepeert per (naam + unit-base + winkel), sommeert hoeveelheden,
// houdt 'who' bij (welke personen hebben dit nodig).

import { aggKey } from './units.js';

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * @param {object} mealsByOwner  { peter: week_meal[], miranda: week_meal[] }
 *   Elke week_meal heeft .day, .slot, .porties, .meal { name, ingredients }
 * @param {'huishouden'|'peter'|'miranda'} modus
 * @returns {Array<{name, qty: number|null, unit: string, store: string, who: string[], partial: boolean, sources: Array<{slug, day, slot, mealName}>}>}
 */
export function aggregateShopping(mealsByOwner, modus = 'huishouden') {
  const owners = modus === 'huishouden' ? ['peter','miranda'] : [modus];
  const groups = new Map();

  for (const slug of owners) {
    const items = mealsByOwner[slug] || [];
    for (const wm of items) {
      const ingredients = wm.meal?.ingredients || [];
      const porties = Number(wm.porties ?? 1);
      for (const ing of ingredients) {
        if (!ing?.name) continue;
        const nameKey = normalizeName(ing.name);
        const unitKey = aggKey(ing.unit);
        const storeKey = ing.store || '';
        const key = `${nameKey}::${unitKey}::${storeKey}`;
        if (!groups.has(key)) {
          groups.set(key, {
            name: ing.name.trim(),
            qty: 0,
            qtyMissing: false,
            unit: unitKey,
            store: storeKey,
            who: new Set(),
            sources: [],
          });
        }
        const g = groups.get(key);
        const u = ing.unit ? require_unit_factor(ing.unit) : 1;
        if (ing.qty == null || ing.qty === '') {
          g.qtyMissing = true;
        } else {
          g.qty = (g.qty || 0) + Number(ing.qty) * u * porties;
        }
        g.who.add(slug);
        g.sources.push({ slug, day: wm.day, slot: wm.slot, mealName: wm.meal?.name });
      }
    }
  }

  // Convert naar array, sorteer per winkel + naam
  return Array.from(groups.values())
    .map(g => ({
      name: g.name,
      qty: g.qty > 0 ? g.qty : null,
      unit: g.unit,
      store: g.store,
      who: Array.from(g.who),
      partial: g.qtyMissing && g.qty > 0,
      sources: g.sources,
    }))
    .sort((a, b) => {
      if (a.store !== b.store) return a.store.localeCompare(b.store);
      return a.name.localeCompare(b.name);
    });
}

// Inline helper omdat we units.js niet circulair willen importen
function require_unit_factor(unitId) {
  // {g:1, kg:1000, ml:1, l:1000, st:1, el:1, tl:1, snufje:1, naar_smaak:1, '': 1}
  const m = { g:1, kg:1000, ml:1, l:1000, st:1, el:1, tl:1, snufje:1, naar_smaak:1 };
  return m[unitId] ?? 1;
}

// Stabiele key voor een item (voor checked-state in shopping_list)
export function itemKey(item) {
  return `${normalizeName(item.name)}::${item.unit}::${item.store}`;
}

// Groepeer items per winkel voor weergave
export function groupByStore(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.store || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.entries()).map(([store, items]) => ({ store, items }));
}
