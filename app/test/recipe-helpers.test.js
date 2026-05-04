import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecipeIncomplete, dayColor, DAY_HUE } from '../src/lib/recipe-helpers.js';

test('isRecipeIncomplete: meal zonder serves', () => {
  assert.equal(isRecipeIncomplete({ serves: null, ingredients: [{}] }), true);
});
test('isRecipeIncomplete: meal zonder ingredients', () => {
  assert.equal(isRecipeIncomplete({ serves: 4, ingredients: [] }), true);
});
test('isRecipeIncomplete: compleet recept', () => {
  assert.equal(isRecipeIncomplete({ serves: 4, ingredients: [{}] }), false);
});
test('isRecipeIncomplete: null meal', () => {
  assert.equal(isRecipeIncomplete(null), false);
});

test('dayColor returnt oklch-string per dag', () => {
  assert.match(dayColor(1), /oklch.*280/);
  assert.match(dayColor(7), /oklch.*175/);
});

test('DAY_HUE heeft 7 dagen', () => {
  assert.equal(Object.keys(DAY_HUE).length, 7);
});
