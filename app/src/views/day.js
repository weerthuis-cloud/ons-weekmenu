// Dag-overzicht: prototype-style day-picker + 1.6fr/1fr layout. v0.7+ zonder FoodPh-placeholder.
import { html, nothing } from 'lit-html';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { DAGEN, DAGEN_KORT, todayInfo, weekDates, formatDate } from '../lib/datums.js';
import { listProfiles, getWeek, addWeek, getWeekMeals, setWeekMeal, removeWeekMeal, moveWeekMeal, swapWeekMeals, onDataChange } from '../lib/data.js';
import { openMealPicker } from '../components/meal-picker.js';
import { openMealDetail } from '../components/meal-detail.js';
import { SlotIcon } from '../components/slot-icon.js';
import { chipForSlot, SLOT_VISUAL, SLOT_TIME } from '../lib/cat.js';
import { rerender, actions as appActions } from '../main.js';

const vs = {
  year: null,
  week: null,
  day: null,
  loading: false,
  weeks: { peter: null, miranda: null },
  meals: { peter: [], miranda: [] },
  profiles: null,
  error: null,
  initialized: false,
};

function ensureInit() {
  if (vs.initialized) return;
  const t = todayInfo();
  vs.year = t.year;
  vs.week = t.week;
  vs.day = t.day;
  vs.initialized = true;
  onDataChange(() => loadAll());
  queueMicrotask(loadAll);
  appActions.setViewWeek(vs.year, vs.week);
}

async function loadAll() {
  vs.loading = true;
  vs.error = null;
  rerender();
  try {
    if (!vs.profiles) vs.profiles = await listProfiles();
    for (const slug of ['peter', 'miranda']) {
      const profile = vs.profiles[slug];
      if (!profile) { vs.weeks[slug] = null; vs.meals[slug] = []; continue; }
      const week = await getWeek(profile.id, vs.year, vs.week);
      vs.weeks[slug] = week;
      vs.meals[slug] = week ? await getWeekMeals(week.id) : [];
    }
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.loading = false;
    rerender();
  }
}

function changeDay(delta) {
  let d = vs.day + delta;
  let w = vs.week, y = vs.year;
  if (d < 1) { d = 7; w -= 1; if (w < 1) { w = 52; y -= 1; } }
  if (d > 7) { d = 1; w += 1; if (w > 52) { w = 1; y += 1; } }
  vs.day = d; vs.week = w; vs.year = y;
  appActions.setViewWeek(vs.year, vs.week);
  loadAll();
}

function setDay(day) {
  vs.day = day;
  rerender();
}

function findMeal(slug, day, slot) {
  return vs.meals[slug].find(m => m.day === day && m.slot === slot) || null;
}

async function openPicker(slug, slot) {
  const profile = vs.profiles?.[slug];
  if (!profile) return;
  if (!vs.weeks[slug]) {
    await addWeek({ ownerId: profile.id, year: vs.year, week: vs.week, source: 'eigen' });
    await loadAll();
  }
  const weekId = vs.weeks[slug].id;
  openMealPicker({
    slot,
    suggestedSuitableFor: slug,
    onPick: async (meal) => {
      await setWeekMeal({ weekId, day: vs.day, slot, mealId: meal.id });
      await loadAll();
    },
  });
}

async function clearSlot(slug, slot) {
  const week = vs.weeks[slug];
  if (!week) return;
  await removeWeekMeal({ weekId: week.id, day: vs.day, slot });
  await loadAll();
}

function openDetail(slug, wm, slot) {
  const week = vs.weeks[slug];
  const siblings = (vs.meals[slug] || []).filter(m => m.slot === slot);
  openMealDetail({
    slot,
    wm,
    siblings,
    onReplace: () => openPicker(slug, slot),
    onClear:   () => clearSlot(slug, slot),
    onMove: week ? async (toDay) => {
      await moveWeekMeal({
        weekId: week.id, fromDay: vs.day, toDay, slot,
        mealId: wm.meal.id, porties: wm.porties ?? 1,
      });
      await loadAll();
    } : null,
    onSwap: week ? async (otherDay) => {
      const other = siblings.find(s => s.day === otherDay);
      if (!other) return;
      await swapWeekMeals({
        weekId: week.id, slot,
        dayA: vs.day,   mealIdA: wm.meal.id,    portiesA: wm.porties ?? 1,
        dayB: otherDay, mealIdB: other.meal.id, portiesB: other.porties ?? 1,
      });
      await loadAll();
    } : null,
  });
}

