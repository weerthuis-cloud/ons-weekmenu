// Unit tests voor lib/shopping.js — aggregator + recipe-helpers.
// Draaien: cd app && node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateShopping,
  scaleRecipeIngredients,
  mergeRecipeIntoItems,
  removeRecipeFromItems,
  approvedRecipeKeys,
  approvedIngredientNamesForRecipe,
  recipeKeyOf,
  itemKey,
} from '../src/lib/shopping.js';

const kipKerrie = {
  id: 'kk', name: 'Kip kerrie', serves: 4,
  ingredients: [
    { name: 'Basmatirijst', qty: 300, unit: 'g', store: '' },
    { name: 'Broccoli', qty: 1, unit: 'kg', store: '' },
    { name: 'Olijfolie', qty: 3, unit: 'el', store: '' },
  ],
};
const beef = {
  id: 'beef', name: 'Beef', serves: 4,
  ingredients: [
    { name: 'Broccoli', qty: 500, unit: 'g', store: '' },
    { name: 'Olijfolie', qty: 2, unit: 'el', store: '' },
  ],
};
const ontbijt = {
  id: 'ob', name: 'Kwark + bessen', serves: null,
  ingredients: [{ name: 'Kwark, volle', qty: 300, unit: 'g', store: '' }],
};

// ============================================================
// aggregateShopping
// ============================================================
test('aggregateShopping skipt recipe-meals (serves > 0)', () => {
  const out = aggregateShopping({
    peter:   [{ day:1, slot:'diner', porties:2, meal:kipKerrie },
              { day:1, slot:'ontbijt', porties:1, meal:ontbijt }],
    miranda: [{ day:1, slot:'ontbijt', porties:1, meal:ontbijt }],
  }, 'huishouden');
  const names = out.map(i => i.name);
  assert.deepEqual(names, ['Kwark, volle']);
  assert.equal(out[0].qty, 600);
});

test('aggregateShopping somt solo-meal porties over owners', () => {
  const out = aggregateShopping({
    peter:   [{ day:1, slot:'ontbijt', porties:2, meal:ontbijt }],
    miranda: [{ day:1, slot:'ontbijt', porties:1, meal:ontbijt }],
  }, 'huishouden');
  assert.equal(out[0].qty, 900);  // 300×(2+1)
});

test('aggregateShopping solo modus telt alleen die owner', () => {
  const out = aggregateShopping({
    peter:   [{ day:1, slot:'ontbijt', porties:1, meal:ontbijt }],
    miranda: [{ day:1, slot:'ontbijt', porties:1, meal:ontbijt }],
  }, 'peter');
  assert.equal(out[0].qty, 300);
});

// ============================================================
// scaleRecipeIngredients
// ============================================================
test('scaleRecipeIngredients schaalt qty én qtyBase correct', () => {
  const s = scaleRecipeIngredients(kipKerrie, 2);
  const rijst = s.find(x => x.name === 'Basmatirijst');
  const broc = s.find(x => x.name === 'Broccoli');
  assert.equal(rijst.qty, 150);
  assert.equal(rijst.qtyBase, 150);
  assert.equal(broc.qty, 0.5);
  assert.equal(broc.qtyBase, 500);   // 0.5 kg → 500 g
});

test('scaleRecipeIngredients met serves null gebruikt 1 als basis', () => {
  const s = scaleRecipeIngredients(ontbijt, 2);
  assert.equal(s[0].qty, 600);
});

// ============================================================
// mergeRecipeIntoItems
// ============================================================
test('merge in lege lijst maakt items met sources', () => {
  const key = recipeKeyOf(1, 'kk');
  const scaled = scaleRecipeIngredients(kipKerrie, 2);
  const items = mergeRecipeIntoItems([], {
    recipeKey: key, day: 1, mealName: 'Kip kerrie', who: ['peter'],
    scaledIngredients: scaled,
  });
  assert.equal(items.length, 3);
  assert.equal(items[0].sources[0].recipeKey, key);
});

