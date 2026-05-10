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
 * @param {Array} meals — array van meal-records (uit listMeals).
 * @param {Iterable<string>} inputKeys — canonical-keys die de gebruiker heeft.
 * @param {object} opts
 *   - slot:       'diner' (default) of een specifiek meal.type
 *   - pantry:     Set van pantry-keys (default: PANTRY)
 *   - minScore:   minimum match-percentage (default 0.5)
 *   - limit:      max resultaten (default 50)
 *   - includeDeleted: of soft-deleted meals meedoen (default false)
 * @returns {Array} sorted results: { meal, score, matched, missing, requiredCount }
 */
export function searchByIngredients(meals, inputKeys, opts = {}) {
  const {
    slot = 'diner',
    pantry = DEFAULT_PANTRY,
    minScore = 0.5,
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

    let score;
    if (required.length === 0) {
      // recept is puur pantry (zeldzaam) — score 1 als input ≥1 raakt
      score = 1;
    } else {
      score = matched.length / required.length;
    }
    if (score < minScore) continue;

    results.push({
      meal,
      score,
      matched: matched.sort(),
      missing: missing.sort(),
      requiredCount: required.length,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return (a.meal?.name || '').localeCompare(b.meal?.name || '');
  });

  return results.slice(0, limit);
}
