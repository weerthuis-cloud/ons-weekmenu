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
    .select('id, slug, naam, kleur_hue, kcal_doel, eiwit_g_doel, koolh_g_doel, vet_g_doel');
  if (error) throw error;
  cache.profilesBySlug = Object.fromEntries((data || []).map(p => [p.slug, p]));
  return cache.profilesBySlug;
}

// v2.6: macro-targets per profiel updaten.
export async function updateProfileMacros(profileId, { kcal_doel, eiwit_g_doel, koolh_g_doel, vet_g_doel }) {
  const patch = {};
  if (kcal_doel !== undefined) patch.kcal_doel = kcal_doel;
  if (eiwit_g_doel !== undefined) patch.eiwit_g_doel = eiwit_g_doel;
  if (koolh_g_doel !== undefined) patch.koolh_g_doel = koolh_g_doel;
  if (vet_g_doel !== undefined) patch.vet_g_doel = vet_g_doel;
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  cache.profilesBySlug = null;
  notify('profiles');
  return data;
}

// v2.6: favoriet-vlag toggelen op een meal.
export async function setMealFavoriet(id, favoriet) {
  const { error } = await supabase
    .from('meals')
    .update({ favoriet })
    .eq('id', id);
  if (error) throw error;
  cache.meals = null;
  notify('meals');
}

// v2.6: rating-aggregaten per meal ophalen (uit view meal_ratings).
export async function listMealRatings() {
  const { data, error } = await supabase
    .from('meal_ratings')
    .select('meal_id, rating_count, rating_avg');
  if (error) throw error;
  return data || [];
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
    .select('id, week_id, day, slot, porties, rating, meal_id, meal:meals(*)')
    .eq('week_id', weekId);
  if (error) throw error;
  cache.weekMeals.set(weekId, data || []);
  return data || [];
}

export async function setWeekMeal({ weekId, day, slot, mealId, porties }) {
  // v1.2: default porties voor diner = 2 (eters thuis), anders 1.
  const finalPorties = porties ?? (slot === 'diner' ? 2 : 1);
  // Upsert via delete + insert (vermijd ON CONFLICT-perikelen met composite unique).
  await supabase
    .from('week_meals')
    .delete()
    .eq('week_id', weekId)
    .eq('day', day)
    .eq('slot', slot);
  const { data, error } = await supabase
    .from('week_meals')
    .insert({ week_id: weekId, day, slot, meal_id: mealId, porties: finalPorties })
    .select('id, week_id, day, slot, porties, rating, meal_id, meal:meals(*)')
    .single();
  if (error) throw error;
  cache.weekMeals.delete(weekId);
  notify('week_meals');
  return data;
}

// v1.2: porties van een bestaand week_meals-record updaten (UI: 'Eters per diner').
export async function setWeekMealPorties({ id, weekId, porties }) {
  const { error } = await supabase
    .from('week_meals')
    .update({ porties })
    .eq('id', id);
  if (error) throw error;
  if (weekId) cache.weekMeals.delete(weekId);
  notify('week_meals');
}

