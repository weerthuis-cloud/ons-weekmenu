// v2.27: plan een gerecht vanuit de Bibliotheek in een week.
// Toont een weekraster (7 dagen x 6 slots) met de bestaande planning.
// Klik een cel om het aangeklikte gerecht daar te plaatsen. Week wordt
// aangemaakt als 'eigen' week wanneer die nog niet bestaat.

import { html, svg, render } from 'lit-html';
import { SLOTS } from '../lib/slots.js';
import { DAGEN, todayInfo, weekDates, formatWeekRangeCompact, formatDate } from '../lib/datums.js';
import { listProfiles, getWeek, addWeek, getWeekMeals, setWeekMeal } from '../lib/data.js';

const HOST_ID = '__meal_scheduler_host';

// v2.29: strakke monochrome lijn-iconen per slot (dag-cyclus: zon → koffie → zenit → driehoek → maan → ster).
const ST = 1.6;
const SLOT_SVG = {
  ontbijt: svg`<circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width=${ST}/>
    <g stroke="currentColor" stroke-width=${ST} stroke-linecap="round">
      <line x1="12" y1="4" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="20"/>
      <line x1="4" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="20" y2="12"/>
      <line x1="6.2" y1="6.2" x2="7.6" y2="7.6"/><line x1="16.4" y1="16.4" x2="17.8" y2="17.8"/>
      <line x1="6.2" y1="17.8" x2="7.6" y2="16.4"/><line x1="16.4" y1="7.6" x2="17.8" y2="6.2"/></g>`,
  snack_ochtend: svg`<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width=${ST}/>
    <line x1="9" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width=${ST} stroke-linecap="round"/>
    <line x1="9" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width=${ST} stroke-linecap="round"/>`,
  lunch: svg`<circle cx="12" cy="12" r="5.5" fill="currentColor"/>`,
  snack_middag: svg`<path d="M12 5 L19 19 L5 19 Z" fill="none" stroke="currentColor" stroke-width=${ST} stroke-linejoin="round"/>`,
  diner: svg`<path d="M16 4 a 8 8 0 1 0 0 16 a 6 6 0 1 1 0 -16 z" fill="currentColor"/>`,
  snack_avond: svg`<path d="M12 4 L13.6 10 L20 10 L14.8 13.6 L16.8 19.6 L12 16 L7.2 19.6 L9.2 13.6 L4 10 L10.4 10 Z"
      fill="none" stroke="currentColor" stroke-width=${ST} stroke-linejoin="round"/>`,
};
const SLOT_LABEL = {
  ontbijt: 'Ontbijt', snack_ochtend: 'Ochtend', lunch: 'Lunch',
  snack_middag: 'Middag', diner: 'Diner', snack_avond: 'Avond',
};
function SlotGlyph(slot) {
  return svg`<svg width="16" height="16" viewBox="0 0 24 24" style="display:block" aria-hidden="true">${SLOT_SVG[slot]}</svg>`;
}

