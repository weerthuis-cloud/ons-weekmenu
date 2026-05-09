// v2.11: auto-genereer week met filter-modal.
// Geopend via knop in WeekView. Filters: dieet multi, cuisine, max kooktijd.

import { html, render } from 'lit-html';
import { generateWeekMenu, listProfiles } from '../lib/data.js';

const HOST_ID = '__autogen_host';

const DIETEN = [
  ['eiwitrijk', 'Eiwitrijk'], ['koolhydraatrijk', 'Koolhydraatrijk'],
  ['vezelrijk', 'Vezelrijk'], ['keto', 'Keto'],
  ['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan'],
  ['glutenvrij', 'Glutenvrij'], ['lactosevrij', 'Lactosevrij'],
];
const CUISINES = ['', 'italiaans', 'mexicaans', 'aziatisch', 'indiaas', 'frans', 'hollands', 'mediterraan', 'amerikaans', 'bbq'];
const KOOKTIJD_BUCKETS = [['', '— geen limiet —'], ['15', '≤ 15 min'], ['30', '≤ 30 min'], ['45', '≤ 45 min'], ['60', '≤ 60 min']];

const ui = {
  open: false,
  ctx: null,    // { year, week, persoon, onDone }
  filters: { dieet: new Set(), cuisine: '', maxBereidingstijd: '', alleenFavoriet: false },
  busy: false,
  result: null,
  error: null,
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

function rerender() { render(view(), ensureHost()); }

export function openAutoGenerate({ year, week, persoon, onDone }) {
  ui.open = true;
  ui.ctx = { year, week, persoon, onDone };
  ui.filters = { dieet: new Set(), cuisine: '', maxBereidingstijd: '', alleenFavoriet: false };
  ui.busy = false; ui.result = null; ui.error = null;
  rerender();
}

function close() { ui.open = false; ui.result = null; rerender(); }

function toggleDieet(d) {
  if (ui.filters.dieet.has(d)) ui.filters.dieet.delete(d);
  else ui.filters.dieet.add(d);
  rerender();
}

async function submit() {
  if (!ui.ctx) return;
  ui.busy = true; ui.error = null; rerender();
  try {
    const profiles = await listProfiles();
    const targets = ui.ctx.persoon === 'beiden' ? ['peter', 'miranda'] : [ui.ctx.persoon];
    const filters = {
      dieet: [...ui.filters.dieet],
      cuisine: ui.filters.cuisine || undefined,
      maxBereidingstijd: ui.filters.maxBereidingstijd ? parseInt(ui.filters.maxBereidingstijd, 10) : undefined,
      alleenFavoriet: ui.filters.alleenFavoriet,
    };
    const results = [];
    for (const slug of targets) {
      const p = profiles[slug];
      if (!p) continue;
      const r = await generateWeekMenu({ ownerId: p.id, year: ui.ctx.year, week: ui.ctx.week, filters });
      results.push({ slug, ...r });
    }
    ui.result = results;
    if (ui.ctx.onDone) ui.ctx.onDone();
  } catch (err) {
    ui.error = err.message;
  } finally {
    ui.busy = false;
    rerender();
  }
}

function view() {
  if (!ui.open) return null;
  const f = ui.filters;
  return html`
    <div class="ag-backdrop" @click=${close}>
      <div class="ag-modal" @click=${(e) => e.stopPropagation()}>
        <header class="ag-head">
          <div>
            <p class="lead">// auto-vul week ${ui.ctx?.week} (${ui.ctx?.year})</p>
            <h3 class="display">Genereer weekmenu</h3>
          </div>
          <button class="btn ghost small" @click=${close}>sluit</button>
        </header>

        <div class="ag-body">
          <p class="cmt">Vult ontbijt, lunch en diner voor alle 7 dagen met willekeurige recepten die aan je filter voldoen. Bestaande maaltijden worden overschreven; tussendoortjes blijven staan.</p>

          <div class="ag-section">
            <div class="cmt">// dieet (alle gekozen tags moeten matchen)</div>
            <div class="chips">
              ${DIETEN.map(([id, label]) => html`
                <button class="chip ${f.dieet.has(id) ? 'is-on' : ''}"
                  @click=${() => toggleDieet(id)}>${label}</button>
              `)}
            </div>
          </div>

          <div class="ag-section">
            <div class="cmt">// keuken</div>
            <select class="ag-select" .value=${f.cuisine}
              @change=${(e) => { f.cuisine = e.target.value; rerender(); }}>
              ${CUISINES.map(c => html`<option value=${c} ?selected=${c === f.cuisine}>${c || '— alle —'}</option>`)}
            </select>
          </div>

          <div class="ag-section">
            <div class="cmt">// max kooktijd</div>
            <select class="ag-select" .value=${f.maxBereidingstijd}
              @change=${(e) => { f.maxBereidingstijd = e.target.value; rerender(); }}>
              ${KOOKTIJD_BUCKETS.map(([v, label]) => html`<option value=${v} ?selected=${v === f.maxBereidingstijd}>${label}</option>`)}
            </select>
          </div>

          <div class="ag-section">
            <label class="ag-check">
              <input type="checkbox" ?checked=${f.alleenFavoriet}
                @change=${(e) => { f.alleenFavoriet = e.target.checked; rerender(); }} />
              Alleen uit favorieten
            </label>
          </div>

          ${ui.result ? html`
            <div class="ag-result">
              <div class="cmt">// resultaat</div>
              ${ui.result.map(r => html`
                <p>${r.slug}: <strong>${r.inserted}</strong> maaltijden geplaatst (pool van ${r.poolSize} recepten).
                ${r.stats?.mismatch?.length ? html`<br><span class="warn">⚠ niet gevuld: ${r.stats.mismatch.join(', ')}</span>` : ''}</p>
              `)}
            </div>
          ` : ''}

          ${ui.error ? html`<div class="err">${ui.error}</div>` : ''}
        </div>

        <footer class="ag-foot">
          <button class="btn ghost" @click=${close}>${ui.result ? 'klaar' : 'annuleer'}</button>
          ${!ui.result ? html`
            <button class="btn" @click=${submit} ?disabled=${ui.busy}>${ui.busy ? 'Genereren…' : 'Genereer week'}</button>
          ` : ''}
        </footer>
      </div>

      <style>
        .ag-backdrop { position: fixed; inset: 0; background: oklch(18% 0.02 60 / 0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ag-modal { background: var(--bg); border-radius: var(--r-lg); width: 100%; max-width: 560px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3); }
        .ag-head { padding: 22px 22px 14px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .ag-head h3 { font-size: 22px; }
        .ag-head .lead { font-size: 12px; color: var(--ink-3); margin: 0 0 4px; }
        .ag-body { padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
        .ag-section { display: flex; flex-direction: column; gap: 6px; }
        .ag-select { font: inherit; padding: 8px 12px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); width: 100%; }
        .ag-check { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; }
        .chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { background: var(--bg-2); border: 1px solid var(--line); padding: 6px 10px; border-radius: 999px; font: inherit; font-size: 12px; cursor: pointer; color: var(--ink); }
        .chip:hover { border-color: var(--ink-2); }
        .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); font-weight: 600; }
        .ag-result { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; }
        .ag-result p { margin: 4px 0; font-size: 14px; }
        .warn { color: oklch(45% 0.12 50); font-size: 12px; }
        .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); font-size: 14px; }
        .ag-foot { padding: 14px 22px 18px; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: flex-end; }
      </style>
    </div>
  `;
}
