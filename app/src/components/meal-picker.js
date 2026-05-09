// Meal-picker modal: zoek bestaande maaltijd of maak inline een nieuwe aan.
// Module-state. Mount via openMealPicker({ slot, onPick }).

import { html, render } from 'lit-html';
import { listMeals, addMeal, updateMeal, softDeleteMeal } from '../lib/data.js';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { UNITS } from '../lib/units.js';
import { SlotIcon } from './slot-icon.js';

function emptyIngredient() {
  return { name: '', qty: '', unit: '' };
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
const PICKER_DIEET    = ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij', 'koolhydraatarm'];

const HOST_ID = '__meal_picker_host';

const ui = {
  open: false,
  mode: 'pick',     // 'pick' | 'create' | 'edit'
  slot: null,       // 'ontbijt' | etc.
  editing: null,    // meal-row in edit-modus
  search: '',
  meals: [],
  onPick: null,
  onSaved: null,    // edit-callback
  busy: false,
  error: null,
  // draft-data voor 'create' en 'edit'
  draft: { name: '', kcal: '', type: '', bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], suitable_for: ['beiden'], ingredients: [emptyIngredient()] },
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
  ui.error = null;
  ui.onPick = onPick;
  ui.onSaved = null;
  ui.draft = { name: '', kcal: '', type: slot, bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], suitable_for: [suggestedSuitableFor], ingredients: [emptyIngredient()] };
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
  ui.draft = { name: '', kcal: '', type: defaultType, bereidingstijd: '', cuisine: '', hoofdingredient: '', kookwijze: [], dieet: [], suitable_for: ['beiden'], ingredients: [emptyIngredient()] };
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

function view() {
  if (!ui.open) return null;
  const slotInfo = SLOT_BY_ID[ui.slot];
  const term = ui.search.trim().toLowerCase();
  // Filter eerst op slot-type: bij ontbijt-cell alleen ontbijt-meals.
  const slotMatched = ui.slot ? ui.meals.filter(m => m.type === ui.slot) : ui.meals;
  const filtered = term
    ? slotMatched.filter(m => m.name.toLowerCase().includes(term))
    : slotMatched;
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
          <ul class="mp-list">
            ${filtered.length === 0 ? html`
              <li class="empty">Geen maaltijden gevonden${term ? ` voor "${term}"` : ''}.</li>
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
          <button class="btn" @click=${() => { ui.mode = 'create'; rerender(); }}>+ nieuwe maaltijd</button>
        ` : html`
          <form @submit=${saveDraft}>
            <label>
              Naam
              <input
                required
                .value=${ui.draft.name}
                @input=${(e) => { ui.draft.name = e.target.value; }}
              />
            </label>
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
        width: 100%; max-width: 520px;
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

      input[type="search"], input[type="text"], input[type="number"], input:not([type]), select {
        font: inherit;
        padding: 10px 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--line-2);
        background: var(--bg);
        color: var(--ink);
        width: 100%;
      }
      input:focus, select:focus { outline: 2px solid var(--ink); outline-offset: 1px; }

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
      fieldset.ing { display: flex; flex-direction: column; gap: 8px; }
      .ing-rows { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; padding-right: 4px; }
      .ing-row {
        display: grid;
        grid-template-columns: minmax(0, 2.2fr) 60px 90px 28px;
        gap: 4px;
        align-items: center;
      }
      .ing-row input, .ing-row select { padding: 6px 8px; font-size: 12px; }
      .ing-x {
        font: inherit; background: var(--bg-2); border: 1px solid var(--line);
        border-radius: var(--r-sm); cursor: pointer; padding: 4px 6px; color: var(--ink-3);
      }
      .ing-x:hover { background: var(--tomato-tint); color: oklch(40% 0.14 28); }
      .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
      .btn.ghost.danger:hover { background: var(--tomato-tint); }
      @media (max-width: 480px) {
        .ing-row { grid-template-columns: 1fr 50px 70px 28px; }
      }
    </style>
  `;
}
