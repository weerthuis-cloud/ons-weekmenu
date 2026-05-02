// Maker / bibliotheek v0.6: prototype-stijl 320px filter-rail + meal-grid.
import { html, nothing } from 'lit-html';
import { listMeals, onDataChange } from '../lib/data.js';
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

const vs = {
  loading: false,
  error: null,
  meals: [],
  q: '',
  type: '',
  suitable: '',
  kcalMax: 900,
  kcalMaxOn: false,
  seizoen: '',
  tag: '',
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
  try { vs.meals = await listMeals(); }
  catch (err) { vs.error = err.message; }
  finally { vs.loading = false; rerender(); }
}

function filtered() {
  let list = vs.meals;
  const q = vs.q.trim().toLowerCase();
  if (q) list = list.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.ingredients || []).some(i => (i.name || '').toLowerCase().includes(q))
  );
  if (vs.type) list = list.filter(m => m.type === vs.type);
  if (vs.suitable) list = list.filter(m => (m.suitable_for || []).includes(vs.suitable));
  if (vs.kcalMaxOn) list = list.filter(m => m.kcal != null && m.kcal <= vs.kcalMax);
  if (vs.seizoen) list = list.filter(m => (m.seizoen || []).includes(vs.seizoen));
  if (vs.tag) list = list.filter(m => (m.tags || []).includes(vs.tag));
  return list;
}

function allTags() {
  const set = new Set();
  for (const m of vs.meals) for (const t of (m.tags || [])) set.add(t);
  return Array.from(set).sort();
}

function clearFilters() {
  vs.q = ''; vs.type = ''; vs.suitable = ''; vs.kcalMax = 900; vs.kcalMaxOn = false;
  vs.seizoen = ''; vs.tag = '';
  rerender();
}

function hasFilters() {
  return vs.q || vs.type || vs.suitable || vs.kcalMaxOn || vs.seizoen || vs.tag;
}

