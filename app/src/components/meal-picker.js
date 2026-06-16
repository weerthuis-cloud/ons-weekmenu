// Meal-picker modal: zoek bestaande maaltijd of maak inline een nieuwe aan.
// Module-state. Mount via openMealPicker({ slot, onPick }).

import { html, render } from 'lit-html';
import { ref } from 'lit-html/directives/ref.js';
import { listMeals, addMeal, updateMeal, softDeleteMeal } from '../lib/data.js';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { UNITS } from '../lib/units.js';
import { SlotIcon } from './slot-icon.js';
import { openMealScheduler } from './meal-scheduler.js';

// v2.7b: auto-grow textarea zodat bereidingswijze in z'n geheel zichtbaar is, geen scrollbalk.
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
}

function emptyIngredient() {
  return { name: '', qty: '', unit: '' };
}

// v2.30: bereidingswijze opdelen in stappen (per regel, of per "1. 2. 3." op één regel).
function parseSteps(text) {
  if (!text) return [];
  const t = String(text).trim();
  if (!t) return [];
  const parts = t.includes('\n') ? t.split(/\n+/) : t.split(/\s*(?=\d+[.)]\s)/);
  return parts
    .map(s => s.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function mealToDraft(meal, fallbackSlot = '') {
  return {
    name: meal?.name ?? '',
    kcal: meal?.kcal ?? '',
    type: meal?.type ?? fallbackSlot,
    bereidingstijd: meal?.bereidingstijd ?? '',
    cuisine: meal?.cuisine ?? '',
    hoofdingredient: meal?.hoofdingredient ?? '',
    kookwijze: meal?.kookwijze?.length ? [...meal.kookwijze] : [],
    dieet: meal?.dieet?.length ? [...meal.dieet] : [],
    recipe: meal?.recipe ?? '',
    description: meal?.description ?? '',
    source_url: meal?.source_url ?? '',
    image_url: meal?.image_url ?? '',
    suitable_for: meal?.suitable_for?.length ? [...meal.suitable_for] : ['beiden'],
    ingredients: (meal?.ingredients?.length ? meal.ingredients : [null]).map(i => ({
      name: i?.name ?? '',
      qty: i?.qty ?? '',
      unit: i?.unit ?? '',
      // store: bewust niet meer in UI; bestaande waarde blijft in DB-record bewaard tot save.
      _origStore: i?.store ?? null,
    })),
  };
}

// Vaste lijsten voor de meta-velden (gespiegeld aan views/build.js).
const PICKER_CUISINES = ['', 'italiaans', 'mexicaans', 'aziatisch', 'indiaas', 'frans', 'hollands', 'mediterraan', 'amerikaans', 'bbq'];
const PICKER_HOOFD    = ['', 'kip', 'rund', 'varken', 'lam', 'vis', 'vegetarisch', 'pasta', 'rijst', 'aardappel', 'brood', 'ei', 'zuivel'];
const PICKER_KOOKWIJZE= ['oven', 'airfryer', 'eenpans', 'traybake', 'wok', 'soep', 'salade', 'grill', 'pasta', 'stamppot', 'slowcooker', 'smoothie'];
const PICKER_DIEET    = ['eiwitrijk', 'koolhydraatrijk', 'vezelrijk', 'keto', 'vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij', 'koolhydraatarm'];
// v2.25: max-kooktijd-buckets voor de filterbalk in kies-modus. [waarde, label, test].
const PICKER_KOOKTIJD = [
  ['', '— geen limiet —', () => true],
  ['15', '≤ 15 min', (t) => t != null && t <= 15],
  ['30', '≤ 30 min', (t) => t != null && t <= 30],
  ['45', '≤ 45 min', (t) => t != null && t <= 45],
  ['60', '≤ 60 min', (t) => t != null && t <= 60],
];

// v2.26: type-buckets voor de keuzeknoppen in kies-modus. Tussendoor = alle snack-types samen.
const TYPE_BUCKETS = [
  ['ontbijt',    'Ontbijt',    ['ontbijt']],
  ['lunch',      'Lunch',      ['lunch']],
  ['diner',      'Diner',      ['diner']],
  ['tussendoor', 'Tussendoor', ['snack_ochtend', 'snack_middag', 'snack_avond']],
];
function bucketForSlot(slot) {
  return (slot === 'ontbijt' || slot === 'lunch' || slot === 'diner') ? slot : 'tussendoor';
}
function typesForBucket(bucket) {
  const b = TYPE_BUCKETS.find(x => x[0] === bucket);
  return b ? b[2] : [];
}

// v2.25: lege/begin-staat voor de filters in kies-modus.
function emptyFilters() {
  return { dieet: new Set(), kookwijze: new Set(), cuisine: '', hoofd: '', maxTijd: '', favoriet: false };
}

const HOST_ID = '__meal_picker_host';

const ui = {
  open: false,
  mode: 'pick',     // 'pick' | 'create' | 'edit'
  slot: null,       // 'ontbijt' | etc.
  typeBucket: null, // v2.26: gekozen type-bucket in kies-modus (ontbijt/lunch/diner/tussendoor)
  editing: null,    // meal-row in edit-modus
  search: '',
  filters: emptyFilters(),  // v2.25: extra filters in kies-modus
  filtersOpen: false,       // v2.25: inklapbare filterbalk
  recipeEdit: false,        // v2.30: bereidingswijze in tekstvak (true) of als lijst (false)
  meals: [],
  onPick: null,
  onSaved: null,    // edit-callback
  busy: false,
  error: null,
  // draft-data voor 'create' en 'edit'
  draft: { name: '', kcal: '', type: '', bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], recipe: '', description: '', source_url: '', image_url: '', suitable_for: ['beiden'], ingredients: [emptyIngredient()] },
};

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