function dayTotals(slug) {
  const list = (vs.meals[slug] || []).filter(wm => wm.day === vs.day);
  return list.reduce((acc, wm) => {
    if (wm.meal?.kcal)    acc.kcal    += wm.meal.kcal;
    if (wm.meal?.eiwit_g) acc.eiwit_g += Number(wm.meal.eiwit_g);
    if (wm.meal?.koolh_g) acc.koolh_g += Number(wm.meal.koolh_g);
    if (wm.meal?.vet_g)   acc.vet_g   += Number(wm.meal.vet_g);
    return acc;
  }, { kcal: 0, eiwit_g: 0, koolh_g: 0, vet_g: 0 });
}

export function DayView(state) {
  ensureInit();
  const t = todayInfo();
  const dates = weekDates(vs.year, vs.week);
  const date = dates[vs.day - 1];
  const persoon = state.persoon;
  const focusedSlug = persoon === 'beiden' ? 'peter' : persoon;
  const totals = dayTotals(focusedSlug);

  return html`
    <section class="view-wrap dayview">
      <div class="day-picker">
        ${dates.map((d, i) => {
          const dayNum = i + 1;
          const isToday = t.year === vs.year && t.week === vs.week && t.day === dayNum;
          const isActive = vs.day === dayNum;
          return html`
            <button
              class="day-pill ${isActive ? 'is-on' : ''} ${isToday ? 'is-today' : ''}"
              @click=${() => setDay(dayNum)}
            >
              <span class="cmt">${DAGEN_KORT[i].toUpperCase()}</span>
              <span class="display">${d.getUTCDate()}</span>
              ${isToday ? html`<span class="today-tag">● VANDAAG</span>` : ''}
            </button>
          `;
        })}
        <button class="day-pill nav" @click=${() => changeDay(-7)} title="Vorige week">←</button>
        <button class="day-pill nav" @click=${() => changeDay(7)} title="Volgende week">→</button>
      </div>

      ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}

      <div class="day-grid">
        <div class="day-main">
          <div class="day-title">
            <div class="cmt">// ${formatDate(date)} ${date.getUTCFullYear()} · ${DAGEN[vs.day - 1].toLowerCase()}</div>
            <h1 class="display">${DAGEN[vs.day - 1]}</h1>
          </div>

          <div class="slot-list">
            ${SLOTS.map(slot => renderSlot(slot, persoon))}
          </div>
        </div>

        <aside class="day-side">
          ${renderTotalCard(totals, persoon, focusedSlug)}
          ${renderHelperCard()}
        </aside>
      </div>
    </section>

    <style>
      .dayview { display: flex; flex-direction: column; gap: 24px; }

      .day-picker {
        display: flex; gap: 6px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .day-pill {
        background: var(--bg);
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: 10px 16px;
        display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
        min-width: 84px;
        cursor: pointer;
        font: inherit;
        transition: transform .12s ease;
      }
      .day-pill:hover { transform: translateY(-1px); }
      .day-pill .display { font-size: 18px; }
      .day-pill .cmt { opacity: 0.7; font-size: 10px; }
      .day-pill.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      .day-pill.is-on .cmt { color: var(--bg); opacity: 0.7; }
      .day-pill.is-on .display { color: var(--bg); }
      .today-tag { font-size: 9px; font-weight: 700; color: var(--tomato); letter-spacing: 0.05em; }
      .day-pill.is-on .today-tag { color: var(--mustard); }
      .day-pill.nav { min-width: 44px; align-items: center; justify-content: center; padding: 10px; }

      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }

      .day-grid {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 24px;
      }

      .day-title { margin-bottom: 24px; }
      .day-title .display { font-size: clamp(48px, 7vw, 72px); margin: 4px 0 0; line-height: 0.95; }

      .slot-list { display: flex; flex-direction: column; gap: 14px; }
      .slot-row {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 18px;
        display: grid;
        grid-template-columns: 80px 1fr auto;
        gap: 20px;
        align-items: center;
      }
      .slot-row .slot-icon { color: var(--ink); display: flex; align-items: center; justify-content: flex-start; height: 28px; }
      .slot-row .time { font-size: 10px; color: var(--ink-3); margin-top: 2px; }
      .slot-row .meta { display: flex; flex-direction: column; gap: 6px; }
      .slot-row .chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .slot-row .chip { height: 22px; font-size: 11px; }
      .slot-row .name { font-size: 22px; line-height: 1.1; letter-spacing: -0.01em; font-family: var(--display); font-weight: 700; }
      .slot-row.clickable { cursor: pointer; transition: transform .12s ease, border-color .12s; }
      .slot-row.clickable:hover { border-color: var(--ink); transform: translateY(-1px); }
      .slot-row .detail-hint { align-self: flex-start; }
      .slot-row .ing { font-size: 12px; color: var(--ink-3); }
      .slot-row .empty {
        grid-column: 2;
        display: flex; align-items: center; justify-content: center;
        height: 96px;
        border: 1px dashed var(--line-2);
        border-radius: var(--r-md);
        color: var(--ink-3); cursor: pointer; font-size: 13px;
      }
      .slot-row .empty:hover { color: var(--ink); border-color: var(--ink); background: var(--bg-2); }
      .person-tag {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 10px;
        color: white;
        font-weight: 700;
      }
      .person-tag.peter { background: var(--peter); }
      .person-tag.miranda { background: var(--miranda); }

      .day-side { display: flex; flex-direction: column; gap: 14px; }
      .total-card {
        background: var(--mustard);
        border-radius: var(--r-lg);
        padding: 24px;
      }
      .total-card .display { font-size: 56px; margin-top: 4px; line-height: 0.95; }
      .total-card .lead { font-size: 13px; margin-top: 4px; font-weight: 500; }
      .macros { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .macro { }
      .macro .display { font-size: 22px; margin-top: 2px; }
      .macro .display .unit { font-size: 12px; font-weight: 500; opacity: 0.6; }
      .macro .bar { height: 4px; background: oklch(40% 0.05 85 / 0.2); border-radius: 2px; margin-top: 6px; overflow: hidden; }
      .macro .bar > div { height: 100%; background: var(--ink); }

      .helper-card {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 18px;
      }

      @media (max-width: 960px) {
        .day-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .slot-row {
          grid-template-columns: 60px 1fr;
          gap: 12px;
          padding: 14px;
        }
        .slot-row .ph { display: none; }
        .slot-row .recept-btn { grid-column: 2; justify-self: flex-end; }
        .slot-row .name { font-size: 18px; }
      }
    </style>
  `;
}

