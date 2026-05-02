// Boodschappenlijst-aggregatie: van week_meals naar afvinkbare lijst.
// Groepeert per (genormaliseerde-naam + unit-base + winkel), sommeert hoeveelheden,
// houdt 'who' bij (welke personen hebben dit nodig).

import { aggKey } from './units.js';
import { classifyIngredient, categoryLabel, categoryHue, categoryOrder } from './categorie.js';

// Bereidingswijzen die genegeerd worden bij groeperen ("Ei, gebakken" → "Ei").
const BEREIDING_RE = /\b(gebakken|gekookt|gefruit|gegrild|geroosterd|gestoomd|gepocheerd|rauwe?|magere|volle|halfvolle|mager|vol|halfvol)\b/gi;
const NAAR_KEUZE_RE = /\bnaar keuze\b/gi;
const STORE_HINT_RE = /\bin\s+(olijfolie|boter|zonnebloemolie|water)\b/gi;

/**
 * Normaliseer een ingrediënt-naam voor groepering in de boodschappenlijst.
 * "Ei (omelet)" / "Ei, gebakken" / "Ei, gekookt" → "ei"
 * "Honing" / "Honing (rauwe)" → "honing"
 * "Kwark, volle" / "Kwark, magere" → "kwark"
 */
function normalizeName(name) {
  let n = (name || '').trim();

  // 1. Strip parenthese-suffix: "Ei (omelet)", "Beleg (voor 2 sneetjes)"
  n = n.replace(/\s*\([^)]*\)\s*/g, ' ');

  // 2. Strip bereidingswijzes en bijwoorden
  n = n.replace(BEREIDING_RE, '');
  n = n.replace(NAAR_KEUZE_RE, '');
  n = n.replace(STORE_HINT_RE, '');

  // 3. Strip alle leestekens behalve / (voor "blauwe bessen/frambozen")
  n = n.replace(/[,;]/g, '');

  // 4. Whitespace normaliseren
  n = n.replace(/\s+/g, ' ').trim();

  return n.toLowerCase();
}

// Display-naam = genormaliseerde key met hoofdletter.
// Als alle varianten exact gelijk zijn, gebruik die origineel (behoud "Blauwe bessen/frambozen").
function chooseDisplayName(variants, normalizedKey) {
  const arr = Array.from(variants);
  if (arr.length === 1) return arr[0];
  // Bij meerdere varianten: gebruik de pure genormaliseerde naam met hoofdletter.
  return normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1);
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
        if (!nameKey) continue; // overgeslagen als naam helemaal weg-gestript wordt
        const unitKey = aggKey(ing.unit);
        const storeKey = ing.store || '';
        const key = `${nameKey}::${unitKey}::${storeKey}`;
        if (!groups.has(key)) {
          groups.set(key, {
            nameKey,
            variants: new Set(),
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
        g.variants.add(ing.name.trim());
        g.sources.push({ slug, day: wm.day, slot: wm.slot, mealName: wm.meal?.name, originalName: ing.name });
      }
    }
  }

  // Convert naar array, sorteer per winkel + naam
  return Array.from(groups.values())
    .map(g => ({
      name: chooseDisplayName(g.variants, g.nameKey),
      qty: g.qty > 0 ? g.qty : null,
      unit: g.unit,
      store: g.store,
      category: classifyIngredient(g.nameKey),
      who: Array.from(g.who),
      partial: g.qtyMissing && g.qty > 0,
      variants: Array.from(g.variants),
      sources: g.sources,
    }))
    .sort((a, b) => {
      if (a.category !== b.category) return categoryOrder(a.category) - categoryOrder(b.category);
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

// Groepeer items per categorie (groente/zuivel/etc.) — primaire weergave in supermarkt.
export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.category || 'overig';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
    .map(([catId, items]) => ({
      categoryId: catId,
      label: categoryLabel(catId),
      hue: categoryHue(catId),
      items,
    }));
}
