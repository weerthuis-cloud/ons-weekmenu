// Query-helpers boven Supabase.
// Eenvoudige cache met invalidate per write. Cache is per sessie.

import { supabase } from './supabase.js';

const cache = {
  meals: null,
  profilesBySlug: null,   // { peter: {...}, miranda: {...} }
  weeks: new Map(),       // key: `${ownerId}-${year}-${week}` → week-row
  weekMeals: new Map(),   // key: weekId → array van rows
};

const listeners = new Set();

export function onDataChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(scope) {
  for (const cb of listeners) cb(scope);
}

export function clearCache() {
  cache.meals = null;
  cache.profilesBySlug = null;
  cache.weeks.clear();
  cache.weekMeals.clear();
}

// ============================================================
// Profielen
// ============================================================
export async function listProfiles() {
  if (cache.profilesBySlug) return cache.profilesBySlug;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, naam, kleur_hue');
  if (error) throw error;
  cache.profilesBySlug = Object.fromEntries((data || []).map(p => [p.slug, p]));
  return cache.profilesBySlug;
}

// ============================================================
// Maaltijden
// ============================================================
export async function listMeals({ includeDeleted = false } = {}) {
  if (cache.meals && !includeDeleted) return cache.meals;
  let q = supabase.from('meals').select('*').order('name', { ascending: true });
  if (!includeDeleted) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  if (!includeDeleted) cache.meals = data || [];
  return data || [];
}

export async function addMeal(meal) {
  const { data, error } = await supabase
    .from('meals')
    .insert(meal)
    .select()
    .single();
  if (error) throw error;
  cache.meals = null;
  notify('meals');
  return data;
}

export async function updateMeal(id, patch) {
  const { data, error } = await supabase
    .from('meals')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  cache.meals = null;
  cache.weekMeals.clear(); // joined meal-data kan zijn veranderd
  notify('meals');
  return data;
}

