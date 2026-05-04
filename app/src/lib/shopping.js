// Boodschappenlijst-aggregatie: van week_meals naar afvinkbare lijst.
// Groepeert per (genormaliseerde-naam + unit-base + winkel), sommeert hoeveelheden,
// houdt 'who' bij (welke personen hebben dit nodig).
//
// v1.2: schaalfactor = wm.porties / (meal.serves || 1)
//   - Recepten voor 4 personen krijgen meal.serves=4, dus 2 eters → factor 0.5.
//   - Solo-meals zonder serves: factor blijft gewoon porties (zoals voor v1.2).

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

  // v1.3: alleen solo-meals (serves null/0) automatisch aggregeren.
  // Recipe-meals (serves > 0, bv. diner) gaan via per-recept akkoord-flow.
  // Per solo-owner-record: factor = porties (geen serves-deling). Sources
  // krijgen qty-bijdrage zodat we items later schoon kunnen bijwerken.
  const groups = new Map();

  for (const slug of owners) {
    for (const wm of (mealsByOwner[slug] || [])) {
      if (!wm?.meal) continue;
      if (Number(wm.meal?.serves) > 0) continue;  // recipe-meals overslaan
      const ingredients = wm.meal?.ingredients || [];
      const factor = Number(wm.porties ?? 1);
      for (const ing of ingredients) {
        if (!ing?.name) continue;
        const nameKey = normalizeName(ing.name);
        if (!nameKey) continue;
        const unitKey = aggKey(ing.unit);
        const storeKey = ing.store || '';
        const key = `${nameKey}::${unitKey}::${storeKey}`;
        if (!groups.has(key)) {
          groups.set(key, {
            nameKey,
            variants: new Set(),
            qty: 0,
            qtyMissing: false,
            count: 0,
            unit: unitKey,
            store: storeKey,
            who: new Set(),
            sources: [],
          });
        }
        const g = groups.get(key);
        g.count += 1;
        const u = ing.unit ? require_unit_factor(ing.unit) : 1;
        let srcQty = null;
        if (ing.qty == null || ing.qty === '') {
          g.qtyMissing = true;
        } else {
          srcQty = Number(ing.qty) * u * factor;
          g.qty = (g.qty || 0) + srcQty;
        }
        g.who.add(slug);
        g.variants.add(ing.name.trim());
        g.sources.push({
          slug, day: wm.day, slot: wm.slot,
          mealName: wm.meal?.name, originalName: ing.name,
          qty: srcQty,
        });
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
      countOnly: g.qty === 0 && g.qtyMissing,  // alleen 'naar keuze' / onbeperkt items
      count: g.count,                            // hoe vaak nodig deze week
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

// ============================================================
// v1.3: per-recept akkoord-flow
// ============================================================

// Stabiele key voor een recept-instantie (één recept op één dag).
export function recipeKeyOf(day, mealId) {
  return `${day}::${mealId}`;
}

// Schaal recept-ingrediënten naar het opgegeven aantal personen.
// Returnt items met qty in oorspronkelijke unit (voor UI-preview) én qtyBase in
// basis-unit (g/ml/st) voor merge in de boodschappenlijst.
export function scaleRecipeIngredients(meal, porties) {
  const serves = Number(meal?.serves) || 1;
  const factor = Number(porties || 1) / serves;
  return (meal?.ingredients || []).map(ing => {
    const u = ing.unit ? require_unit_factor(ing.unit) : 1;
    let scaledQty = null;
    if (ing.qty != null && ing.qty !== '') {
      scaledQty = Number(ing.qty) * factor;
    }
    return {
      name: ing.name,
      qty: scaledQty,                                       // in oorspronkelijke unit
      qtyBase: scaledQty != null ? scaledQty * u : null,    // in basis-unit voor merge
      unit: ing.unit,
      unitBase: aggKey(ing.unit),
      store: ing.store || '',
    };
  });
}

// Recompute item.qty / partial / countOnly op basis van zijn sources[].qty.
function recomputeItem(item) {
  const sources = item.sources || [];
  let qty = 0;
  let missing = false;
  for (const s of sources) {
    if (s.qty == null) missing = true;
    else qty += Number(s.qty);
  }
  return {
    ...item,
    qty: qty > 0 ? qty : null,
    partial: missing && qty > 0,
    countOnly: qty === 0 && missing,
    count: sources.length,
  };
}

// Merge geschaalde recept-ingrediënten in een items-array. Eerst worden alle
// bestaande sources met deze recipeKey gestript (dus opnieuw akkoord vervangt
// netjes), dan worden de nieuwe scaledIngredients als source toegevoegd.
// `who` is een array van owner-slugs (bv. ['peter','miranda']) — gedeelde
// recepten krijgen één source per ingredient, who[] verzamelt alle eaters.
export function mergeRecipeIntoItems(items, { recipeKey, day, mealName, who, scaledIngredients }) {
  const whoArr = Array.isArray(who) ? who : (who ? [who] : []);
  const primary = whoArr[0] || 'huishouden';

  let result = items.map(it => {
    const before = it.sources || [];
    const after = before.filter(s => s.recipeKey !== recipeKey);
    if (after.length === before.length) return it;
    return recomputeItem({ ...it, sources: after });
  });

  for (const ing of (scaledIngredients || [])) {
    if (!ing?.name) continue;
    const nameKey = normalizeName(ing.name);
    if (!nameKey) continue;
    const wantedKey = `${nameKey}::${ing.unitBase}::${ing.store}`;
    let item = result.find(it => itemKey(it) === wantedKey);
    if (!item) {
      item = {
        name: ing.name,
        qty: 0,
        unit: ing.unitBase,
        store: ing.store,
        category: classifyIngredient(nameKey),
        who: [...whoArr],
        partial: false,
        countOnly: false,
        count: 0,
        variants: [ing.name],
        sources: [],
        checked: false,
      };
      result.push(item);
    } else {
      // v1.5d: ververs categorie voor bestaande items zodat classifier-updates
      // niet pas bij volgend Vernieuw doorkomen.
      item.category = classifyIngredient(nameKey);
    }
    item.sources = [...(item.sources || []), {
      slug: primary,
      day,
      slot: 'diner',
      mealName,
      originalName: ing.name,
      recipeKey,
      qty: ing.qtyBase,
    }];
    for (const w of whoArr) {
      if (!(item.who || []).includes(w)) item.who = [...(item.who || []), w];
    }
    if (!(item.variants || []).includes(ing.name)) item.variants = [...(item.variants || []), ing.name];
    Object.assign(item, recomputeItem(item));
  }

  return result.filter(it => (it.sources || []).length > 0 || it.manual);
}

// Verwijder alle items-bijdrages van een recipeKey. Items met andere sources
// blijven met hun resterende qty. Items zonder resterende sources verdwijnen.
export function removeRecipeFromItems(items, recipeKey) {
  return items
    .map(it => {
      const before = it.sources || [];
      const after = before.filter(s => s.recipeKey !== recipeKey);
      if (after.length === before.length) return it;
      return recomputeItem({ ...it, sources: after });
    })
    .filter(it => (it.sources || []).length > 0 || it.manual);
}

// Welke recipeKeys zijn al akkoord (= komen voor in de items-sources)?
export function approvedRecipeKeys(items) {
  const keys = new Set();
  for (const it of (items || [])) {
    for (const s of (it.sources || [])) {
      if (s.recipeKey) keys.add(s.recipeKey);
    }
  }
  return keys;
}

// Welke ingrediënt-namen van dit recept zijn momenteel in de lijst (uit deze recipeKey)?
// Returnt een Set van originalName (zoals het in meal.ingredients staat).
export function approvedIngredientNamesForRecipe(items, recipeKey) {
  const names = new Set();
  for (const it of (items || [])) {
    for (const s of (it.sources || [])) {
      if (s.recipeKey === recipeKey && s.originalName) names.add(s.originalName);
    }
  }
  return names;
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