test('re-merge zelfde recept vervangt sources (geen dubbel)', () => {
  const key = recipeKeyOf(1, 'kk');
  let items = mergeRecipeIntoItems([], {
    recipeKey: key, day: 1, mealName: 'Kip kerrie', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  items = mergeRecipeIntoItems(items, {
    recipeKey: key, day: 1, mealName: 'Kip kerrie', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 4),
  });
  const rijst = items.find(i => i.name === 'Basmatirijst');
  assert.equal(rijst.qty, 300);
  assert.equal(rijst.sources.length, 1);
});

test('twee recepten met gedeeld ingredient sommeren qty', () => {
  const k1 = recipeKeyOf(1, 'kk'), k2 = recipeKeyOf(2, 'beef');
  let items = mergeRecipeIntoItems([], {
    recipeKey: k1, day: 1, mealName: 'KK', who: ['peter','miranda'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),  // broccoli 500g
  });
  items = mergeRecipeIntoItems(items, {
    recipeKey: k2, day: 2, mealName: 'Beef', who: ['peter','miranda'],
    scaledIngredients: scaleRecipeIngredients(beef, 2),  // broccoli 250g
  });
  const broc = items.find(i => i.name === 'Broccoli');
  assert.equal(broc.qty, 750);
  assert.equal(broc.sources.length, 2);
});

test('mergeRecipe ververst category bij bestaande items', () => {
  const key = recipeKeyOf(1, 'kk');
  // bestaand item met verkeerde category
  const old = [{
    name: 'Basmatirijst', qty: 0, unit: 'g', store: '',
    category: 'overig', who: ['peter'], partial: false, countOnly: false,
    count: 1, variants: ['Basmatirijst'],
    sources: [{ slug: 'peter', day: 1, slot: 'diner', mealName: 'KK', originalName: 'Basmatirijst', recipeKey: key, qty: 100 }],
    checked: false,
  }];
  const items = mergeRecipeIntoItems(old, {
    recipeKey: key, day: 1, mealName: 'KK', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  const rijst = items.find(i => i.name === 'Basmatirijst');
  assert.equal(rijst.category, 'brood_granen');
});

// ============================================================
// removeRecipeFromItems
// ============================================================
test('remove recipeKey strept items met enkel die source', () => {
  const k1 = recipeKeyOf(1, 'kk');
  let items = mergeRecipeIntoItems([], {
    recipeKey: k1, day: 1, mealName: 'KK', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  items = removeRecipeFromItems(items, k1);
  assert.equal(items.length, 0);
});

test('remove recipeKey behoudt items met andere bronnen', () => {
  const k1 = recipeKeyOf(1, 'kk'), k2 = recipeKeyOf(2, 'beef');
  let items = mergeRecipeIntoItems([], {
    recipeKey: k1, day: 1, mealName: 'KK', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  items = mergeRecipeIntoItems(items, {
    recipeKey: k2, day: 2, mealName: 'Beef', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(beef, 2),
  });
  items = removeRecipeFromItems(items, k1);
  const broc = items.find(i => i.name === 'Broccoli');
  assert.ok(broc, 'broccoli moet blijven via beef');
  assert.equal(broc.qty, 250);
});

// ============================================================
// approvedRecipeKeys / approvedIngredientNamesForRecipe
// ============================================================
test('approvedRecipeKeys leest recipeKeys uit sources', () => {
  const k = recipeKeyOf(1, 'kk');
  const items = mergeRecipeIntoItems([], {
    recipeKey: k, day: 1, mealName: 'KK', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  assert.deepEqual([...approvedRecipeKeys(items)], [k]);
});

test('approvedIngredientNamesForRecipe returnt ingrediënt-namen', () => {
  const k = recipeKeyOf(1, 'kk');
  const items = mergeRecipeIntoItems([], {
    recipeKey: k, day: 1, mealName: 'KK', who: ['peter'],
    scaledIngredients: scaleRecipeIngredients(kipKerrie, 2),
  });
  const names = [...approvedIngredientNamesForRecipe(items, k)].sort();
  assert.deepEqual(names, ['Basmatirijst', 'Broccoli', 'Olijfolie']);
});

// ============================================================
// itemKey
// ============================================================
test('itemKey is consistent voor dezelfde naam/unit/store', () => {
  const a = { name: 'Basmatirijst', unit: 'g', store: '' };
  const b = { name: 'basmatirijst', unit: 'g', store: '' };
  assert.equal(itemKey(a), itemKey(b));
});