export function BuildView(state) {
  ensureInit();
  const list = filtered();
  const tags = allTags();

  return html`
    <section class="view-wrap buildview">
      <div class="bv-head">
        <div>
          <div class="cmt">// stel zelf je weekmenu samen</div>
          <h1 class="display">Bouw je eigen week.</h1>
        </div>
        <button class="btn" @click=${() => openMealCreator({ defaultType: vs.type || 'ontbijt', onSaved: () => loadAll() })}>
          + nieuwe maaltijd
        </button>
      </div>

      <div class="bv-grid">
        <aside class="filter-rail">
          <div class="rail-section">
            <div class="cmt">// zoek</div>
            <input
              type="search"
              class="search"
              placeholder="naam of ingrediënt…"
              .value=${vs.q}
              @input=${(e) => { vs.q = e.target.value; rerender(); }}
            />
          </div>

          <div class="rail-section">
            <div class="cmt">// slot</div>
            <div class="seg">
              <button class="seg-btn ${vs.type === '' ? 'is-on' : ''}" @click=${() => { vs.type = ''; rerender(); }}>alle</button>
              ${SLOTS.map(s => html`
                <button class="seg-btn icon ${vs.type === s.id ? 'is-on' : ''}" @click=${() => { vs.type = s.id; rerender(); }} title=${s.label}>
                  ${SlotIcon({ slot: s.id, size: 16 })}
                </button>
              `)}
            </div>
          </div>

          <div class="rail-section">
            <div class="cmt">// voor wie</div>
            <div class="suitable-grid">
              ${[
                { id: '',        label: 'iedereen', kleur: '' },
                { id: 'beiden',  label: 'beiden',   kleur: 'leaf' },
                { id: 'peter',   label: 'Peter',    kleur: 'berry' },
                { id: 'miranda', label: 'Miranda',  kleur: 'plum' },
              ].map(s => html`
                <button class="chip ${s.kleur} ${vs.suitable === s.id ? 'is-on' : ''}" @click=${() => { vs.suitable = s.id; rerender(); }}>
                  ${s.label}
                </button>
              `)}
            </div>
          </div>

          <div class="rail-section">
            <div class="row-between">
              <div class="cmt">// max kcal per maaltijd</div>
              <label class="switch">
                <input type="checkbox" .checked=${vs.kcalMaxOn} @change=${(e) => { vs.kcalMaxOn = e.target.checked; rerender(); }} />
                <span>aan</span>
              </label>
            </div>
            <div class="row-between" style="margin-top: 6px;">
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
                <span class="dot" style="background: var(--ink-3);"></span>
                jaarrond
              </button>
              ${SEIZOENEN.map(s => html`
                <button class="season ${vs.seizoen === s.id ? 'is-on' : ''}"
                  style="background: ${vs.seizoen === s.id ? `oklch(94% 0.04 ${s.hue})` : 'var(--bg)'};"
                  @click=${() => { vs.seizoen = s.id; rerender(); }}>
                  <span class="dot" style="background: oklch(70% 0.16 ${s.hue});"></span>
                  ${s.label}
                </button>
              `)}
            </div>
          </div>

          ${tags.length ? html`
            <div class="rail-section">
              <div class="cmt">// tag</div>
              <div class="suitable-grid">
                <button class="chip ${vs.tag === '' ? 'is-on' : ''}" @click=${() => { vs.tag = ''; rerender(); }}>alle</button>
                ${tags.map(t => html`
                  <button class="chip ${vs.tag === t ? 'is-on' : ''}" @click=${() => { vs.tag = t; rerender(); }}>${t}</button>
                `)}
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
                ? html`<p>Bibliotheek is leeg. Klik <strong>+ nieuwe maaltijd</strong> bovenin.</p>`
                : html`<p>Geen maaltijden voldoen aan de filters.</p>`}
            </div>
          ` : html`
            <div class="meal-grid">
              ${list.map(m => MealCard({
                meal: m,
                size: 'md',
                showMacros: true,
                onClick: () => openMealEditor({ meal: m, onSaved: () => loadAll() }),
              }))}
            </div>
          `}
        </div>
      </div>
    </section>

    <style>
      .buildview { display: flex; flex-direction: column; gap: 24px; }

      .bv-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .bv-head h1 { font-size: clamp(36px, 5vw, 56px); margin: 4px 0 0; line-height: 0.95; }

      .bv-grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 24px;
        align-items: start;
      }

      .filter-rail {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 22px;
        position: sticky;
        top: 20px;
      }
      .rail-section { display: flex; flex-direction: column; gap: 8px; }
      .row-between { display: flex; align-items: baseline; justify-content: space-between; }

      .filter-rail input.search {
        font: inherit;
        padding: 10px 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--line-2);
        background: var(--bg);
        color: var(--ink);
        width: 100%;
      }
      .filter-rail input[type="range"] {
        width: 100%;
        margin-top: 6px;
        accent-color: var(--ink);
      }
      .kcal-num { font-size: 36px; line-height: 1; }

      .seg {
        display: flex; gap: 4px; flex-wrap: wrap;
        background: var(--bg-2);
        padding: 4px;
        border-radius: 10px;
      }
      .seg-btn {
        background: transparent; border: none;
        padding: 6px 10px; border-radius: 7px;
        font: inherit; font-size: 13px; cursor: pointer;
        color: var(--ink-2);
      }
      .seg-btn.is-on { background: var(--bg); color: var(--ink); box-shadow: 0 1px 3px oklch(0% 0 0 / 0.06); }
      .seg-btn.icon { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; padding: 6px 8px; }

      .suitable-grid { display: flex; flex-wrap: wrap; gap: 6px; }
      .suitable-grid .chip { cursor: pointer; }
      .suitable-grid .chip.is-on { outline: 2px solid var(--ink); outline-offset: 1px; }

      .switch { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-3); cursor: pointer; }

      .season-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      }
      .season {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--bg);
        font: inherit; font-size: 13px; font-weight: 600; color: var(--ink);
        display: flex; align-items: center; gap: 8px;
        cursor: pointer;
      }
      .season .dot { width: 10px; height: 10px; border-radius: 50%; }
      .season.is-on { border-color: var(--ink); }

      .wis-btn { width: 100%; justify-content: center; }

      .results-head {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 14px;
      }
      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }
      .empty { padding: 32px; text-align: center; background: var(--bg); border: 1px dashed var(--line-2); border-radius: var(--r-lg); color: var(--ink-2); }

      .meal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }

      @media (max-width: 960px) {
        .bv-grid { grid-template-columns: 1fr; }
        .filter-rail { position: static; }
      }
    </style>
  `;
}