const ui = {
  open: false,
  meal: null,
  onDone: null,
  profiles: null,
  persoon: 'peter',
  ookBeiden: false,
  year: null,
  week: null,
  weekRow: null,    // week-record van de geselecteerde persoon
  meals: [],        // week_meals van de geselecteerde persoon
  loading: false,
  busy: false,
  error: null,
  lastPlaced: null, // { day, slot } voor de bevestiging
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

export function openMealScheduler({ meal, onDone = null }) {
  if (!meal) return;
  ui.open = true;
  ui.meal = meal;
  ui.onDone = onDone;
  ui.persoon = 'peter';
  ui.ookBeiden = false;
  const t = todayInfo();
  ui.year = t.year;
  ui.week = t.week;
  ui.weekRow = null;
  ui.meals = [];
  ui.loading = false;
  ui.busy = false;
  ui.error = null;
  ui.lastPlaced = null;
  rerender();
  loadWeek();
}

function close() {
  ui.open = false;
  ui.meal = null;
  if (ui.onDone) ui.onDone();
  rerender();
}

async function ensureProfiles() {
  if (!ui.profiles) ui.profiles = await listProfiles();
}

async function loadWeek() {
  ui.loading = true; ui.error = null; rerender();
  try {
    await ensureProfiles();
    const p = ui.profiles?.[ui.persoon];
    if (!p) { ui.weekRow = null; ui.meals = []; return; }
    const w = await getWeek(p.id, ui.year, ui.week);
    ui.weekRow = w;
    ui.meals = w ? await getWeekMeals(w.id) : [];
  } catch (err) {
    ui.error = err.message;
  } finally {
    ui.loading = false;
    rerender();
  }
}

function changeWeek(delta) {
  ui.week += delta;
  if (ui.week < 1) { ui.week = 52; ui.year -= 1; }
  else if (ui.week > 52) { ui.week = 1; ui.year += 1; }
  ui.lastPlaced = null;
  loadWeek();
}

function setPersoon(slug) {
  if (ui.persoon === slug) return;
  ui.persoon = slug;
  ui.lastPlaced = null;
  loadWeek();
}

function findMeal(day, slot) {
  return ui.meals.find(m => m.day === day && m.slot === slot) || null;
}

async function ensureWeekFor(slug) {
  const p = ui.profiles[slug];
  let w = await getWeek(p.id, ui.year, ui.week);
  if (!w) w = await addWeek({ ownerId: p.id, year: ui.year, week: ui.week, source: 'eigen' });
  return w;
}

async function place(day, slot) {
  if (ui.busy || !ui.meal) return;
  ui.busy = true; ui.error = null; rerender();
  try {
    await ensureProfiles();
    const targets = ui.ookBeiden ? ['peter', 'miranda'] : [ui.persoon];
    for (const slug of targets) {
      if (!ui.profiles?.[slug]) continue;
      const w = await ensureWeekFor(slug);
      await setWeekMeal({ weekId: w.id, day, slot, mealId: ui.meal.id });
    }
    ui.lastPlaced = { day, slot };
    await loadWeek();
  } catch (err) {
    ui.error = err.message;
  } finally {
    ui.busy = false;
    rerender();
  }
}

function view() {
  if (!ui.open) return null;
  const t = todayInfo();
  const dates = weekDates(ui.year, ui.week);
  const mealType = ui.meal?.type;

  return html`
    <div class="ms-backdrop" @click=${close}>
      <div class="ms-modal" @click=${(e) => e.stopPropagation()}>
        <header class="ms-head">
          <div>
            <p class="ms-lead">// inplannen</p>
            <h3 class="ms-title">${ui.meal?.name ?? 'Gerecht'}</h3>
          </div>
          <button class="btn ghost small" @click=${close}>sluit</button>
        </header>

        <div class="ms-controls">
          <div class="ms-persoon" role="group" aria-label="Persoon">
            ${['peter', 'miranda'].map(slug => html`
              <button type="button" class="ms-pchip ${ui.persoon === slug ? 'is-on' : ''}"
                @click=${() => setPersoon(slug)}>${ui.profiles?.[slug]?.naam ?? slug}</button>`)}
            <label class="ms-beiden">
              <input type="checkbox" ?checked=${ui.ookBeiden}
                @change=${(e) => { ui.ookBeiden = e.target.checked; rerender(); }} />
              ook voor de ander
            </label>
          </div>
          <div class="ms-weeknav">
            <button class="btn ghost small" @click=${() => changeWeek(-1)}>←</button>
            <span class="ms-weeklabel">week ${ui.week} · ${formatWeekRangeCompact(ui.year, ui.week)}</span>
            <button class="btn ghost small" @click=${() => changeWeek(1)}>→</button>
          </div>
        </div>

        ${ui.error ? html`<div class="ms-err">${ui.error}</div>` : ''}

        <div class="ms-cardswrap">
          <div class="ms-cards">
            ${dates.map((d, i) => {
              const day = i + 1;
              const isToday = t.year === ui.year && t.week === ui.week && t.day === day;
              return html`
                <div class="ms-day ${isToday ? 'today' : ''}">
                  <div class="ms-dayhead">
                    <span class="ms-dayname">${DAGEN[i]}</span>
                    <span class="ms-daydate">${formatDate(d)}${isToday ? ' · vandaag' : ''}</span>
                  </div>
                  ${SLOTS.map(s => {
                    const wm = findMeal(day, s.id);
                    const placed = ui.lastPlaced && ui.lastPlaced.day === day && ui.lastPlaced.slot === s.id;
                    return html`
                      <button class="ms-row ${s.id === mealType ? 'suggest' : ''} ${wm ? 'filled' : 'empty'} ${placed ? 'placed' : ''}"
                        ?disabled=${ui.busy}
                        title=${wm ? `${wm.meal?.name ?? ''} — klik om te vervangen` : 'klik om hier in te plannen'}
                        @click=${() => place(day, s.id)}>
                        <span class="ms-ico">${SlotGlyph(s.id)}</span>
                        <span class="ms-rowlabel">${SLOT_LABEL[s.id]}</span>
                        <span class="ms-rowmeal">${wm ? (wm.meal?.name ?? '—') : 'toevoegen'}</span>
                      </button>`;
                  })}
                </div>`;
            })}
          </div>
        </div>

        <footer class="ms-foot">
          <span class="ms-hint">
            ${ui.lastPlaced
              ? html`✓ Geplaatst. Klik gerust nog een dag aan, of sluit met klaar.`
              : html`Kies een cel om <strong>${ui.meal?.name}</strong> in te plannen.`}
          </span>
          <button class="btn" @click=${close}>klaar</button>
        </footer>
      </div>

      <style>
        .ms-backdrop { position: fixed; inset: 0; background: oklch(18% 0.02 60 / 0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ms-modal { background: var(--bg); border-radius: var(--r-lg); width: 100%; max-width: 760px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3); }
        .ms-head { padding: 20px 22px 12px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .ms-lead { font-size: 12px; color: var(--ink-3); margin: 0 0 4px; }
        .ms-title { font-size: 20px; }
        .btn.small { height: 28px; padding: 0 10px; font-size: 12px; }
        .ms-controls { padding: 12px 22px; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
        .ms-persoon { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ms-pchip { font: inherit; font-size: 13px; cursor: pointer; background: var(--bg-2); border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; color: var(--ink-2); }
        .ms-pchip.is-on { background: var(--ink); border-color: var(--ink); color: var(--bg); font-weight: 600; }
        .ms-beiden { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--ink-2); cursor: pointer; }
        .ms-weeknav { display: flex; align-items: center; gap: 8px; }
        .ms-weeklabel { font-size: 13px; color: var(--ink-2); white-space: nowrap; }
        .ms-err { margin: 12px 22px 0; background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); font-size: 14px; }
        .ms-cardswrap { padding: 14px 22px; overflow-y: auto; flex: 1; }
        .ms-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .ms-day { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: var(--bg); }
        .ms-day.today { border-color: var(--ink); }
        .ms-dayhead { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
        .ms-dayname { font-size: 13px; font-weight: 600; color: var(--ink); }
        .ms-daydate { font-size: 11px; color: var(--ink-3); }
        .ms-day.today .ms-daydate { color: var(--ink-2); }
        .ms-row { width: 100%; font: inherit; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 6px; border: none; border-radius: var(--r-sm); background: transparent; color: var(--ink-2); text-align: left; }
        .ms-row + .ms-row { border-top: 1px solid var(--line); border-radius: 0; }
        .ms-ico { color: var(--ink-3); display: flex; flex: 0 0 16px; }
        .ms-rowlabel { font-size: 11px; color: var(--ink-3); flex: 0 0 52px; }
        .ms-rowmeal { font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ms-row.filled .ms-rowmeal { color: var(--ink); }
        .ms-row.empty .ms-rowmeal { color: var(--ink-3); }
        .ms-row.suggest .ms-ico, .ms-row.suggest .ms-rowlabel { color: var(--ink); }
        .ms-row:hover:not(:disabled) { background: var(--bg-2); }
        .ms-row:hover:not(:disabled) .ms-rowmeal { color: var(--ink); }
        .ms-row:disabled { opacity: 0.6; cursor: default; }
        .ms-row.placed { background: var(--bg-3); outline: 1.5px solid var(--ink); outline-offset: -1px; }
        .ms-foot { padding: 12px 22px 16px; border-top: 1px solid var(--line); display: flex; gap: 12px; align-items: center; justify-content: space-between; }
        .ms-hint { font-size: 13px; color: var(--ink-2); }
        @media (max-width: 520px) {
          .ms-controls { flex-direction: column; align-items: stretch; gap: 10px; }
          .ms-weeknav { justify-content: space-between; }
          .ms-cards { grid-template-columns: 1fr; }
        }
      </style>
    </div>
  `;
}
