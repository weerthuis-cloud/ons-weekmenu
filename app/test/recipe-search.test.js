// Tests voor lib/recipe-search.js — restjes-zoeker (v2.17).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAliasMap } from '../src/lib/ingredients.js';
import { searchByIngredients, recipeCanonicalSet } from '../src/lib/recipe-search.js';

// Realistische seed: ui-cluster, olijfolie-cluster, knoflook, ei.
function seedAliases() {
  setAliasMap([
    { raw_key: 'uien',                  canonical_key: 'ui' },
    { raw_key: 'rode ui',               canonical_key: 'ui' },
    { raw_key: 'rode uien',             canonical_key: 'ui' },
    { raw_key: 'milde olijfolie',       canonical_key: 'olijfolie' },
    { raw_key: 'extra vierge olijfolie',canonical_key: 'olijfolie' },
    { raw_key: 'teentjes knoflook',     canonical_key: 'knoflook' },
    { raw_key: 'eieren',                canonical_key: 'ei' },
    { raw_key: 'kruimige aardappelen',  canonical_key: 'aardappel' },
    { raw_key: 'aardappels',            canonical_key: 'aardappel' },
    { raw_key: 'griekse yoghurt',       canonical_key: 'yoghurt' },
    { raw_key: 'kippenbouillon',        canonical_key: 'bouillon' },
    { raw_key: 'keukenmachine',         canonical_key: null },
  ]);
}

const stamppot = {
  id: 'm1', name: 'Andijviestamppot', type: 'diner', deleted_at: null,
  ingredients: [
    { name: 'Kruimige aardappelen', qty: 800, unit: 'g' },
    { name: 'Andijvie',             qty: 400, unit: 'g' },
    { name: 'Rode ui',              qty: 1,   unit: 'st' },
    { name: 'Milde olijfolie',      qty: 2,   unit: 'el' },
    { name: 'Zout',                 qty: null,unit: '' },
  ],
};
const omeletje = {
  id: 'm2', name: 'Omelet courgette', type: 'diner', deleted_at: null,
  ingredients: [
    { name: 'Eieren',         qty: 4,  unit: 'st' },
    { name: 'Courgette',      qty: 1,  unit: 'st' },
    { name: 'Boter',          qty: 30, unit: 'g' },
    { name: 'Peper en zout',  qty: null, unit: '' },
  ],
};
const lunchgerecht = {
  id: 'm3', name: 'Lunchsalade', type: 'lunch', deleted_at: null,
  ingredients: [
    { name: 'Andijvie', qty: 100, unit: 'g' },
    { name: 'Eieren',   qty: 2,   unit: 'st' },
  ],
};
const verwijderd = {
  id: 'm4', name: 'Oud recept', type: 'diner', deleted_at: '2026-01-01',
  ingredients: [{ name: 'Andijvie' }, { name: 'Eieren' }],
};
const apparaatRecept = {
  id: 'm5', name: 'Hummus', type: 'diner', deleted_at: null,
  ingredients: [
    { name: 'Keukenmachine' },          // skip-alias → telt niet als required
    { name: 'Kikkererwten' },
  ],
};

test('recipeCanonicalSet: Set met canonicals, plurals normaliseren', () => {
  seedAliases();
  const set = recipeCanonicalSet(stamppot);
  assert.ok(set.has('aardappel'));
  assert.ok(set.has('ui'));
  assert.ok(set.has('olijfolie'));
  assert.ok(set.has('andijvie'));   // long-tail fallback op normalizeName
  assert.ok(set.has('zout'));
});

test('searchByIngredients: lege input → lege resultaten', () => {
  seedAliases();
  const out = searchByIngredients([stamppot, omeletje], []);
  assert.deepEqual(out, []);
});