// v1.3: bulk-update porties voor meerdere records tegelijk. Voorkomt race
// condition waarbij N losse setWeekMealPorties calls N×notify triggeren en
// tussentijds half-bijgewerkte DB-state inlezen.
// v2.11+v2.12: auto-genereer een week op basis van filter + macro-targets.
// filters:
//   dieet[]: alle tags moeten matchen (eiwitrijk/keto/vega/...)
//   cuisine, maxBereidingstijd, alleenFavoriet, kookwijze[]
// opties:
//   behoudBestaande: bool — alleen lege slots vullen, niet overschrijven
//   metSnacks: bool — ook tussendoortjes (snack_ochtend/middag/avond) genereren
//   macroAware: bool — verdeel kcal volgens 25/35/40 over ontbijt/lunch/diner als profile targets gezet
export async function generateWeekMenu({ ownerId, year, week, filters = {}, opties = {} }) {
  const meals = await listMeals();
  const pool = meals.filter(m => {
    if (filters.dieet?.length && !filters.dieet.every(d => (m.dieet || []).includes(d))) return false;
    if (filters.cuisine && m.cuisine !== filters.cuisine) return false;
    if (filters.maxBereidingstijd && m.bereidingstijd > filters.maxBereidingstijd) return false;
    if (filters.alleenFavoriet && !m.favoriet) return false;
    if (filters.kookwijze?.length && !filters.kookwijze.some(k => (m.kookwijze || []).includes(k))) return false;
    return true;
  });

  // Profile + macro-targets ophalen
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', ownerId).single();
  const kcalDoel  = prof?.kcal_doel || null;
  const eiwitDoel = prof?.eiwit_g_doel ? Number(prof.eiwit_g_doel) : null;
  const koolhDoel = prof?.koolh_g_doel ? Number(prof.koolh_g_doel) : null;
  const vetDoel   = prof?.vet_g_doel   ? Number(prof.vet_g_doel)   : null;

  // Slot-distributie: percentage van dagdoel
  const SLOT_PCT = {
    ontbijt: 0.25, snack_ochtend: 0.05, lunch: 0.30, snack_middag: 0.05, diner: 0.30, snack_avond: 0.05,
  };
  const TOLERANCE = 0.50; // ±50% per maaltijd is ruim

  function slotRanges(slot) {
    if (!opties.macroAware || !kcalDoel) return null;
    const pct = SLOT_PCT[slot];
    const r = { kcal: { min: kcalDoel*pct*(1-TOLERANCE), max: kcalDoel*pct*(1+TOLERANCE) } };
    if (opties.perMacroTargets) {
      if (eiwitDoel) r.eiwit = { min: eiwitDoel*pct*(1-TOLERANCE), max: eiwitDoel*pct*(1+TOLERANCE) };
      if (koolhDoel) r.koolh = { min: koolhDoel*pct*(1-TOLERANCE), max: koolhDoel*pct*(1+TOLERANCE) };
      if (vetDoel)   r.vet   = { min: vetDoel  *pct*(1-TOLERANCE), max: vetDoel  *pct*(1+TOLERANCE) };
    }
    return r;
  }

  function consumed(meal) {
    const factor = (Number(meal.serves) > 0) ? 2 : 1; // recipe-meals voor 2 eters
    return {
      kcal:  meal.kcal != null  ? meal.kcal  * factor : null,
      eiwit: meal.eiwit_g != null ? meal.eiwit_g * factor : null,
      koolh: meal.koolh_g != null ? meal.koolh_g * factor : null,
      vet:   meal.vet_g != null   ? meal.vet_g   * factor : null,
    };
  }

  let weekRow = await getWeek(ownerId, year, week);
  if (!weekRow) weekRow = await addWeek({ ownerId, year, week, source: 'eigen' });

  // Bestaande week_meals ophalen om 'behoud bestaande' te respecteren
  const existing = await getWeekMeals(weekRow.id);
  const occupied = new Set();
  if (opties.behoudBestaande) {
    for (const wm of existing) occupied.add(`${wm.day}-${wm.slot}`);
  }

  const slots = opties.metSnacks
    ? ['ontbijt', 'snack_ochtend', 'lunch', 'snack_middag', 'diner', 'snack_avond']
    : ['ontbijt', 'lunch', 'diner'];

  const inserts = [];
  const stats = { ontbijt: 0, snack_ochtend: 0, lunch: 0, snack_middag: 0, diner: 0, snack_avond: 0, mismatch: [] };
  // Anti-saaiheid: recente 5 picks per slot (was 2)
  const recentPicks = Object.fromEntries(slots.map(s => [s, []]));
  const RECENT_WINDOW = 5;

  for (let day = 1; day <= 7; day++) {
    const dayCuisines = new Set(); // v2.13 cuisine-variatie binnen dag
    for (const slot of slots) {
      if (occupied.has(`${day}-${slot}`)) continue;
      const ranges = slotRanges(slot);
      let candidates = pool.filter(m => m.type === slot);

      // Macro-range filter (kcal verplicht, eiwit/koolh/vet optioneel)
      if (ranges) {
        const inRange = candidates.filter(m => {
          const c = consumed(m);
          if (c.kcal == null) return true; // onbekend: laat toe
          if (c.kcal < ranges.kcal.min || c.kcal > ranges.kcal.max) return false;
          if (ranges.eiwit && c.eiwit != null && (c.eiwit < ranges.eiwit.min || c.eiwit > ranges.eiwit.max)) return false;
          if (ranges.koolh && c.koolh != null && (c.koolh < ranges.koolh.min || c.koolh > ranges.koolh.max)) return false;
          if (ranges.vet   && c.vet   != null && (c.vet   < ranges.vet.min   || c.vet   > ranges.vet.max))   return false;
          return true;
        });
        if (inRange.length > 0) candidates = inRange;
      }

      // v2.13 cuisine-variatie binnen dag
      if (opties.cuisineVariatie && dayCuisines.size > 0) {
        const filtered = candidates.filter(m => !m.cuisine || !dayCuisines.has(m.cuisine));
        if (filtered.length > 0) candidates = filtered;
      }

      // Anti-saaiheid via recentPicks
      const fresh = candidates.filter(m => !recentPicks[slot].includes(m.id));
      const choices = fresh.length > 0 ? fresh : candidates;

      if (choices.length === 0) {
        stats.mismatch.push(`${slot} dag ${day}`);
        continue;
      }
      const pick = choices[Math.floor(Math.random() * choices.length)];
      recentPicks[slot].push(pick.id);
      if (recentPicks[slot].length > RECENT_WINDOW) recentPicks[slot].shift();
      if (pick.cuisine) dayCuisines.add(pick.cuisine);
      const porties = (slot === 'diner' && Number(pick.serves) > 0) ? 2 : 1;
      inserts.push({ week_id: weekRow.id, day, slot, meal_id: pick.id, porties });
      stats[slot]++;
    }
  }

  // Wis te-overschrijven slots als behoudBestaande=false
  if (!opties.behoudBestaande) {
    await supabase.from('week_meals').delete().eq('week_id', weekRow.id).in('slot', slots);
  } else {
    // Wis alleen lege slots-keys waar we iets gaan invoegen (om duplicates te voorkomen).
    // Bij behoudBestaande zouden er geen botsingen moeten zijn want we sla occupied over.
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('week_meals').insert(inserts);
    if (error) throw error;
  }

  cache.weekMeals.delete(weekRow.id);
  notify('week_meals');
  return { weekRow, inserted: inserts.length, poolSize: pool.length, stats, kcalDoel };
}