function rerender() {
  const host = ensureHost();
  render(view(), host);
}

export async function openMealPicker({ slot, suggestedSuitableFor = 'beiden', onPick }) {
  ui.open = true;
  ui.mode = 'pick';
  ui.slot = slot;
  ui.editing = null;
  ui.search = '';
  ui.typeBucket = bucketForSlot(slot);
  ui.filters = emptyFilters();
  ui.filtersOpen = false;
  ui.error = null;
  ui.onPick = onPick;
  ui.onSaved = null;
  ui.draft = { name: '', kcal: '', type: slot, bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], recipe: '', description: '', source_url: '', image_url: '', suitable_for: [suggestedSuitableFor], ingredients: [emptyIngredient()] };
  ui.meals = [];
  rerender();
  try {
    ui.meals = await listMeals();
  } catch (err) {
    ui.error = err.message;
  }
  rerender();
}

export function openMealEditor({ meal, onSaved }) {
  ui.open = true;
  ui.mode = 'edit';
  ui.editing = meal;
  ui.slot = meal.type;
  ui.error = null;
  ui.onPick = null;
  ui.onSaved = onSaved;
  ui.draft = mealToDraft(meal);
  ui.recipeEdit = !meal.recipe;  // bestaand recept: toon als lijst; leeg: meteen typen
  rerender();
}

// Maak een nieuwe maaltijd zonder slot-context (vanuit Maker). Opent direct in create-modus.
export function openMealCreator({ defaultType = 'ontbijt', onSaved } = {}) {
  ui.open = true;
  ui.mode = 'create';
  ui.editing = null;
  ui.slot = defaultType;
  ui.error = null;
  ui.onSaved = onSaved;
  // Wanneer onPick null is en mode='create', behandel save als 'add then close+notify'
  ui.onPick = onSaved ? ((meal) => onSaved(meal)) : null;
  ui.draft = { name: '', kcal: '', type: defaultType, bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], recipe: '', description: '', source_url: '', image_url: '', suitable_for: ['beiden'], ingredients: [emptyIngredient()] };
  ui.recipeEdit = true;
  rerender();
}

function close() {
  ui.open = false;
  rerender();
}

function pick(meal) {
  if (ui.onPick) ui.onPick(meal);
  close();
}