test('searchByIngredients: andijvie+aardappel matcht stamppot 100% (pantry weggelaten)', () => {
  seedAliases();
  // Required na pantry: aardappel + andijvie + ui → 3
  // Input: andijvie, aardappel, ui → 3 matched → 100%
  const out = searchByIngredients([stamppot, omeletje, lunchgerecht], ['aardappel', 'andijvie', 'ui']);
  assert.equal(out.length, 1);
  assert.equal(out[0].meal.id, 'm1');
  assert.equal(out[0].score, 1);
  assert.deepEqual(out[0].matched.sort(), ['aardappel', 'andijvie', 'ui']);
  assert.equal(out[0].missing.length, 0);
});

test('searchByIngredients: courgette + ei → omelet 100%, stamppot uit', () => {
  seedAliases();
  // Omelet required na pantry: ei + courgette → 2 (boter en peper en zout = pantry)
  const out = searchByIngredients([stamppot, omeletje], ['ei', 'courgette']);
  assert.equal(out.length, 1);
  assert.equal(out[0].meal.id, 'm2');
  assert.equal(out[0].score, 1);
});

test('searchByIngredients: 50% match komt door, 33% niet (default minScore 0.5)', () => {
  seedAliases();
  // Stamppot required: aardappel, andijvie, ui (3). Input: aardappel only → 1/3 = 33% → niet door.
  const out33 = searchByIngredients([stamppot], ['aardappel']);
  assert.equal(out33.length, 0);
  // Input aardappel + andijvie → 2/3 = 67% → wel door.
  const out67 = searchByIngredients([stamppot], ['aardappel', 'andijvie']);
  assert.equal(out67.length, 1);
  assert.ok(out67[0].score > 0.5);
});

test('searchByIngredients: skipt soft-deleted en verkeerde slot', () => {
  seedAliases();
  // Verwijderd recept ('m4') zou matchen op andijvie+ei maar deleted_at staat aan.
  // Lunchgerecht ('m3') zou matchen maar slot != diner.
  const out = searchByIngredients(
    [stamppot, omeletje, lunchgerecht, verwijderd],
    ['andijvie', 'ei']
  );
  const ids = out.map(r => r.meal.id);
  assert.ok(!ids.includes('m3'));
  assert.ok(!ids.includes('m4'));
});

test('searchByIngredients: skip-alias telt niet als required', () => {
  seedAliases();
  // Hummus: required = kikkererwten alleen (keukenmachine wordt geskipt door alias).
  const out = searchByIngredients([apparaatRecept], ['kikkererwten']);
  assert.equal(out.length, 1);
  assert.equal(out[0].score, 1);
  assert.deepEqual(out[0].matched, ['kikkererwten']);
});

test('searchByIngredients: sortering — score eerst, dan |missing|, dan naam', () => {
  seedAliases();
  const a = { id: 'a', name: 'B-naam', type: 'diner', deleted_at: null,
    ingredients: [{ name: 'X' }, { name: 'Y' }, { name: 'Z' }] };  // score 1/3
  const b = { id: 'b', name: 'A-naam', type: 'diner', deleted_at: null,
    ingredients: [{ name: 'X' }, { name: 'Y' }] };                 // score 1/2
  const c = { id: 'c', name: 'C-naam', type: 'diner', deleted_at: null,
    ingredients: [{ name: 'X' }] };                                // score 1/1
  // input X enabled minScore 0
  const out = searchByIngredients([a, b, c], ['x'], { minScore: 0 });
  assert.deepEqual(out.map(r => r.meal.id), ['c', 'b', 'a']);
});

test('searchByIngredients: limit cap', () => {
  seedAliases();
  const meals = [];
  for (let i = 0; i < 60; i++) {
    meals.push({
      id: `m${i}`, name: `R${i}`, type: 'diner', deleted_at: null,
      ingredients: [{ name: 'X' }],
    });
  }
  const out = searchByIngredients(meals, ['x'], { minScore: 0, limit: 10 });
  assert.equal(out.length, 10);
});