export async function setWeekMealsPorties({ ids, weekIds, porties }) {
  if (!ids?.length) return;
  const { error } = await supabase
    .from('week_meals')
    .update({ porties })
    .in('id', ids);
  if (error) throw error;
  for (const wid of (weekIds || [])) cache.weekMeals.delete(wid);
  notify('week_meals');
}

// v2.3: per-diner beoordeling.
// rating: -1 (niet weer) | 0 (neutraal) | 1 (lekker) | null (geen oordeel)
// Bij -1 wordt de gekoppelde meal soft-deleted zodat het recept uit de bibliotheek
// verdwijnt. Bij wijzigen naar 0/1 wordt de meal automatisch hersteld als hij eerder
// door een -1-actie was verborgen. Oude weken behouden de meal-koppeling.
export async function setWeekMealRating({ id, weekId, mealId, rating }) {
  if (!id) return;
  if (rating != null && ![-1, 0, 1].includes(rating)) {
    throw new Error(`Ongeldige rating: ${rating}`);
  }
  const { error } = await supabase
    .from('week_meals')
    .update({ rating })
    .eq('id', id);
  if (error) throw error;

  if (mealId) {
    if (rating === -1) {
      // soft-delete het recept (idempotent: alleen als nog niet deleted)
      const { error: dErr } = await supabase
        .from('meals')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', mealId)
        .is('deleted_at', null);
      if (dErr) throw dErr;
    } else if (rating === 0 || rating === 1) {
      // restore als eerder verborgen door rating=-1 elders
      const { error: rErr } = await supabase
        .from('meals')
        .update({ deleted_at: null })
        .eq('id', mealId)
        .not('deleted_at', 'is', null);
      if (rErr) throw rErr;
    }
    cache.meals = null;
    notify('meals');
  }

  if (weekId) cache.weekMeals.delete(weekId);
  notify('week_meals');
}

// Verplaats een meal naar een andere dag (zelfde slot, zelfde week).
// Overschrijft bestaande meal in doel-slot.
export async function moveWeekMeal({ weekId, fromDay, toDay, slot, mealId, porties = 1.0 }) {
  if (fromDay === toDay) return;
  // Wis bestaande in doel
  await supabase.from('week_meals').delete()
    .eq('week_id', weekId).eq('day', toDay).eq('slot', slot);
  // Wis bron
  await supabase.from('week_meals').delete()
    .eq('week_id', weekId).eq('day', fromDay).eq('slot', slot);
  // Insert in doel
  const { error } = await supabase.from('week_meals').insert({
    week_id: weekId, day: toDay, slot, meal_id: mealId, porties,
  });
  if (error) throw error;
  cache.weekMeals.delete(weekId);
  notify('week_meals');
}