async function saveDraft(e) {
  e.preventDefault();
  ui.busy = true;
  ui.error = null;
  rerender();
  try {
    const payload = {
      name: ui.draft.name.trim(),
      type: ui.draft.type,
      kcal: ui.draft.kcal ? parseInt(ui.draft.kcal, 10) : null,
      bereidingstijd: ui.draft.bereidingstijd ? parseInt(ui.draft.bereidingstijd, 10) : null,
      cuisine: ui.draft.cuisine || null,
      hoofdingredient: ui.draft.hoofdingredient || null,
      kookwijze: ui.draft.kookwijze || [],
      dieet: ui.draft.dieet || [],
      recipe: ui.draft.recipe?.trim() || null,
      description: ui.draft.description?.trim() || null,
      source_url: ui.draft.source_url?.trim() || null,
      image_url: ui.draft.image_url?.trim() || null,
      ingredients: ui.draft.ingredients
        .filter(ing => ing.name.trim())
        .map(ing => ({
          name: ing.name.trim(),
          qty: ing.qty === '' || ing.qty == null ? null : Number(ing.qty),
          unit: ing.unit || null,
          // store-veld behouden uit origineel zodat oude data niet verloren gaat;
          // nieuwe rijen (zonder _origStore) krijgen null.
          store: ing._origStore ?? null,
        })),
      suitable_for: ui.draft.suitable_for,
    };
    if (ui.mode === 'edit' && ui.editing) {
      const updated = await updateMeal(ui.editing.id, payload);
      if (ui.onSaved) ui.onSaved(updated);
      close();
    } else {
      const meal = await addMeal(payload);
      pick(meal);
    }
  } catch (err) {
    ui.error = err.message;
    ui.busy = false;
    rerender();
  }
}

async function softDeleteCurrent() {
  if (!ui.editing) return;
  if (!confirm(`"${ui.editing.name}" verwijderen uit de bibliotheek?\n\nDe maaltijd blijft zichtbaar in oude weken waar hij al gebruikt is.`)) return;
  ui.busy = true; rerender();
  try {
    await softDeleteMeal(ui.editing.id);
    if (ui.onSaved) ui.onSaved(null);
    close();
  } catch (err) {
    ui.error = err.message;
    ui.busy = false;
    rerender();
  }
}

function addIngredientRow() {
  ui.draft.ingredients.push(emptyIngredient());
  rerender();
}

function removeIngredientRow(i) {
  ui.draft.ingredients.splice(i, 1);
  if (ui.draft.ingredients.length === 0) ui.draft.ingredients.push(emptyIngredient());
  rerender();
}

// v2.25: filter-helpers voor kies-modus.
function toggleFilterSet(key, val) {
  const set = ui.filters[key];
  if (set.has(val)) set.delete(val); else set.add(val);
  rerender();
}

function clearFilters() {
  ui.filters = emptyFilters();
  rerender();
}

function activeFilterCount() {
  const f = ui.filters;
  return f.dieet.size + f.kookwijze.size
    + (f.cuisine ? 1 : 0) + (f.hoofd ? 1 : 0) + (f.maxTijd ? 1 : 0) + (f.favoriet ? 1 : 0);
}

// Past de extra filters toe (semantiek gespiegeld aan Bibliotheek: multi = AND, enkel = gelijkheid).
function applyExtraFilters(list) {
  const f = ui.filters;
  return list.filter(m => {
    if (f.cuisine && m.cuisine !== f.cuisine) return false;
    if (f.hoofd && m.hoofdingredient !== f.hoofd) return false;
    if (f.kookwijze.size) {
      const ms = m.kookwijze || [];
      if (![...f.kookwijze].every(k => ms.includes(k))) return false;
    }
    if (f.dieet.size) {
      const ms = m.dieet || [];
      if (![...f.dieet].every(k => ms.includes(k))) return false;
    }
    if (f.maxTijd) {
      const bucket = PICKER_KOOKTIJD.find(b => b[0] === f.maxTijd);
      if (bucket && !bucket[2](m.bereidingstijd)) return false;
    }
    if (f.favoriet && !m.favoriet) return false;
    return true;
  });
}