function renderSlot(slot, persoon) {
  const slotInfo = SLOT_VISUAL[slot.id];
  const showPeter   = persoon === 'peter'   || persoon === 'beiden';
  const showMiranda = persoon === 'miranda' || persoon === 'beiden';
  const p = showPeter   ? findMeal('peter',   vs.day, slot.id) : null;
  const m = showMiranda ? findMeal('miranda', vs.day, slot.id) : null;

  // Persoon-tag tonen alleen in 'beiden'-modus.
  const showPerson = persoon === 'beiden';

  if (persoon === 'beiden') {
    return html`
      ${renderSlotRow(slot, slotInfo, 'peter',   p, true)}
      ${renderSlotRow(slot, slotInfo, 'miranda', m, true)}
    `;
  }
  return renderSlotRow(slot, slotInfo, persoon, p || m, false);
}

function renderSlotRow(slot, slotInfo, slug, wm, showPerson = false) {
  if (!wm) {
    return html`
      <div class="slot-row">
        <div>
          <div class="slot-icon">${SlotIcon({ slot: slot.id, size: 24 })}</div>
          <div class="time">${SLOT_TIME[slot.id]}</div>
        </div>
        <button class="empty" @click=${() => openPicker(slug, slot.id)}>
          + voeg ${slotInfo.korte.toLowerCase()} toe ${showPerson && slug ? `voor ${slug}` : ''}
        </button>
      </div>
    `;
  }
  const ingNames = (wm.meal.ingredients || []).map(i => i.name).filter(Boolean).slice(0, 6);
  return html`
    <div class="slot-row clickable" @click=${() => openDetail(slug, wm, slot.id)}>
      <div>
        <div class="slot-icon">${SlotIcon({ slot: slot.id, size: 24 })}</div>
        <div class="time">${SLOT_TIME[slot.id]}</div>
      </div>
      <div class="meta">
        <div class="chips">
          <span class="chip ${chipForSlot(slot.id)}">${slotInfo.korte}</span>
          ${showPerson ? html`<span class="person-tag ${slug}">${slug === 'peter' ? 'P' : 'M'}</span>` : ''}
          ${wm.meal.bereidingstijd ? html`<span class="chip">${wm.meal.bereidingstijd}m</span>` : ''}
          ${(wm.meal.tags || []).slice(0, 1).map(t => html`<span class="chip">${t}</span>`)}
          ${slot.id === 'diner' && wm.meal.recipe ? html`<span class="chip leaf">recept ✓</span>` : ''}
        </div>
        <div class="name">${wm.meal.name}</div>
        ${wm.meal.kcal ? html`
          <div class="cmt">
            ${wm.meal.kcal} kcal${wm.meal.eiwit_g ? ` · ${wm.meal.eiwit_g}g eiwit` : ''}${wm.meal.koolh_g ? ` · ${wm.meal.koolh_g}g koolh` : ''}${wm.meal.vet_g ? ` · ${wm.meal.vet_g}g vet` : ''}
          </div>
        ` : ''}
        ${ingNames.length ? html`<div class="ing">${ingNames.join(', ')}</div>` : ''}
      </div>
      <span class="cmt detail-hint">tap voor ${slot.id === 'diner' ? 'recept' : 'details'} →</span>
    </div>
  `;
}