// Ruil twee meals binnen dezelfde week + slot-type.
export async function swapWeekMeals({ weekId, slot, dayA, mealIdA, portiesA, dayB, mealIdB, portiesB }) {
  if (dayA === dayB) return;
  await supabase.from('week_meals').delete()
    .eq('week_id', weekId).eq('day', dayA).eq('slot', slot);
  await supabase.from('week_meals').delete()
    .eq('week_id', weekId).eq('day', dayB).eq('slot', slot);
  const { error } = await supabase.from('week_meals').insert([
    { week_id: weekId, day: dayA, slot, meal_id: mealIdB, porties: portiesB },
    { week_id: weekId, day: dayB, slot, meal_id: mealIdA, porties: portiesA },
  ]);
  if (error) throw error;
  cache.weekMeals.delete(weekId);
  notify('week_meals');
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

// ============================================================
// v1.8: Backup-export — alle tabellen als één JSON-blob.
// ============================================================
export async function exportAllData() {
  const [profiles, meals, weeks, week_meals, shopping_lists, shopping_notes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('meals').select('*'),
    supabase.from('weeks').select('*'),
    supabase.from('week_meals').select('*'),
    supabase.from('shopping_lists').select('*'),
    supabase.from('shopping_notes').select('*'),
  ]);
  for (const r of [profiles, meals, weeks, week_meals, shopping_lists, shopping_notes]) {
    if (r.error) throw r.error;
  }
  return {
    exportedAt: new Date().toISOString(),
    appVersion: 'v1.8',
    profiles:        profiles.data || [],
    meals:           meals.data || [],
    weeks:           weeks.data || [],
    week_meals:      week_meals.data || [],
    shopping_lists:  shopping_lists.data || [],
    shopping_notes:  shopping_notes.data || [],
  };
}

// ============================================================
// v1.8: AVG-cleanup — verwijder weken (+cascade) ouder dan datum.
// PDFs in storage worden ook gewist als pdf_path bekend is.
// ============================================================
export async function deleteWeeksOlderThan(cutoffYear, cutoffWeek) {
  // Vind te-verwijderen weken
  const { data: weeks, error: e1 } = await supabase
    .from('weeks')
    .select('id, year, week_nr, pdf_path')
    .or(`year.lt.${cutoffYear},and(year.eq.${cutoffYear},week_nr.lt.${cutoffWeek})`);
  if (e1) throw e1;
  if (!weeks?.length) return { deletedWeeks: 0, deletedPdfs: 0 };

  // Verwijder PDFs uit storage
  const pdfPaths = weeks.filter(w => w.pdf_path).map(w => w.pdf_path);
  let deletedPdfs = 0;
  if (pdfPaths.length > 0) {
    const { error: e2 } = await supabase.storage.from('dietist-pdfs').remove(pdfPaths);
    if (!e2) deletedPdfs = pdfPaths.length;
  }

  // Verwijder weeks (cascade wist week_meals + shopping_lists via FK)
  const ids = weeks.map(w => w.id);
  const { error: e3 } = await supabase.from('weeks').delete().in('id', ids);
  if (e3) throw e3;

  cache.weeks.clear();
  cache.weekMeals.clear();
  notify('weeks');
  notify('week_meals');
  notify('shopping_lists');

  return { deletedWeeks: weeks.length, deletedPdfs };
}

