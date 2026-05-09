// Bibliotheek (v2.4): database-view over de hele meal-pool.
// Filters: zoek, slot, keuken, kookwijze, hoofdingrediënt, dieet, bron, kooktijd, kcal-max, seizoen, tag.
// Sorteer: alfabet / kooktijd / kcal / aantal ingrediënten / nieuwste / beoordeling.
// Route blijft 'maker' (deeplinks/shopping.js verwijzen ernaar). Nav-label = 'Bibliotheek'.

import { html, nothing } from 'lit-html';
import { listMeals, listMealRatings, setMealFavoriet, onDataChange } from '../lib/data.js';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { openMealEditor, openMealCreator } from '../components/meal-picker.js';
import { MealCard } from '../components/meal-card.js';
import { SlotIcon } from '../components/slot-icon.js';
import { rerender } from '../main.js';

const SEIZOENEN = [
  { id: 'lente',  label: 'Lente',  hue: 145 },
  { id: 'zomer',  label: 'Zomer',  hue: 85 },
  { id: 'herfst', label: 'Herfst', hue: 28 },
  { id: 'winter', label: 'Winter', hue: 260 },
];

// Vaste lijsten voor filter-chips. Volgorde = displayvolgorde.
const CUISINES = [
  ['italiaans', 'Italiaans'], ['mexicaans', 'Mexicaans'], ['aziatisch', 'Aziatisch'],
  ['indiaas', 'Indiaas'], ['frans', 'Frans'], ['hollands', 'Hollands'],
  ['mediterraan', 'Mediterraan'], ['amerikaans', 'Amerikaans'], ['bbq', 'BBQ'],
];
const KOOKWIJZES = [
  ['oven', 'Oven'], ['airfryer', 'Airfryer'], ['eenpans', 'Eenpans'],
  ['traybake', 'Traybake'], ['wok', 'Wok'], ['soep', 'Soep'],
  ['salade', 'Salade'], ['grill', 'Grill'], ['pasta', 'Pasta'],
  ['stamppot', 'Stamppot'], ['slowcooker', 'Slowcooker'], ['smoothie', 'Smoothie'],
];
const HOOFD_ING = [
  ['kip', 'Kip'], ['rund', 'Rund'], ['varken', 'Varken'], ['lam', 'Lam'],
  ['vis', 'Vis'], ['vegetarisch', 'Vega'], ['pasta', 'Pasta'], ['rijst', 'Rijst'],
  ['aardappel', 'Aardappel'], ['brood', 'Brood'], ['ei', 'Ei'], ['zuivel', 'Zuivel'],
];
const DIETEN = [
  ['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan'],
  ['glutenvrij', 'Glutenvrij'], ['lactosevrij', 'Lactosevrij'],
  ['koolhydraatarm', 'Koolhydraatarm'],
];
const BRONNEN = [
  ['dietist', 'Diëtist'],
  ['miljuschka.nl', 'Miljuschka'],
  ['ah.nl', 'AH'],
  ['24kitchen.nl', '24kitchen'],
  ['eigen', 'Eigen'],
];
const KOOKTIJD_BUCKETS = [
  ['t15', '≤15 min', (b) => b != null && b <= 15],
  ['t30', '≤30 min', (b) => b != null && b <= 30],
  ['t45', '≤45 min', (b) => b != null && b <= 45],
  ['t60', '≤60 min', (b) => b != null && b <= 60],
  ['t60p', '60+ min', (b) => b != null && b > 60],
];
const SORTEERS = [
  ['name', 'Naam (A-Z)'],
  ['time', 'Kooktijd (kort eerst)'],
  ['kcal', 'Calorieën (laag eerst)'],
  ['ingr', 'Ingrediënten (weinig eerst)'],
  ['new', 'Nieuwste eerst'],
  ['rating', 'Beoordeling (best eerst)'],
];

const vs = {
  loading: false,
  error: null,
  meals: [],
  ratings: {},              // { meal_id: { count, avg } }
  // Filters
  q: '',
  type: '',                 // slot
  cuisine: '',              // single
  kookwijze: new Set(),     // multi
  hoofd: '',                // single
  dieet: new Set(),         // multi
  bron: '',                 // single
  kooktijdBucket: '',       // single bucket-id
  kcalMax: 900,
  kcalMaxOn: false,
  seizoen: '',
  tag: '',
  favorietOnly: false,      // v2.6: alleen favorieten
  // Sortering + view-mode
  sortBy: 'name',
  viewMode: 'grid',         // 'grid' | 'lijst'
  initialized: false,
};

