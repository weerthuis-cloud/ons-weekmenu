// Unit tests voor lib/categorie.js — classifier (keyword + substring fallback).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIngredient, categoryLabel } from '../src/lib/categorie.js';

const cases = [
  // exact-match
  ['kwark, volle',     'zuivel_eieren'],
  ['olijfolie',        'kruiden_sausen'],
  ['broccoli',         'groente_fruit'],
  ['kip',              'vlees_vis'],
  ['rijst',            'brood_granen'],

  // toegevoegd in v1.5b
  ['kefir',            'zuivel_eieren'],
  ['roerei',           'zuivel_eieren'],
  ['kookzuivel',       'zuivel_eieren'],
  ['kokossnippers',    'houdbaar'],
  ['pecannoten',       'houdbaar'],
  ['basmatirijst',     'brood_granen'],
  ['kipfiletreepjes',  'vlees_vis'],
  ['bouillontablet',   'kruiden_sausen'],
  ['krulpeterselie',   'groente_fruit'],
  ['beleg',            'vlees_vis'],

  // edge cases
  ['',                 'overig'],
  ['onbekend ingredient',  'overig'],
];

for (const [input, expected] of cases) {
  test(`classify "${input}" → ${expected}`, () => {
    const got = classifyIngredient(input);
    assert.equal(got, expected, `verwacht ${expected} (${categoryLabel(expected)}), kreeg ${got} (${categoryLabel(got)})`);
  });
}
