// v2.16: canonical-mapping voor receptzoek (restjes-modus).
//
// De alias-tabel uit Supabase wordt eenmalig geladen bij app-start (via
// data.js) en hier in een Map gehouden. Deze module exporteert
// `canonicalKey(rawName)` die rauwe ingredient-namen terugbrengt tot een
// canonical sleutel voor de zoek-laag.
//
// Belangrijk: de boodschappenlijst-aggregator (lib/shopping.js) gebruikt
// deze laag bewust NIET. Voor inkopen blijven 'rode ui' en 'ui' verschillende
// producten. Canonical is alleen voor zoek-doeleinden.

import { normalizeName } from './shopping.js';

// raw_key -> canonical_key | null (null = skip in zoek)
let aliasMap = new Map();

/** Vervang de alias-map. Verwacht een array van { raw_key, canonical_key }. */
export function setAliasMap(rows) {
  aliasMap = new Map();
  for (const r of (rows || [])) {
    if (!r || typeof r.raw_key !== 'string') continue;
    aliasMap.set(r.raw_key, r.canonical_key ?? null);
  }
}

/** Diagnostiek: hoeveel aliases zijn er geladen. */
export function getAliasMapSize() {
  return aliasMap.size;
}

/**
 * Canonical sleutel voor receptzoek. Doorloopt eerst normalizeName (parens,
 * bereiding, naar-keuze, roerei→ei, leestekens). Daarna lookup in alias-map.
 *
 * Returns:
 *  - string canonical_key  → gebruik in zoek-matching
 *  - null                  → bewust skippen (geen ingredient, parser-vuiltje)
 *  - '' (empty string)     → lege input
 */
export function canonicalKey(rawName) {
  const key = normalizeName(rawName);
  if (!key) return key;
  if (aliasMap.has(key)) return aliasMap.get(key);
  return key;
}

/**
 * Bouw een Set van canonical-keys voor een lijst ingredient-objecten
 * (zoals meal.ingredients). Skipt nulls en lege keys, dedupliceert.
 */
export function canonicalKeysOfIngredients(ingredients) {
  const keys = new Set();
  for (const ing of (ingredients || [])) {
    const k = canonicalKey(ing?.name);
    if (k) keys.add(k);  // null en '' worden geskipt
  }
  return keys;
}