function ensureInit() {
  if (vs.initialized) return;
  vs.initialized = true;
  onDataChange((scope) => { if (scope === 'meals') loadAll(); });
  queueMicrotask(loadAll);
}

async function loadAll() {
  vs.loading = true; vs.error = null; rerender();
  try {
    const [meals, ratings] = await Promise.all([listMeals(), listMealRatings()]);
    vs.meals = meals;
    vs.ratings = {};
    for (const r of ratings) vs.ratings[r.meal_id] = { count: r.rating_count, avg: r.rating_avg };
  } catch (err) { vs.error = err.message; }
  finally { vs.loading = false; rerender(); }
}

async function toggleFavoriet(meal) {
  try {
    await setMealFavoriet(meal.id, !meal.favoriet);
    // Optimistic UI: lokaal toggelen zodat re-render meteen klopt
    meal.favoriet = !meal.favoriet;
    rerender();
  } catch (err) {
    alert('Favoriet opslaan mislukt: ' + err.message);
  }
}

// Helper: 'bron' van een meal afleiden.
function bronOf(m) {
  if (m.source_site) return m.source_site;
  // Geen source_site = handmatig aangemaakt of via dietist-PDF-import. Heuristiek:
  // als source_url null en created_by gezet → eigen of dietist. Voor nu: 'eigen' als fallback,
  // 'dietist' als de meal in een week zit met source='dietist' (te kostbaar in deze view).
  return 'eigen';
}

function ratingOf(m) {
  const r = vs.ratings[m.id];
  return r?.avg ?? 0;
}

function bucketMatches(bucketId, b) {
  const found = KOOKTIJD_BUCKETS.find(x => x[0] === bucketId);
  return found ? found[2](b) : true;
}

// Pas alle filters EXCLUSIEF één dimensie toe — gebruikt voor count-per-chip
// (zodat counts op een chip niet 0 zijn als die chip nog niet is aangevinkt).
function applyFiltersExcept(except) {
  return vs.meals.filter(m => {
    if (except !== 'q' && vs.q) {
      const q = vs.q.trim().toLowerCase();
      const inName = m.name?.toLowerCase().includes(q);
      const inIng = (m.ingredients || []).some(i => (i.name || '').toLowerCase().includes(q));
      if (!inName && !inIng) return false;
    }
    if (except !== 'type' && vs.type && m.type !== vs.type) return false;
    if (except !== 'cuisine' && vs.cuisine && m.cuisine !== vs.cuisine) return false;
    if (except !== 'kookwijze' && vs.kookwijze.size) {
      const ms = m.kookwijze || [];
      if (![...vs.kookwijze].every(k => ms.includes(k))) return false;
    }
    if (except !== 'hoofd' && vs.hoofd && m.hoofdingredient !== vs.hoofd) return false;
    if (except !== 'dieet' && vs.dieet.size) {
      const ms = m.dieet || [];
      if (![...vs.dieet].every(k => ms.includes(k))) return false;
    }
    if (except !== 'bron' && vs.bron && bronOf(m) !== vs.bron) return false;
    if (except !== 'kooktijdBucket' && vs.kooktijdBucket && !bucketMatches(vs.kooktijdBucket, m.bereidingstijd)) return false;
    if (except !== 'kcal' && vs.kcalMaxOn && (m.kcal == null || m.kcal > vs.kcalMax)) return false;
    if (except !== 'seizoen' && vs.seizoen && !(m.seizoen || []).includes(vs.seizoen)) return false;
    if (except !== 'tag' && vs.tag && !(m.tags || []).includes(vs.tag)) return false;
    if (except !== 'favoriet' && vs.favorietOnly && !m.favoriet) return false;
    return true;
  });
}

function filtered() {
  const list = applyFiltersExcept(null);
  return sorted(list);
}

