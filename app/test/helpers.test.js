// Tests voor v1.9 + v2.0 helpers (negeer-lijst, dag-filter, recipe-days,
// classifier substring-fallback voor compound names).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIngredient, categoryLabel } from '../src/lib/categorie.js';
import { normalizeName, scaleRecipeIngredients, mergeRecipeIntoItems, recipeKeyOf } from '../src/lib/shopping.js';

// ============================================================
// classifier substring-fallback met komma's en bereiding
// ============================================================
const compoundCases = [
  // De gemelde regressie van v2.0b
  ['Biefstuk, gebakken in roomboter', 'vlees_vis'],
  ['Kipfilet, gebakken in roomboter', 'vlees_vis'],
  ['Kipfiletreepjes',                 'vlees_vis'],
  ['Vega balletjes / rundergehakt',   'vlees_vis'],
  ['Tonijnstukken (blik)',            'vlees_vis'],
  // zuivel met bereiding
  ['Roerei',                          'zuivel_eieren'],
  ['Kookzuivel',                      'zuivel_eieren'],
  // brood/granen compounds
  ['Basmatirijst',                    'brood_granen'],
  ['Volkoren penne',                  'brood_granen'],
  // Diner-specifieke recepten
  ['Bouillontablet',                  'kruiden_sausen'],
  ['Krulpeterselie',                  'groente_fruit'],
  // edge: lege string / onbekend
  ['',                                'overig'],
  ['onbekend ingredient xyz',         'overig'],
];

for (const [raw, expected] of compoundCases) {
  test(`classifier (compound): "${raw}" → ${expected}`, () => {
    const got = classifyIngredient(normalizeName(raw));
    assert.equal(got, expected,
      `verwacht ${categoryLabel(expected)}, kreeg ${categoryLabel(got)} (${got})`);
  });
}

// ============================================================
// normalizeName randgevallen
// ============================================================
test('normalizeName strip parens', () => {
  assert.equal(normalizeName('Beleg (voor 2 sneetjes)'), 'beleg');
});
test('normalizeName strip bereiding', () => {
  assert.equal(normalizeName('Ei, gebakken'), 'ei');
});
test('normalizeName strip "naar keuze"', () => {
  assert.equal(normalizeName('Kaas naar keuze'), 'kaas');
});
test('normalizeName behoudt slash voor varianten', () => {
  assert.equal(normalizeName('Blauwe bessen/frambozen'), 'blauwe bessen/frambozen');
});

// ============================================================
// itemHasDayInSelection / itemQtyForSelection
// (logic intern in views/shopping.js maar makkelijker hier los te
//  testen door de helpers te dupliceren als pure functies)
// ============================================================

function itemHasDayInSelection(item, selectedDays) {
  const sources = item.sources || [];
  if (sources.length === 0) return true;
  return sources.some(s => !s.day || selectedDays.has(s.day));
}

function itemQtyForSelection(item, selectedDays) {
  const sources = item.sources || [];
  if (sources.length === 0) return { qty: item.qty, partial: false, count: 0, countOnly: false };
  let qty = 0; let missing = false; let count = 0;
  for (const s of sources) {
    if (s.day && !selectedDays.has(s.day)) continue;
    count += 1;
    if (s.qty == null) missing = true;
    else qty += Number(s.qty);
  }
  return {
    qty: qty > 0 ? qty : null,
    partial: missing && qty > 0,
    count,
    countOnly: qty === 0 && missing,
  };
}

test('itemHasDayInSelection: source op dag in selectie → zichtbaar', () => {
  const item = { sources: [{ day: 1, qty: 100 }, { day: 3, qty: 50 }] };
  assert.equal(itemHasDayInSelection(item, new Set([3, 4])), true);
});
test('itemHasDayInSelection: geen source in selectie → onzichtbaar', () => {
  const item = { sources: [{ day: 1, qty: 100 }] };
  assert.equal(itemHasDayInSelection(item, new Set([3, 4])), false);
});
test('itemHasDayInSelection: legacy zonder sources → altijd zichtbaar', () => {
  const item = { sources: [] };
  assert.equal(itemHasDayInSelection(item, new Set([1])), true);
});

test('itemQtyForSelection: alleen geselecteerde dagen sommeren', () => {
  const item = { sources: [
    { day: 1, qty: 100 },
    { day: 2, qty: 200 },
    { day: 3, qty: 300 },
  ] };
  const r = itemQtyForSelection(item, new Set([1, 3]));
  assert.equal(r.qty, 400);   // 100 + 300, niet 600
  assert.equal(r.count, 2);
});

test('itemQtyForSelection: alle dagen geselecteerd → volledige som', () => {
  const item = { sources: [{ day: 1, qty: 100 }, { day: 5, qty: 50 }] };
  const r = itemQtyForSelection(item, new Set([1,2,3,4,5,6,7]));
  assert.equal(r.qty, 150);
});

test('itemQtyForSelection: source zonder qty markeert partial', () => {
  const item = { sources: [{ day: 1, qty: 100 }, { day: 1, qty: null }] };
  const r = itemQtyForSelection(item, new Set([1]));
  assert.equal(r.qty, 100);
  assert.equal(r.partial, true);
});

// ============================================================
// recipeDaysFor
// ============================================================
function recipeDaysFor(item) {
  const days = new Set();
  for (const s of (item.sources || [])) {
    if (s.recipeKey && s.day) days.add(s.day);
  }
  return [...days].sort((a, b) => a - b);
}

test('recipeDaysFor: alleen recipe-bronnen tellen', () => {
  const item = { sources: [
    { day: 1, qty: 100 },                          // solo, geen recipeKey
    { day: 2, qty: 50, recipeKey: '2::abc' },
    { day: 4, qty: 80, recipeKey: '4::xyz' },
  ] };
  assert.deepEqual(recipeDaysFor(item), [2, 4]);
});

test('recipeDaysFor: solo-only item → lege array (geen stipje)', () => {
  const item = { sources: [{ day: 1, qty: 100 }, { day: 2, qty: 50 }] };
  assert.deepEqual(recipeDaysFor(item), []);
});

test('recipeDaysFor: dedupeert dezelfde dag', () => {
  const item = { sources: [
    { day: 3, qty: 50, recipeKey: '3::a' },
    { day: 3, qty: 30, recipeKey: '3::a' },        // dubbele entry zelfde dag
  ] };
  assert.deepEqual(recipeDaysFor(item), [3]);
});

// ============================================================
// negeer-lijst (lib/ignored.js basis-functioneel)
// ============================================================
// We mocken localStorage want node draait zonder browser.
globalThis.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
};
const { loadIgnored, saveIgnored, addIgnored, removeIgnored } = await import('../src/lib/ignored.js');

test('ignored: addIgnored + loadIgnored persistent', () => {
  globalThis.localStorage._store = {};
  addIgnored('water');
  addIgnored('zout');
  const list = loadIgnored().sort();
  assert.deepEqual(list, ['water', 'zout']);
});

test('ignored: removeIgnored haalt eruit', () => {
  globalThis.localStorage._store = {};
  addIgnored('water');
  addIgnored('zout');
  removeIgnored('water');
  assert.deepEqual(loadIgnored(), ['zout']);
});

test('ignored: saveIgnored met Set werkt', () => {
  globalThis.localStorage._store = {};
  saveIgnored(new Set(['peper', 'zout']));
  const list = loadIgnored().sort();
  assert.deepEqual(list, ['peper', 'zout']);
});