function view() {
  if (!ui.open) return null;
  const slotInfo = SLOT_BY_ID[ui.slot];
  const term = ui.search.trim().toLowerCase();
  // v2.26: filter op gekozen type-bucket (default = bucket van de geopende slot, omzetbaar).
  const bucketTypes = ui.typeBucket ? typesForBucket(ui.typeBucket) : null;
  const slotMatched = bucketTypes ? ui.meals.filter(m => bucketTypes.includes(m.type)) : ui.meals;
  const byTerm = term
    ? slotMatched.filter(m => m.name.toLowerCase().includes(term))
    : slotMatched;
  const filtered = applyExtraFilters(byTerm);
  const nActive = activeFilterCount();
  const isEdit = ui.mode === 'edit';
  const headerLead = ui.mode === 'pick' ? 'Kies bestaande maaltijd of maak een nieuwe.'
                  : isEdit               ? `Bewerk "${ui.editing?.name ?? '...'}"`
                  : 'Nieuwe maaltijd toevoegen.';

  return html`
    <div class="mp-backdrop" @click=${close}>
      <div class="mp-modal" @click=${(e) => e.stopPropagation()}>
        <header class="mp-head">
          <div class="mp-title">
            <span class="mp-icon">${SlotIcon({ slot: ui.slot, size: 22 })}</span>
            <div>
              <h3 class="display">${slotInfo?.label ?? 'Maaltijd'}</h3>
              <p class="lead">${headerLead}</p>
            </div>
          </div>
          <button class="btn ghost small" @click=${close}>sluit</button>
        </header>

        ${ui.mode === 'pick' ? html`
          <input
            type="search"
            placeholder="Zoek op naam…"
            .value=${ui.search}
            @input=${(e) => { ui.search = e.target.value; rerender(); }}
            autofocus
          />

          <div class="mp-types" role="group" aria-label="Type maaltijd">
            ${TYPE_BUCKETS.map(([id, label]) => html`
              <button type="button" class="mp-type ${ui.typeBucket === id ? 'is-on' : ''}"
                @click=${() => { ui.typeBucket = id; rerender(); }}>${label}</button>`)}
          </div>

          <div class="mp-filterbar">
            <button type="button" class="mp-filtertoggle ${nActive ? 'is-on' : ''}"
              @click=${() => { ui.filtersOpen = !ui.filtersOpen; rerender(); }}>
              <span>Filters${nActive ? html` <span class="mp-badge">${nActive}</span>` : ''}</span>
              <span class="mp-caret">${ui.filtersOpen ? '▴' : '▾'}</span>
            </button>
            ${nActive ? html`<button type="button" class="mp-clear" @click=${clearFilters}>wis</button>` : ''}
            <span class="mp-count">${filtered.length} resultaat${filtered.length === 1 ? '' : 'en'}</span>
          </div>

          ${ui.filtersOpen ? html`
            <div class="mp-filters">
              <div class="mp-frow">
                <label class="mp-fsel">
                  <span>Keuken</span>
                  <select .value=${ui.filters.cuisine}
                    @change=${(e) => { ui.filters.cuisine = e.target.value; rerender(); }}>
                    ${PICKER_CUISINES.map(c => html`<option value=${c} ?selected=${c === ui.filters.cuisine}>${c || 'alle'}</option>`)}
                  </select>
                </label>
                <label class="mp-fsel">
                  <span>Hoofdingrediënt</span>
                  <select .value=${ui.filters.hoofd}
                    @change=${(e) => { ui.filters.hoofd = e.target.value; rerender(); }}>
                    ${PICKER_HOOFD.map(h => html`<option value=${h} ?selected=${h === ui.filters.hoofd}>${h || 'alle'}</option>`)}
                  </select>
                </label>
                <label class="mp-fsel">
                  <span>Max kooktijd</span>
                  <select .value=${ui.filters.maxTijd}
                    @change=${(e) => { ui.filters.maxTijd = e.target.value; rerender(); }}>
                    ${PICKER_KOOKTIJD.map(b => html`<option value=${b[0]} ?selected=${b[0] === ui.filters.maxTijd}>${b[1]}</option>`)}
                  </select>
                </label>
              </div>
              <div class="mp-fgroup">
                <span class="mp-flabel">Dieet</span>
                <div class="mp-chips">
                  ${PICKER_DIEET.map(d => html`
                    <button type="button" class="mp-chip ${ui.filters.dieet.has(d) ? 'is-on' : ''}"
                      @click=${() => toggleFilterSet('dieet', d)}>${d}</button>`)}
                </div>
              </div>
              <div class="mp-fgroup">
                <span class="mp-flabel">Kookwijze</span>
                <div class="mp-chips">
                  ${PICKER_KOOKWIJZE.map(k => html`
                    <button type="button" class="mp-chip ${ui.filters.kookwijze.has(k) ? 'is-on' : ''}"
                      @click=${() => toggleFilterSet('kookwijze', k)}>${k}</button>`)}
                </div>
              </div>
              <label class="mp-fav inline">
                <input type="checkbox" ?checked=${ui.filters.favoriet}
                  @change=${(e) => { ui.filters.favoriet = e.target.checked; rerender(); }} />
                Alleen favorieten
              </label>
            </div>
          ` : ''}

          <ul class="mp-list">
            ${filtered.length === 0 ? html`
              <li class="empty">Geen maaltijden gevonden${term ? ` voor "${term}"` : ''}${nActive ? ' met deze filters' : ''}.</li>
            ` : filtered.map(m => html`
              <li>
                <button class="mp-meal" @click=${() => pick(m)}>
                  <span class="name">${m.name}</span>
                  <span class="meta">
                    ${m.kcal ? html`<span class="mono">${m.kcal} kcal</span>` : ''}
                    ${(m.suitable_for || []).map(s => html`<span class="chip ${s === 'peter' ? 'berry' : s === 'miranda' ? 'plum' : 'leaf'}">${s}</span>`)}
                  </span>
                </button>
              </li>
            `)}
          </ul>
          <button class="btn" @click=${() => { ui.mode = 'create'; ui.recipeEdit = true; rerender(); }}>+ nieuwe maaltijd</button>
        ` : html`
          <form @submit=${saveDraft}>
            ${isEdit ? html`
              <div class="mp-planrow">
                <button type="button" class="btn mp-planbtn"
                  @click=${() => ui.editing && openMealScheduler({ meal: ui.editing })}>📅 Inplannen in een week</button>
              </div>
            ` : ''}
            <label>
              Naam
              <input
                required
                .value=${ui.draft.name}
                @input=${(e) => { ui.draft.name = e.target.value; }}
              />
            </label>

            <!-- v2.28: ingrediënten + bereidingswijze als twee kolommen — het belangrijkst tijdens koken -->
            <div class="mp-cook">
              <fieldset class="ing">
                <legend>Ingrediënten <span class="hint">(naam verplicht, rest optioneel)</span></legend>
                <div class="ing-rows">
                  ${ui.draft.ingredients.map((ing, i) => html`
                    <div class="ing-row">
                      <input
                        class="ing-name"
                        placeholder="ingrediënt"
                        .value=${ing.name}
                        @input=${(e) => { ing.name = e.target.value; }}
                      />
                      <input
                        class="ing-qty"
                        type="number" min="0" step="0.1"
                        placeholder="hvh"
                        .value=${ing.qty}
                        @input=${(e) => { ing.qty = e.target.value; }}
                      />
                      <select class="ing-unit" .value=${ing.unit} @change=${(e) => { ing.unit = e.target.value; }}>
                        ${UNITS.map(u => html`<option value=${u.id} ?selected=${u.id === ing.unit}>${u.label}</option>`)}
                      </select>
                      <button type="button" class="ing-x" title="verwijder" @click=${() => removeIngredientRow(i)}>×</button>
                    </div>
                  `)}
                </div>
                <button type="button" class="btn ghost small" @click=${addIngredientRow}>+ rij</button>
              </fieldset>
              <div class="mp-recipe">
                <div class="mp-recipe-head">
                  <span>Bereidingswijze <span class="hint">(elke stap op een nieuwe regel)</span></span>
                  ${ui.recipeEdit
                    ? html`<button type="button" class="mp-recipe-toggle" @click=${() => { ui.recipeEdit = false; rerender(); }}>als lijst</button>`
                    : html`<button type="button" class="mp-recipe-toggle" @click=${() => { ui.recipeEdit = true; rerender(); }}>bewerken</button>`}
                </div>
                ${ui.recipeEdit
                  ? html`<textarea class="recipe-area"
                      placeholder="1. Verhit de olie in een pan...&#10;2. Voeg de kip toe en bak 5 min..."
                      .value=${ui.draft.recipe}
                      ${ref((el) => el && requestAnimationFrame(() => autoGrow(el)))}
                      @input=${(e) => { ui.draft.recipe = e.target.value; autoGrow(e.target); }}></textarea>`
                  : (() => {
                      const steps = parseSteps(ui.draft.recipe);
                      return steps.length
                        ? html`<ol class="mp-steps">${steps.map((s, i) => html`<li><span class="mp-stepn">${i + 1}.</span><span>${s}</span></li>`)}</ol>`
                        : html`<button type="button" class="mp-steps-empty" @click=${() => { ui.recipeEdit = true; rerender(); }}>+ bereidingswijze toevoegen</button>`;
                    })()}
              </div>
            </div>

            <div class="row">
              <label>
                Type
                <select .value=${ui.draft.type} @change=${(e) => { ui.draft.type = e.target.value; }}>
                  ${SLOTS.map(s => html`<option value=${s.id} ?selected=${s.id === ui.draft.type}>${s.label} (${s.id})</option>`)}
                </select>
              </label>
              <label>
                Kooktijd (min)
                <input
                  type="number" min="0" step="5"
                  .value=${ui.draft.bereidingstijd}
                  @input=${(e) => { ui.draft.bereidingstijd = e.target.value; }}
                />
              </label>
            </div>
            <div class="row">
              <label>
                Keuken
                <select .value=${ui.draft.cuisine} @change=${(e) => { ui.draft.cuisine = e.target.value; }}>
                  ${PICKER_CUISINES.map(c => html`<option value=${c} ?selected=${c === ui.draft.cuisine}>${c || '— geen —'}</option>`)}
                </select>
              </label>
              <label>
                Hoofdingrediënt
                <select .value=${ui.draft.hoofdingredient} @change=${(e) => { ui.draft.hoofdingredient = e.target.value; }}>
                  ${PICKER_HOOFD.map(h => html`<option value=${h} ?selected=${h === ui.draft.hoofdingredient}>${h || '— geen —'}</option>`)}
                </select>
              </label>
            </div>
            <div class="row">
              <label>
                Kcal
                <input
                  type="number" min="0" step="10"
                  .value=${ui.draft.kcal}
                  @input=${(e) => { ui.draft.kcal = e.target.value; }}
                />
              </label>
              <span></span>
            </div>
            <fieldset>
              <legend>Kookwijze</legend>
              ${PICKER_KOOKWIJZE.map(k => html`
                <label class="inline">
                  <input type="checkbox" ?checked=${ui.draft.kookwijze.includes(k)}
                    @change=${(e) => {
                      const set = new Set(ui.draft.kookwijze);
                      if (e.target.checked) set.add(k); else set.delete(k);
                      ui.draft.kookwijze = Array.from(set);
                    }} /> ${k}
                </label>
              `)}
            </fieldset>
            <fieldset>
              <legend>Dieet</legend>
              ${PICKER_DIEET.map(d => html`
                <label class="inline">
                  <input type="checkbox" ?checked=${ui.draft.dieet.includes(d)}
                    @change=${(e) => {
                      const set = new Set(ui.draft.dieet);
                      if (e.target.checked) set.add(d); else set.delete(d);
                      ui.draft.dieet = Array.from(set);
                    }} /> ${d}
                </label>
              `)}
            </fieldset>
            <label>
              Korte beschrijving
              <input type="text" placeholder="bv. snel pasta-recept met tomaat en basilicum"
                .value=${ui.draft.description}
                @input=${(e) => { ui.draft.description = e.target.value; }} />
            </label>

            <!-- v2.28: bron- en foto-URL onderaan, minst belangrijk tijdens koken -->
            <label>
              Bron-URL <span class="hint">(optioneel)</span>
              <input type="url" placeholder="https://miljuschka.nl/..."
                .value=${ui.draft.source_url}
                @input=${(e) => { ui.draft.source_url = e.target.value; }} />
            </label>
            <label>
              Foto-URL <span class="hint">(plak hier een afbeelding-URL voor in de bibliotheek)</span>
              <input type="url" placeholder="https://static.ah.nl/static/recepten/..."
                .value=${ui.draft.image_url}
                @input=${(e) => { ui.draft.image_url = e.target.value; }} />
              ${ui.draft.image_url ? html`
                <img src=${ui.draft.image_url} alt="preview"
                  style="max-height:120px; margin-top:8px; border-radius:8px; object-fit:cover;"
                  referrerpolicy="no-referrer"
                  @error=${(e) => { e.target.style.display = 'none'; }} />
              ` : ''}
            </label>
            ${ui.error ? html`<div class="err">${ui.error}</div>` : null}
            <div class="row right">
              ${isEdit ? html`
                <button type="button" class="btn ghost danger" @click=${softDeleteCurrent}>verwijder</button>
                <span style="flex:1"></span>
                <button type="button" class="btn ghost" @click=${close}>annuleer</button>
                <button class="btn" type="submit" ?disabled=${ui.busy}>${ui.busy ? 'Opslaan…' : 'Opslaan'}</button>
              ` : html`
                <button type="button" class="btn ghost" @click=${() => { ui.mode = 'pick'; rerender(); }}>annuleer</button>
                <button class="btn" type="submit" ?disabled=${ui.busy}>${ui.busy ? 'Opslaan…' : 'Opslaan + kiezen'}</button>
              `}
            </div>
          </form>
        `}
      </div>
    </div>

    <style>
      .mp-backdrop {
        position: fixed; inset: 0;
        background: oklch(18% 0.02 60 / 0.55);
        z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
      }
      .mp-modal {
        background: var(--bg);
        border-radius: var(--r-lg);
        padding: 22px;
        width: 100%; max-width: 1040px;
        max-height: 90vh; overflow-y: auto;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3);
      }
      .mp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .mp-head h3 { font-size: 22px; }
      .mp-title { display: flex; gap: 12px; align-items: flex-start; }
      .mp-icon { color: var(--ink); margin-top: 4px; }
      .lead { color: var(--ink-2); margin: 4px 0 0; font-size: 13px; }
      .btn.small { height: 28px; padding: 0 10px; font-size: 12px; }

      input[type="search"], input[type="text"], input[type="number"], input[type="url"], input:not([type]), select, textarea {
        font: inherit;
        padding: 10px 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--line-2);
        background: var(--bg);
        color: var(--ink);
        width: 100%;
        box-sizing: border-box;
      }
      textarea.recipe-area {
        font-family: inherit;
        line-height: 1.5;
        resize: none;
        overflow: hidden;          /* geen scrollbalk; height groeit met content */
        min-height: 80px;
        field-sizing: content;     /* moderne browsers: passen vanzelf bij content */
      }
      input:focus, select:focus, textarea:focus { outline: 2px solid var(--ink); outline-offset: 1px; }

      .mp-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
      .empty { color: var(--ink-3); font-size: 14px; padding: 14px; text-align: center; }
      .mp-meal {
        width: 100%;
        text-align: left;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: 10px 12px;
        display: flex; flex-direction: column; gap: 4px;
        cursor: pointer;
      }
      .mp-meal:hover { background: var(--bg-3); }
      .name { font-weight: 600; }
      .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }

      /* v2.26: type-keuzeknoppen in kies-modus */
      .mp-types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
      .mp-type {
        font: inherit; font-size: 13px; cursor: pointer;
        background: var(--bg-2); border: 1px solid var(--line);
        border-radius: var(--r-md); padding: 9px 6px; color: var(--ink-2);
        text-align: center;
      }
      .mp-type:hover { background: var(--bg-3); }
      .mp-type.is-on { background: var(--ink); border-color: var(--ink); color: var(--bg); font-weight: 600; }

      /* v2.25: filterbalk in kies-modus */
      .mp-filterbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .mp-filtertoggle {
        font: inherit; font-size: 13px; cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        background: var(--bg-2); border: 1px solid var(--line);
        border-radius: var(--r-md); padding: 7px 12px; color: var(--ink-2);
      }
      .mp-filtertoggle.is-on { border-color: var(--ink); color: var(--ink); }
      .mp-filtertoggle:hover { background: var(--bg-3); }
      .mp-caret { color: var(--ink-3); font-size: 11px; }
      .mp-badge {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
        background: var(--ink); color: var(--bg); font-size: 11px; font-weight: 600;
      }
      .mp-clear {
        font: inherit; font-size: 12px; cursor: pointer; color: var(--ink-3);
        background: none; border: none; text-decoration: underline; padding: 4px 2px;
      }
      .mp-clear:hover { color: var(--ink); }
      .mp-count { margin-left: auto; font-size: 12px; color: var(--ink-3); }
      .mp-filters {
        display: flex; flex-direction: column; gap: 12px;
        background: var(--bg-2); border: 1px solid var(--line);
        border-radius: var(--r-md); padding: 12px;
      }
      .mp-frow { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .mp-fsel { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-3); }
      .mp-fsel select { padding: 7px 8px; font-size: 13px; }
      .mp-fgroup { display: flex; flex-direction: column; gap: 6px; }
      .mp-flabel { font-size: 12px; color: var(--ink-3); }
      .mp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .mp-chip {
        font: inherit; font-size: 12px; cursor: pointer;
        background: var(--bg); border: 1px solid var(--line-2);
        border-radius: 999px; padding: 5px 11px; color: var(--ink-2);
      }
      .mp-chip:hover { background: var(--bg-3); }
      .mp-chip.is-on { background: var(--ink); border-color: var(--ink); color: var(--bg); }
      .mp-fav { font-size: 13px; color: var(--ink-2); }
      @media (max-width: 480px) {
        .mp-frow { grid-template-columns: 1fr; }
        .mp-count { margin-left: 0; width: 100%; }
      }

      form { display: flex; flex-direction: column; gap: 12px; }
      form label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ink-2); }
      form .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      form .row.right { display: flex; justify-content: flex-end; gap: 8px; }
      .hint { color: var(--ink-3); font-weight: 400; }
      fieldset { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; display: flex; gap: 14px; flex-wrap: wrap; }
      legend { padding: 0 6px; color: var(--ink-3); font-size: 12px; }
      .inline { flex-direction: row !important; align-items: center; gap: 6px !important; }
      .err {
        background: var(--tomato-tint);
        color: oklch(40% 0.14 28);
        border: 1px solid oklch(85% 0.08 28);
        padding: 10px 14px;
        border-radius: var(--r-md);
        font-size: 14px;
      }
      /* v2.28: plan-knop boven + twee-koloms kook-layout */
      .mp-planrow { display: flex; justify-content: flex-end; }
      .mp-planbtn { display: inline-flex; align-items: center; gap: 6px; }
      .mp-cook { display: grid; grid-template-columns: 0.85fr 1.4fr; gap: 20px; align-items: start; }
      .mp-cook .mp-recipe { display: flex; flex-direction: column; gap: 6px; }
      .mp-cook .recipe-area { min-height: 200px; }
      .mp-cook .ing-rows { max-height: none; }
      .mp-recipe-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; color: var(--ink-2); }
      .mp-recipe-toggle { font: inherit; font-size: 12px; background: none; border: none; color: var(--ink-3); cursor: pointer; text-decoration: underline; padding: 0; }
      .mp-recipe-toggle:hover { color: var(--ink); }
      .mp-steps { list-style: none; margin: 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg); display: flex; flex-direction: column; gap: 9px; }
      .mp-steps li { display: flex; gap: 10px; font-size: 14px; line-height: 1.55; }
      .mp-stepn { flex: 0 0 20px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
      .mp-steps-empty { font: inherit; font-size: 13px; text-align: left; color: var(--ink-3); background: var(--bg); border: 1px dashed var(--line-2); border-radius: var(--r-md); padding: 12px 14px; cursor: pointer; }
      .mp-steps-empty:hover { border-color: var(--ink-2); color: var(--ink-2); }
      @media (max-width: 560px) {
        .mp-cook { grid-template-columns: 1fr; }
      }
      fieldset.ing { display: flex; flex-direction: column; gap: 8px; }
      .ing-rows { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; padding-right: 4px; }
      .ing-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 56px 100px 30px;
        gap: 6px;
        align-items: center;
      }
      .ing-row input, .ing-row select { padding: 6px 8px; font-size: 12px; min-width: 0; }
      .ing-x {
        font: inherit; background: var(--bg-2); border: 1px solid var(--line);
        border-radius: var(--r-sm); cursor: pointer; padding: 4px 6px; color: var(--ink-3);
      }
      .ing-x:hover { background: var(--tomato-tint); color: oklch(40% 0.14 28); }
      .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
      .btn.ghost.danger:hover { background: var(--tomato-tint); }
      @media (max-width: 480px) {
        .ing-row { grid-template-columns: minmax(0, 1fr) 48px 84px 26px; gap: 4px; }
      }
    </style>
  `;
}