function sorted(list) {
  const cmp = {
    name: (a, b) => (a.name || '').localeCompare(b.name || '', 'nl'),
    time: (a, b) => (a.bereidingstijd ?? 999) - (b.bereidingstijd ?? 999),
    kcal: (a, b) => (a.kcal ?? 999999) - (b.kcal ?? 999999),
    ingr: (a, b) => (a.ingredients?.length ?? 0) - (b.ingredients?.length ?? 0),
    new:  (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
    rating: (a, b) => ratingOf(b) - ratingOf(a),
  }[vs.sortBy] || ((a, b) => 0);
  return [...list].sort(cmp);
}

function countFor(dimension, value) {
  // Aantal meals dat past in alle ANDERE filters EN dimension=value.
  const pool = applyFiltersExcept(dimension);
  if (dimension === 'cuisine') return pool.filter(m => m.cuisine === value).length;
  if (dimension === 'kookwijze') return pool.filter(m => (m.kookwijze || []).includes(value)).length;
  if (dimension === 'hoofd') return pool.filter(m => m.hoofdingredient === value).length;
  if (dimension === 'dieet') return pool.filter(m => (m.dieet || []).includes(value)).length;
  if (dimension === 'bron') return pool.filter(m => bronOf(m) === value).length;
  if (dimension === 'kooktijdBucket') {
    const found = KOOKTIJD_BUCKETS.find(x => x[0] === value);
    return found ? pool.filter(m => found[2](m.bereidingstijd)).length : 0;
  }
  if (dimension === 'type') return pool.filter(m => m.type === value).length;
  if (dimension === 'seizoen') return pool.filter(m => (m.seizoen || []).includes(value)).length;
  if (dimension === 'tag') return pool.filter(m => (m.tags || []).includes(value)).length;
  return 0;
}

function allTags() {
  const set = new Set();
  for (const m of vs.meals) for (const t of (m.tags || [])) set.add(t);
  return Array.from(set).sort();
}

function clearFilters() {
  vs.q = ''; vs.type = ''; vs.cuisine = ''; vs.kookwijze = new Set();
  vs.hoofd = ''; vs.dieet = new Set(); vs.bron = ''; vs.kooktijdBucket = '';
  vs.kcalMax = 900; vs.kcalMaxOn = false; vs.seizoen = ''; vs.tag = '';
  vs.favorietOnly = false;
  rerender();
}

function hasFilters() {
  return vs.q || vs.type || vs.cuisine || vs.kookwijze.size || vs.hoofd ||
         vs.dieet.size || vs.bron || vs.kooktijdBucket || vs.kcalMaxOn ||
         vs.seizoen || vs.tag || vs.favorietOnly;
}

function toggleSet(set, val) {
  if (set.has(val)) set.delete(val); else set.add(val);
  rerender();
}

// Slot-list incl. tussendoortjes. SLOTS uit lib/slots.js. Hier groeperen we de drie snacks.
const SLOT_FILTER = [
  { id: 'ontbijt', label: 'Ontbijt', match: (t) => t === 'ontbijt' },
  { id: 'lunch', label: 'Lunch', match: (t) => t === 'lunch' },
  { id: 'diner', label: 'Diner', match: (t) => t === 'diner' },
  { id: 'snack', label: 'Tussendoor', match: (t) => t?.startsWith('snack_') },
];

function slotMatches(filterId, mealType) {
  const f = SLOT_FILTER.find(s => s.id === filterId);
  return f ? f.match(mealType) : true;
}

// Override: filter via slot-grouping ipv strikt op meal.type
function applyType(list) {
  if (!vs.type) return list;
  return list.filter(m => slotMatches(vs.type, m.type));
}

export function BuildView(state) {
  ensureInit();
  // Filter + sort. Slot-filter doet aparte grouping voor tussendoortjes.
  let list = applyFiltersExcept(null);
  list = applyType(list);
  list = sorted(list);
  const tags = allTags();

  return html`
    <section class="view-wrap libview">
      <div class="lv-head">
        <div>
          <div class="cmt">// alle gerechten in één database</div>
          <h1 class="display">Bibliotheek.</h1>
        </div>
        <div class="head-actions">
          <div class="view-toggle">
            <button class="vt ${vs.viewMode === 'grid' ? 'is-on' : ''}" @click=${() => { vs.viewMode = 'grid'; rerender(); }} title="Grid-weergave">⊞</button>
            <button class="vt ${vs.viewMode === 'lijst' ? 'is-on' : ''}" @click=${() => { vs.viewMode = 'lijst'; rerender(); }} title="Lijst-weergave">≡</button>
          </div>
          <select class="sort-select" .value=${vs.sortBy} @change=${(e) => { vs.sortBy = e.target.value; rerender(); }}>
            ${SORTEERS.map(([id, label]) => html`<option value=${id} ?selected=${vs.sortBy === id}>${label}</option>`)}
          </select>
          <button class="btn" @click=${() => openMealCreator({ defaultType: 'diner', onSaved: () => loadAll() })}>+ recept</button>
        </div>
      </div>

      <div class="lv-grid">
        <aside class="filter-rail">
          <div class="rail-section">
            <div class="cmt">// zoek</div>
            <input type="search" class="search" placeholder="naam of ingrediënt…"
              .value=${vs.q} @input=${(e) => { vs.q = e.target.value; rerender(); }} />
          </div>

          <div class="rail-section">
            <button class="chip ${vs.favorietOnly ? 'is-on' : ''}"
              @click=${() => { vs.favorietOnly = !vs.favorietOnly; rerender(); }}>
              ★ Alleen favorieten
              <span class="count">${vs.meals.filter(m => m.favoriet).length}</span>
            </button>
          </div>

          <div class="rail-section">
            <div class="cmt">// slot</div>
            <div class="chips">
              <button class="chip ${vs.type === '' ? 'is-on' : ''}" @click=${() => { vs.type = ''; rerender(); }}>alle</button>
              ${SLOT_FILTER.map(s => {
                const n = vs.meals.filter(m => s.match(m.type)).length;
                return html`<button class="chip ${vs.type === s.id ? 'is-on' : ''}" @click=${() => { vs.type = s.id; rerender(); }}>${s.label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// keuken</div>
            <div class="chips">
              <button class="chip ${vs.cuisine === '' ? 'is-on' : ''}" @click=${() => { vs.cuisine = ''; rerender(); }}>alle</button>
              ${CUISINES.map(([id, label]) => {
                const n = countFor('cuisine', id);
                return n === 0 ? '' : html`<button class="chip ${vs.cuisine === id ? 'is-on' : ''}" @click=${() => { vs.cuisine = id; rerender(); }}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// kooktijd</div>
            <div class="chips">
              <button class="chip ${vs.kooktijdBucket === '' ? 'is-on' : ''}" @click=${() => { vs.kooktijdBucket = ''; rerender(); }}>alle</button>
              ${KOOKTIJD_BUCKETS.map(([id, label]) => {
                const n = countFor('kooktijdBucket', id);
                return n === 0 ? '' : html`<button class="chip ${vs.kooktijdBucket === id ? 'is-on' : ''}" @click=${() => { vs.kooktijdBucket = id; rerender(); }}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// hoofdingrediënt</div>
            <div class="chips">
              <button class="chip ${vs.hoofd === '' ? 'is-on' : ''}" @click=${() => { vs.hoofd = ''; rerender(); }}>alle</button>
              ${HOOFD_ING.map(([id, label]) => {
                const n = countFor('hoofd', id);
                return n === 0 ? '' : html`<button class="chip ${vs.hoofd === id ? 'is-on' : ''}" @click=${() => { vs.hoofd = id; rerender(); }}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// kookwijze</div>
            <div class="chips">
              ${KOOKWIJZES.map(([id, label]) => {
                const n = countFor('kookwijze', id);
                return n === 0 ? '' : html`<button class="chip ${vs.kookwijze.has(id) ? 'is-on' : ''}" @click=${() => toggleSet(vs.kookwijze, id)}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// dieet</div>
            <div class="chips">
              ${DIETEN.map(([id, label]) => {
                const n = countFor('dieet', id);
                return n === 0 ? '' : html`<button class="chip ${vs.dieet.has(id) ? 'is-on' : ''}" @click=${() => toggleSet(vs.dieet, id)}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// bron</div>
            <div class="chips">
              <button class="chip ${vs.bron === '' ? 'is-on' : ''}" @click=${() => { vs.bron = ''; rerender(); }}>alle</button>
              ${BRONNEN.map(([id, label]) => {
                const n = countFor('bron', id);
                return n === 0 ? '' : html`<button class="chip ${vs.bron === id ? 'is-on' : ''}" @click=${() => { vs.bron = id; rerender(); }}>${label} <span class="count">${n}</span></button>`;
              })}
            </div>
          </div>

          <div class="rail-section">
            <div class="row-between">
              <div class="cmt">// max kcal</div>
              <label class="switch">
                <input type="checkbox" .checked=${vs.kcalMaxOn} @change=${(e) => { vs.kcalMaxOn = e.target.checked; rerender(); }} />
                <span>aan</span>
              </label>
            </div>
            <div class="row-between" style="margin-top: 4px;">
              <span class="display kcal-num">${vs.kcalMax}</span>
              <span class="cmt">kcal</span>
            </div>
            <input type="range" min="200" max="1200" step="20" .value=${vs.kcalMax}
              @input=${(e) => { vs.kcalMax = +e.target.value; vs.kcalMaxOn = true; rerender(); }} />
          </div>

          <div class="rail-section">
            <div class="cmt">// seizoen</div>
            <div class="season-grid">
              <button class="season ${vs.seizoen === '' ? 'is-on' : ''}" @click=${() => { vs.seizoen = ''; rerender(); }}>
                <span class="dot" style="background: var(--ink-3);"></span> jaarrond
              </button>
              ${SEIZOENEN.map(s => html`
                <button class="season ${vs.seizoen === s.id ? 'is-on' : ''}"
                  style="background: ${vs.seizoen === s.id ? `oklch(94% 0.04 ${s.hue})` : 'var(--bg)'};"
                  @click=${() => { vs.seizoen = s.id; rerender(); }}>
                  <span class="dot" style="background: oklch(70% 0.16 ${s.hue});"></span> ${s.label}
                </button>
              `)}
            </div>
          </div>

          ${tags.length ? html`
            <div class="rail-section">
              <div class="cmt">// tag</div>
              <div class="chips">
                <button class="chip ${vs.tag === '' ? 'is-on' : ''}" @click=${() => { vs.tag = ''; rerender(); }}>alle</button>
                ${tags.map(t => {
                  const n = countFor('tag', t);
                  return n === 0 ? '' : html`<button class="chip ${vs.tag === t ? 'is-on' : ''}" @click=${() => { vs.tag = t; rerender(); }}>${t} <span class="count">${n}</span></button>`;
                })}
              </div>
            </div>
          ` : ''}

          ${hasFilters() ? html`
            <button class="btn ghost wis-btn" @click=${clearFilters}>wis filters</button>
          ` : ''}
        </aside>

        <div class="results">
          <div class="results-head">
            <div class="cmt">${list.length} van ${vs.meals.length} maaltijden</div>
            ${vs.loading ? html`<div class="cmt">laden…</div>` : ''}
          </div>

          ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}

          ${list.length === 0 && !vs.loading ? html`
            <div class="empty">
              ${vs.meals.length === 0
                ? html`<p>Bibliotheek is leeg. Klik <strong>+ recept</strong> bovenin.</p>`
                : html`<p>Geen recepten voldoen aan de filters.</p>`}
            </div>
          ` : (vs.viewMode === 'lijst' ? html`
            <div class="meal-list">
              ${list.map(m => {
                const r = vs.ratings[m.id];
                return html`
                  <button class="ml-row" @click=${() => openMealEditor({ meal: m, onSaved: () => loadAll() })}>
                    <span class="ml-fav ${m.favoriet ? 'is-on' : ''}" @click=${(e) => { e.stopPropagation(); toggleFavoriet(m); }}>${m.favoriet ? '★' : '☆'}</span>
                    <span class="ml-name">${m.name}</span>
                    <span class="ml-meta">
                      ${m.cuisine ? html`<span class="cmt">${m.cuisine}</span>` : ''}
                      ${m.bereidingstijd ? html`<span class="cmt">${m.bereidingstijd}m</span>` : ''}
                      ${m.kcal ? html`<span class="cmt">${m.kcal}k</span>` : ''}
                      ${r?.count ? html`<span class="cmt">★${Number(r.avg).toFixed(1)}</span>` : ''}
                    </span>
                  </button>
                `;
              })}
            </div>
          ` : html`
            <div class="meal-grid">
              ${list.map(m => MealCard({
                meal: m,
                size: 'md',
                showMacros: true,
                onClick: () => openMealEditor({ meal: m, onSaved: () => loadAll() }),
                onToggleFavoriet: toggleFavoriet,
              }))}
            </div>
          `)}
        </div>
      </div>
    </section>

    <style>
      .libview { display: flex; flex-direction: column; gap: 24px; }

      .lv-head {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: 12px; flex-wrap: wrap;
      }
      .lv-head h1 { font-size: clamp(36px, 5vw, 56px); margin: 4px 0 0; line-height: 0.95; }
      .head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .sort-select {
        font: inherit; padding: 8px 12px; border-radius: var(--r-md);
        border: 1px solid var(--line-2); background: var(--bg); color: var(--ink);
      }

      .lv-grid {
        display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start;
      }

      .filter-rail {
        background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-lg);
        padding: 22px; display: flex; flex-direction: column; gap: 18px;
        position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto;
      }
      .rail-section { display: flex; flex-direction: column; gap: 8px; }
      .row-between { display: flex; align-items: baseline; justify-content: space-between; }

      .filter-rail input.search {
        font: inherit; padding: 10px 12px; border-radius: var(--r-md);
        border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); width: 100%;
      }
      .filter-rail input[type="range"] { width: 100%; margin-top: 6px; accent-color: var(--ink); }
      .kcal-num { font-size: 28px; line-height: 1; }

      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip {
        background: var(--bg-2); border: 1px solid var(--line);
        padding: 6px 10px; border-radius: 999px;
        font: inherit; font-size: 12px; cursor: pointer;
        color: var(--ink); display: inline-flex; align-items: center; gap: 6px;
      }
      .chip:hover { border-color: var(--ink-2); }
      .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); font-weight: 600; }
      .chip .count {
        font-size: 10px; opacity: 0.6; font-family: var(--mono);
      }
      .chip.is-on .count { opacity: 0.8; }

      .switch { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-3); cursor: pointer; }

      .season-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .season {
        padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line);
        background: var(--bg); font: inherit; font-size: 12px; font-weight: 600; color: var(--ink);
        display: flex; align-items: center; gap: 6px; cursor: pointer;
      }
      .season .dot { width: 8px; height: 8px; border-radius: 50%; }
      .season.is-on { border-color: var(--ink); }

      .wis-btn { width: 100%; justify-content: center; }

      .results-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }
      .empty { padding: 32px; text-align: center; background: var(--bg); border: 1px dashed var(--line-2); border-radius: var(--r-lg); color: var(--ink-2); }

      .meal-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;
      }

      .view-toggle { display: inline-flex; gap: 0; border: 1px solid var(--line-2); border-radius: var(--r-md); overflow: hidden; }
      .vt { background: var(--bg); color: var(--ink-2); border: none; padding: 6px 12px; font: inherit; font-size: 16px; cursor: pointer; }
      .vt.is-on { background: var(--ink); color: var(--bg); }
      .vt:not(.is-on):hover { background: var(--bg-2); }

      .meal-list { display: flex; flex-direction: column; gap: 4px; }
      .ml-row {
        display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center;
        padding: 8px 10px; border-radius: var(--r-md); border: 1px solid var(--line);
        background: var(--bg); cursor: pointer; font: inherit; text-align: left; color: var(--ink);
      }
      .ml-row:hover { background: var(--bg-2); border-color: var(--ink-2); }
      .ml-fav { font-size: 16px; line-height: 1; cursor: pointer; color: oklch(70% 0.04 60); }
      .ml-fav.is-on { color: oklch(72% 0.16 70); }
      .ml-fav:hover { transform: scale(1.15); }
      .ml-name { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ml-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .ml-meta .cmt { font-size: 11px; }

      @media (max-width: 960px) {
        .lv-grid { grid-template-columns: 1fr; }
        .filter-rail { position: static; max-height: none; }
      }
    </style>
  `;
}
