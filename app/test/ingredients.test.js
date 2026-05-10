// Tests voor lib/ingredients.js — canonical-mapping (v2.16).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setAliasMap,
  getAliasMapSize,
  canonicalKey,
  canonicalKeysOfIngredients,
} from '../src/lib/ingredients.js';

test('canonicalKey: zonder aliases valt terug op normalizeName', () => {
  setAliasMap([]);
  assert.equal(canonicalKey('Courgette'), 'courgette');
  assert.equal(canonicalKey('Quinoasalade'), 'quinoasalade');
});

test('canonicalKey: alias mapping werkt voor ui-cluster', () => {
  setAliasMap([
    { raw_key: 'uien',             canonical_key: 'ui' },
    { raw_key: 'rode ui',          canonical_key: 'ui' },
    { raw_key: 'rode uien',        canonical_key: 'ui' },
    { raw_key: 'middelgrote uien', canonical_key: 'ui' },
  ]);
  assert.equal(canonicalKey('Rode uien'), 'ui');
  assert.equal(canonicalKey('uien'), 'ui');
  assert.equal(canonicalKey('Middelgrote uien'), 'ui');
});

test('canonicalKey: null in alias = skip', () => {
  setAliasMap([{ raw_key: 'keukenmachine', canonical_key: null }]);
  assert.equal(canonicalKey('Keukenmachine'), null);
});

test('canonicalKey: gaat door normalizeName-strip heen (bereiding)', () => {
  setAliasMap([{ raw_key: 'ei', canonical_key: 'ei' }]);
  // 'Ei, gebakken' -> normalize -> 'ei' -> alias-hit -> 'ei'
  assert.equal(canonicalKey('Ei, gebakken'), 'ei');
  assert.equal(canonicalKey('Ei (omelet)'), 'ei');
});

test('canonicalKey: roerei via normalizeName + alias', () => {
  setAliasMap([{ raw_key: 'ei', canonical_key: 'ei' }]);
  // shopping.normalizeName mapt 'roerei' -> 'ei' (v2.14)
  assert.equal(canonicalKey('Roerei'), 'ei');
});

test('canonicalKey: lege input', () => {
  setAliasMap([]);
  assert.equal(canonicalKey(''), '');
  assert.equal(canonicalKey(null), '');
  assert.equal(canonicalKey(undefined), '');
});

test('canonicalKeysOfIngredients: dedupe + skip nulls', () => {
  setAliasMap([
    { raw_key: 'rode uien',     canonical_key: 'ui' },
    { raw_key: 'uien',          canonical_key: 'ui' },
    { raw_key: 'keukenmachine', canonical_key: null },
  ]);
  const keys = canonicalKeysOfIngredients([
    { name: 'Rode uien' },
    { name: 'uien' },
    { name: 'Keukenmachine' },
    { name: 'Courgette' },
    { name: '' },
    { name: null },
  ]);
  assert.deepEqual([...keys].sort(), ['courgette', 'ui']);
});

test('getAliasMapSize: telt aliases', () => {
  setAliasMap([
    { raw_key: 'a', canonical_key: 'A' },
    { raw_key: 'b', canonical_key: 'B' },
    { raw_key: 'c', canonical_key: null },
  ]);
  assert.equal(getAliasMapSize(), 3);
});

test('canonicalKeysOfIngredients: lege/onzin input geeft lege Set', () => {
  setAliasMap([]);
  const keys = canonicalKeysOfIngredients(null);
  assert.equal(keys.size, 0);
});
