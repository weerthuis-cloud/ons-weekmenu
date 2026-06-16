// v2.27: plan een gerecht vanuit de Bibliotheek in een week.
// Toont een weekraster (7 dagen x 6 slots) met de bestaande planning.
// Klik een cel om het aangeklikte gerecht daar te plaatsen. Week wordt
// aangemaakt als 'eigen' week wanneer die nog niet bestaat.

import { html, render } from 'lit-html';
import { SLOTS } from '../lib/slots.js';
import { DAGEN_KORT, todayInfo, weekDates, formatWeekRangeCompact } from '../lib/datums.js';
import { listProfiles, getWeek, addWeek, getWeekMeals, setWeekMeal } from '../lib/data.js';

const HOST_ID = '__meal_scheduler_host';

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

        <div class="ms-gridwrap">
          <div class="ms-grid" style="grid-template-columns: 70px repeat(7, minmax(76px, 1fr));">
            <div class="ms-corner"></div>
            ${dates.map((d, i) => {
              const isToday = t.year === ui.year && t.week === ui.week && t.day === i + 1;
              return html`<div class="ms-dayhead ${isToday ? 'today' : ''}">
                <span class="ms-dow">${DAGEN_KORT[i]}</span><span class="ms-dom">${d.getUTCDate()}</span>
              </div>`;
            })}
            ${SLOTS.map(s => html`
              <div class="ms-slotlabel ${s.id === mealType ? 'suggest' : ''}">
                <span class="ms-emoji">${s.emoji}</span><span>${s.short}</span>
              </div>
              ${dates.map((_, i) => {
                const day = i + 1;
                const wm = findMeal(day, s.id);
                const placed = ui.lastPlaced && ui.lastPlaced.day === day && ui.lastPlaced.slot === s.id;
                return html`
                  <button class="ms-cell ${s.id === mealType ? 'suggest' : ''} ${wm ? 'filled' : 'empty'} ${placed ? 'placed' : ''}"
                    ?disabled=${ui.busy}
                    title=${wm ? `${wm.meal?.name ?? ''} — klik om te vervangen` : 'klik om hier in te plannen'}
                    @click=${() => place(day, s.id)}>
                    ${wm ? html`<span class="ms-cellname">${wm.meal?.name ?? '—'}</span>` : html`<span class="ms-plus">+</span>`}
                  </button>`;
              })}
            `)}
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
        .ms-gridwrap { padding: 14px 22px; overflow: auto; flex: 1; }
        .ms-grid { display: grid; gap: 4px; min-width: 620px; }
        .ms-corner { }
        .ms-dayhead { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; font-size: 12px; color: var(--ink-2); }
        .ms-dayhead.today { color: var(--ink); font-weight: 700; }
        .ms-dom { font-size: 11px; color: var(--ink-3); }
        .ms-slotlabel { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-2); padding-right: 4px; }
        .ms-slotlabel.suggest { color: var(--ink); font-weight: 600; }
        .ms-emoji { font-size: 13px; }
        .ms-cell { font: inherit; cursor: pointer; min-height: 46px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); color: var(--ink-2); padding: 4px 5px; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
        .ms-cell.empty { background: var(--bg); border-style: dashed; color: var(--ink-3); }
        .ms-cell.suggest { border-color: var(--ink-2); }
        .ms-cell.empty.suggest { background: var(--bg-2); }
        .ms-cell:hover:not(:disabled) { border-color: var(--ink); background: var(--bg-3); }
        .ms-cell:disabled { opacity: 0.6; cursor: default; }
        .ms-cell.placed { outline: 2px solid var(--ink); outline-offset: 1px; }
        .ms-cellname { font-size: 11px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .ms-plus { font-size: 18px; color: var(--ink-3); }
        .ms-foot { padding: 12px 22px 16px; border-top: 1px solid var(--line); display: flex; gap: 12px; align-items: center; justify-content: space-between; }
        .ms-hint { font-size: 13px; color: var(--ink-2); }
        @media (max-width: 520px) {
          .ms-controls { flex-direction: column; align-items: stretch; gap: 10px; }
          .ms-weeknav { justify-content: space-between; }
        }
      </style>
    </div>
  `;
}
