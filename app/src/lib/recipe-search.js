// v2.17: restjes-zoeker. Gegeven een set canonical input-keys, scoor recepten
// op hoeveel van hun (niet-pantry) ingrediënten matchen.
//
// Score = matched / required, waarbij required = canonical-keys van het
// recept minus pantry. Recepten waar required leeg is (puur pantry-recept,
// zeldzaam) scoren 1 zodra er ten minste één input-key meedoet, anders 0.

import { canonicalKeysOfIngredients } from './ingredients.js';
import { PANTRY as DEFAULT_PANTRY } from './pantry.js';

/**
 * Bouw de canonical key-set voor een recept. Pure functie, makkelijk te
 * testen los van searchByIngredients.
 */
export function recipeCanonicalSet(meal) {
  return canonicalKeysOfIngredients(meal?.ingredients || []);
}

/**
 * Zoek recepten die het beste passen bij de input-keys.
 *
 * v2.17.1: een recept wordt getoond zodra het ≥1 input-ingredient bevat. De
 * primaire sortering is `matched` (absoluut aantal raken), niet score. Dat
 * past bij het restjes-doel: "ik heb komkommer" hoort álle komkommer-recepten
 * te tonen, ook al heeft het recept nog 8 andere ingrediënten nodig (score
 * 1/9 = 11%). De score blijft beschikbaar als info-pill in de UI en als
 * optionele filter via `minScore` voor wie strenger wil zoeken.
 *
 * @param {Array} meals — array van meal-records (uit listMeals).
 * @param {Iterable<string>} inputKeys — canonical-keys die de gebruiker heeft.
 * @param {object} opts
 *   - slot:       'diner' (default) of een specifiek meal.type
 *   - pantry:     Set van pantry-keys (default: PANTRY)
 *   - minScore:   optioneel minimum match-percentage (default 0 = uit)
 *   - limit:      max resultaten (default 50)
 *   - includeDeleted: of soft-deleted meals meedoen (default false)
 * @returns {Array} sorted results: { meal, score, matched, missing, requiredCount }
 */
export function searchByIngredients(meals, inputKeys, opts = {}) {
  const {
    slot = 'diner',
    pantry = DEFAULT_PANTRY,
    minScore = 0,
    limit = 50,
    includeDeleted = false,
  } = opts;

  const inputSet = new Set();
  for (const k of (inputKeys || [])) {
    if (k) inputSet.add(k);
  }
  if (inputSet.size === 0) return [];

  const results = [];
  for (const meal of (meals || [])) {
    if (!meal) continue;
    if (slot && meal.type !== slot) continue;
    if (!includeDeleted && meal.deleted_at) continue;

    const canonicals = recipeCanonicalSet(meal);
    if (canonicals.size === 0) continue;

    const required = [];
    const matched = [];
    const missing = [];
    for (const c of canonicals) {
      if (pantry.has(c)) continue;
      required.push(c);
      if (inputSet.has(c)) matched.push(c);
      else missing.push(c);
    }

    // v2.17.1: een recept zonder enkele match is geen restjes-kandidaat.
    if (matched.length === 0) continue;

    let score;
    if (required.length === 0) {
      // recept is puur pantry (zeldzaam) — score 1 als input ≥1 raakt
      score = 1;
    } else {
      score = matched.length / required.length;
    }
    if (minScore > 0 && score < minScore) continue;

    results.push({
      meal,
      score,
      matched: matched.sort(),
      missing: missing.sort(),
      requiredCount: required.length,
    });
  }

  // v2.17.1: primair op aantal raken (matched DESC), dan op restwerk
  // (missing ASC), dan naam. Score blijft secundaire info via de pill.
  results.sort((a, b) => {
    if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return (a.meal?.name || '').localeCompare(b.meal?.name || '');
  });

  return results.slice(0, limit);
}