function renderTotalCard(totals, persoon, focusedSlug) {
  const target = 1900; // statisch; later configureerbaar
  const diff = totals.kcal - target;
  return html`
    <div class="total-card">
      <div class="cmt">// dag-totaal${persoon === 'beiden' ? ` (${focusedSlug})` : ''}</div>
      <div class="display">${totals.kcal ? totals.kcal.toLocaleString('nl-NL') : '—'}</div>
      <div class="lead">
        ${totals.kcal
          ? `kcal · doel ${target.toLocaleString('nl-NL')} (${diff > 0 ? '+' : ''}${diff})`
          : 'voeg maaltijden toe om totalen te zien'}
      </div>
      ${totals.kcal ? html`
        <div class="macros">
          ${MacroBlock('eiwit', totals.eiwit_g, 90, 'g')}
          ${MacroBlock('koolh.', totals.koolh_g, 240, 'g')}
          ${MacroBlock('vet', totals.vet_g, 70, 'g')}
        </div>
      ` : ''}
    </div>
  `;
}

function MacroBlock(label, value, target, unit) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return html`
    <div class="macro">
      <div class="cmt">${label}</div>
      <div class="display">${Math.round(value)}<span class="unit">${unit}</span></div>
      <div class="bar"><div style="width:${pct}%;"></div></div>
    </div>
  `;
}

function renderHelperCard() {
  return html`
    <div class="helper-card">
      <div class="cmt">// tip</div>
      <div style="font-size: 14px; font-weight: 600; margin-top: 4px;">
        Klik op een maaltijd om te vervangen.
      </div>
      <div style="font-size: 12px; color: var(--ink-3); margin-top: 6px;">
        Of klik × rechts in de rij om hem leeg te maken.
      </div>
    </div>
  `;
}