// v1.8b: Restore uit backup-JSON. Wist eerst alle huidige data (cascade),
// daarna inserts in volgorde van FK-afhankelijkheden. user_id van profiles
// wordt vervangen door de huidige auth.uid() zodat de import in een ander
// account ook werkt.
export async function restoreFromBackup(backup) {
  // v2.2: schema-validatie vóór delete-fase. Voorkomt dat een corrupt of
  // verkeerd JSON-bestand de DB onbruikbaar maakt.
  if (!backup || typeof backup !== 'object') throw new Error('Backup is leeg of ongeldig.');
  const required = ['profiles', 'meals', 'weeks', 'week_meals', 'shopping_lists'];
  for (const t of required) {
    if (!Array.isArray(backup[t])) throw new Error(`Backup mist tabel '${t}'.`);
  }
  // Per-tabel: minimale veld-checks zodat insert later niet faalt halverwege.
  const checks = [
    ['profiles',       (r) => r && typeof r.id === 'string' && typeof r.naam === 'string'],
    ['meals',          (r) => r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.type === 'string'],
    ['weeks',          (r) => r && typeof r.id === 'string' && Number.isInteger(r.year) && Number.isInteger(r.week_nr)],
    ['week_meals',     (r) => r && typeof r.id === 'string' && typeof r.week_id === 'string' && typeof r.meal_id === 'string'],
    ['shopping_lists', (r) => r && typeof r.id === 'string' && Array.isArray(r.items)],
  ];
  for (const [tabel, check] of checks) {
    const rows = backup[tabel];
    for (let i = 0; i < rows.length; i++) {
      if (!check(rows[i])) {
        throw new Error(`Backup ongeldig: ${tabel}[${i}] mist verplichte velden of heeft verkeerd type.`);
      }
    }
  }
  if (Array.isArray(backup.shopping_notes)) {
    for (let i = 0; i < backup.shopping_notes.length; i++) {
      const r = backup.shopping_notes[i];
      if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') {
        throw new Error(`Backup ongeldig: shopping_notes[${i}] mist verplichte velden.`);
      }
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niet ingelogd — login eerst.');
  const currentUid = user.id;

  // 1. Wis alle huidige data (cascade via FK on delete cascade).
  // Volgorde belangrijk om FK-violations te voorkomen tijdens delete-fase.
  await supabase.from('shopping_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('shopping_lists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('week_meals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('meals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. Insert in juiste volgorde, met user_id-rewrite voor profiles.
  const profiles = backup.profiles.map(p => ({ ...p, user_id: currentUid }));
  if (profiles.length) {
    const { error } = await supabase.from('profiles').insert(profiles);
    if (error) throw new Error('profiles: ' + error.message);
  }
  if (backup.meals.length) {
    const { error } = await supabase.from('meals').insert(backup.meals);
    if (error) throw new Error('meals: ' + error.message);
  }
  if (backup.weeks.length) {
    const { error } = await supabase.from('weeks').insert(backup.weeks);
    if (error) throw new Error('weeks: ' + error.message);
  }
  if (backup.week_meals.length) {
    const { error } = await supabase.from('week_meals').insert(backup.week_meals);
    if (error) throw new Error('week_meals: ' + error.message);
  }
  if (backup.shopping_lists.length) {
    const { error } = await supabase.from('shopping_lists').insert(backup.shopping_lists);
    if (error) throw new Error('shopping_lists: ' + error.message);
  }
  if (Array.isArray(backup.shopping_notes) && backup.shopping_notes.length) {
    const { error } = await supabase.from('shopping_notes').insert(backup.shopping_notes);
    if (error) throw new Error('shopping_notes: ' + error.message);
  }

  clearCache();
  notify('profiles');
  notify('meals');
  notify('weeks');
  notify('week_meals');
  notify('shopping_lists');
  notify('shopping_notes');

  return {
    profiles: profiles.length,
    meals: backup.meals.length,
    weeks: backup.weeks.length,
    week_meals: backup.week_meals.length,
    shopping_lists: backup.shopping_lists.length,
    shopping_notes: backup.shopping_notes?.length || 0,
  };
}

// 'Wis al mijn data' — recht op vergetelheid. Verwijdert alles van de huidige
// auth-user. Profiles van het huishouden, hun weken, week_meals, shopping_lists,
// shopping_notes, en alle PDFs uit storage. Soft delete-meals (zonder owner) blijven.
export async function wipeAllUserData() {
  // Haal alle PDFs eerst
  const { data: weeks } = await supabase.from('weeks').select('id, pdf_path');
  const pdfPaths = (weeks || []).filter(w => w.pdf_path).map(w => w.pdf_path);
  if (pdfPaths.length > 0) {
    await supabase.storage.from('dietist-pdfs').remove(pdfPaths);
  }
  // Cascade via profiles delete (FK on delete cascade)
  const { data: profiles, error: e1 } = await supabase.from('profiles').select('id');
  if (e1) throw e1;
  if (profiles?.length) {
    const ids = profiles.map(p => p.id);
    const { error: e2 } = await supabase.from('profiles').delete().in('id', ids);
    if (e2) throw e2;
  }
  clearCache();
  notify('profiles');
  notify('weeks');
  notify('week_meals');
  notify('shopping_lists');
  notify('shopping_notes');
  return { deletedProfiles: profiles?.length || 0, deletedPdfs: pdfPaths.length };
}