export async function softDeleteMeal(id) {
  const { error } = await supabase
    .from('meals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  cache.meals = null;
  notify('meals');
}

// ============================================================
// Weken
// ============================================================
function weekKey(ownerId, year, week) {
  return `${ownerId}-${year}-${week}`;
}

export async function getWeek(ownerId, year, week) {
  const key = weekKey(ownerId, year, week);
  if (cache.weeks.has(key)) return cache.weeks.get(key);
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('owner', ownerId)
    .eq('year', year)
    .eq('week_nr', week)
    .maybeSingle();
  if (error) throw error;
  cache.weeks.set(key, data);
  return data;
}

export async function listWeeks({ ownerId } = {}) {
  let q = supabase.from('weeks').select('id, owner, year, week_nr, source, notitie, created_at')
    .order('year', { ascending: false })
    .order('week_nr', { ascending: false });
  if (ownerId) q = q.eq('owner', ownerId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Tel ingevulde slots per week (één query)
export async function countSlotsByWeek(weekIds) {
  if (!weekIds?.length) return {};
  const { data, error } = await supabase
    .from('week_meals')
    .select('week_id')
    .in('week_id', weekIds);
  if (error) throw error;
  const counts = {};
  for (const row of data || []) counts[row.week_id] = (counts[row.week_id] || 0) + 1;
  return counts;
}

export async function duplicateWeekMeals(srcWeekId, dstWeekId) {
  // Lees alle src-rows
  const { data: srcRows, error: e1 } = await supabase
    .from('week_meals').select('day, slot, meal_id, porties').eq('week_id', srcWeekId);
  if (e1) throw e1;
  if (!srcRows?.length) return [];
  // Wis bestaande dst (de doel-week kan al rijen hebben)
  await supabase.from('week_meals').delete().eq('week_id', dstWeekId);
  const insert = srcRows.map(r => ({ ...r, week_id: dstWeekId }));
  const { data, error } = await supabase.from('week_meals').insert(insert).select();
  if (error) throw error;
  cache.weekMeals.delete(dstWeekId);
  notify('week_meals');
  return data;
}

export async function addWeek({ ownerId, year, week, source = 'eigen', notitie = null }) {
  const { data, error } = await supabase
    .from('weeks')
    .insert({ owner: ownerId, year, week_nr: week, source, notitie })
    .select()
    .single();
  if (error) throw error;
  cache.weeks.set(weekKey(ownerId, year, week), data);
  notify('weeks');
  return data;
}

// ============================================================
// week_meals
// ============================================================
export async function getWeekMeals(weekId) {
  if (!weekId) return [];
  if (cache.weekMeals.has(weekId)) return cache.weekMeals.get(weekId);
  const { data, error } = await supabase
    .from('week_meals')
    .select('id, week_id, day, slot, porties, meal:meals(*)')
    .eq('week_id', weekId);
  if (error) throw error;
  cache.weekMeals.set(weekId, data || []);
  return data || [];
}

export async function setWeekMeal({ weekId, day, slot, mealId, porties = 1.0 }) {
  // Upsert via delete + insert (vermijd ON CONFLICT-perikelen met composite unique).
  await supabase
    .from('week_meals')
    .delete()
    .eq('week_id', weekId)
    .eq('day', day)
    .eq('slot', slot);
  const { data, error } = await supabase
    .from('week_meals')
    .insert({ week_id: weekId, day, slot, meal_id: mealId, porties })
    .select('id, week_id, day, slot, porties, meal:meals(*)')
    .single();
  if (error) throw error;
  cache.weekMeals.delete(weekId);
  notify('week_meals');
  return data;
}

export async function removeWeekMeal({ weekId, day, slot }) {
  const { error } = await supabase
    .from('week_meals')
    .delete()
    .eq('week_id', weekId)
    .eq('day', day)
    .eq('slot', slot);
  if (error) throw error;
  cache.weekMeals.delete(weekId);
  notify('week_meals');
}

// ============================================================
// Boodschappenlijsten
// ============================================================

// Haal de meest recente lijst voor een gegeven (owner, weekIds-set) op.
// weekIds wordt vergeleken als sorted-array-of-strings via @>/<@ overlap-trick.
export async function getShoppingList({ ownerId, weekIds }) {
  const sortedIds = [...weekIds].sort();
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('owner', ownerId)
    .contains('week_ids', sortedIds)
    .containedBy('week_ids', sortedIds)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createShoppingList({ ownerId, weekIds, items }) {
  const sortedIds = [...weekIds].sort();
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({ owner: ownerId, week_ids: sortedIds, items })
    .select()
    .single();
  if (error) throw error;
  notify('shopping_lists');
  return data;
}

export async function updateShoppingList({ id, items }) {
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ items, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  notify('shopping_lists');
  return data;
}

export async function deleteShoppingList(id) {
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
  if (error) throw error;
  notify('shopping_lists');
}

// ============================================================
// Bulk PDF-import
// ============================================================

/**
 * Importeer een hele week vanuit gestructureerde data (uit PDF-edit-grid).
 * @param {object} opts
 * @param {string} opts.ownerId  uuid van profile
 * @param {number} opts.year
 * @param {number} opts.week
 * @param {'dietist'|'eigen'} opts.source
 * @param {string|null} opts.pdfPath  Pad in storage bucket (of null)
 * @param {Array<{day, slot, name, kcal?, ingredients?, suitableFor?}>} opts.entries
 * @returns week + week_meals
 */
export async function importWeek({ ownerId, year, week, source = 'dietist', pdfPath = null, entries }) {
  // 1. Maak of pak bestaande week
  let weekRow = await getWeek(ownerId, year, week);
  if (!weekRow) {
    weekRow = await addWeek({ ownerId, year, week, source, notitie: null });
  }
  if (pdfPath) {
    await supabase.from('weeks').update({ pdf_path: pdfPath, source }).eq('id', weekRow.id);
  }

  // 2. Maak meals aan en koppel aan week_meals
  // Heuristiek: voor elke entry maken we een nieuwe meal-row (geen dedupe op naam, om import-historie te bewaren).
  const inserts = [];
  for (const e of entries) {
    if (!e.name?.trim()) continue;
    const { data: meal, error: mealErr } = await supabase.from('meals').insert({
      name: e.name.trim(),
      type: e.slot,
      kcal: e.kcal ?? null,
      ingredients: e.ingredients ?? [],
      suitable_for: e.suitableFor ?? ['beiden'],
    }).select().single();
    if (mealErr) throw mealErr;
    inserts.push({ week_id: weekRow.id, day: e.day, slot: e.slot, meal_id: meal.id, porties: 1.0 });
  }

  if (inserts.length > 0) {
    // Wis bestaande week_meals voor deze week-slot-combinaties die we gaan vervangen
    for (const ins of inserts) {
      await supabase.from('week_meals').delete()
        .eq('week_id', ins.week_id).eq('day', ins.day).eq('slot', ins.slot);
    }
    const { error: wmErr } = await supabase.from('week_meals').insert(inserts);
    if (wmErr) throw wmErr;
  }

  // 3. Cache invalidate
  cache.meals = null;
  cache.weekMeals.delete(weekRow.id);
  notify('week_meals');
  notify('meals');

  return weekRow;
}

// ============================================================
// shopping_notes (snelle noties → beslissen of ze op de lijst komen)
// ============================================================

export async function listOpenNotes() {
  const { data, error } = await supabase
    .from('shopping_notes')
    .select('id, owner, name, qty, unit, status, created_at, profiles:profiles!owner(slug, naam)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addNote({ ownerId, name, qty = null, unit = null }) {
  const { data, error } = await supabase
    .from('shopping_notes')
    .insert({ owner: ownerId, name: name.trim(), qty, unit })
    .select()
    .single();
  if (error) throw error;
  notify('shopping_notes');
  return data;
}

export async function dismissNote(id) {
  const { error } = await supabase
    .from('shopping_notes')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  notify('shopping_notes');
}

export async function deleteNote(id) {
  const { error } = await supabase.from('shopping_notes').delete().eq('id', id);
  if (error) throw error;
  notify('shopping_notes');
}

// Markeer notitie als 'added' (vermeld welke shopping_list hem opnam, optioneel).
export async function markNoteAdded(id, shoppingListId = null) {
  const { error } = await supabase
    .from('shopping_notes')
    .update({ status: 'added', added_to_list_id: shoppingListId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  notify('shopping_notes');
}

// ============================================================
// PDF storage (private bucket 'dietist-pdfs')
// ============================================================

export async function uploadDietistPdf(file, { ownerId, year, week }) {
  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${ownerId}/${year}-w${String(week).padStart(2, '0')}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from('dietist-pdfs')
    .upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return path;
}

export async function getPdfDownloadUrl(path, expiresIn = 60) {
  const { data, error } = await supabase.storage
    .from('dietist-pdfs')
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
