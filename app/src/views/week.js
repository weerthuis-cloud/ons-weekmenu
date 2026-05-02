// Week-overzicht v0.6: prototype-style hero + 7-dagen grid met MealCards.
import { html, nothing } from 'lit-html';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { DAGEN_KORT, DAGEN, todayInfo, formatWeekRange, weekDates, formatDate } from '../lib/datums.js';
import { listProfiles, getWeek, addWeek, getWeekMeals, setWeekMeal, removeWeekMeal, onDataChange } from '../lib/data.js';
import { openMealPicker } from '../components/meal-picker.js';
import { MealCard } from '../components/meal-card.js';
import { Sparkline } from '../components/sparkline.js';
import { SlotIcon } from '../components/slot-icon.js';
import { hueForSlot, chipForSlot, SLOT_VISUAL } from '../lib/cat.js';
import { rerender } from '../main.js';
import { setRoute } from '../router.js';

// view-state
const vs = {
  year: null,
  week: null,
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
  vs.initialized = true;
  onDataChange(() => loadAll());
  queueMicrotask(loadAll);
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

async function ensureWeek(slug) {
  if (!vs.profiles?.[slug]) return;
  if (vs.weeks[slug]) return;
  await addWeek({ ownerId: vs.profiles[slug].id, year: vs.year, week: vs.week, source: 'eigen' });
  await loadAll();
}

function changeWeek(delta) {
  vs.week += delta;
  if (vs.week < 1) { vs.week = 52; vs.year -= 1; }
  else if (vs.week > 52) { vs.week = 1; vs.year += 1; }
  loadAll();
}

export function gotoWeek(year, week) {
  ensureInit();
  vs.year = year;
  vs.week = week;
  loadAll();
}

function findMeal(slug, day, slot) {
  return vs.meals[slug].find(m => m.day === day && m.slot === slot) || null;
}

async function openPicker(slug, day, slot) {
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
      await setWeekMeal({ weekId, day, slot, mealId: meal.id });
      await loadAll();
    },
  });
}

async function clearSlot(slug, day, slot) {
  const week = vs.weeks[slug];
  if (!week) return;
  await removeWeekMeal({ weekId: week.id, day, slot });
  await loadAll();
}

// Aggregate kcal per dag voor sparkline (alleen voor de gekozen persoon)
function dayKcalArray(slug) {
  const weekMealsArr = vs.meals[slug] || [];
  const totals = [0,0,0,0,0,0,0];
  for (const wm of weekMealsArr) {
    if (wm.meal?.kcal) totals[wm.day - 1] += wm.meal.kcal;
  }
  return totals;
}

function totalKcal(slug) {
  return (vs.meals[slug] || []).reduce((s, wm) => s + (wm.meal?.kcal || 0), 0);
}

function filledCount(slug) {
  return (vs.meals[slug] || []).length;
}

export function WeekView(state) {
  ensureInit();
  const today = todayInfo();
  const dates = weekDates(vs.year, vs.week);
  const persoon = state.persoon;
  const isCurrentWeek = today.year === vs.year && today.week === vs.week;

  const focusedSlug = persoon === 'beiden' ? 'peter' : persoon;
  const sparkData = dayKcalArray(focusedSlug);
  const total = totalKcal(focusedSlug);
  const avg = total > 0 ? Math.round(total / 7) : 0;
  const filled = persoon === 'beiden'
    ? filledCount('peter') + filledCount('miranda')
    : filledCount(persoon);
  const totalSlots = persoon === 'beiden' ? 84 : 42;

  return html`
    <section class="view-wrap weekview">
      ${renderHero(persoon, isCurrentWeek, dates, sparkData, avg, filled, totalSlots)}

      <div class="grid-head">
        <h2 class="display">De week in één oogopslag</h2>
        <div class="week-nav">
          <button class="chip" @click=${() => changeWeek(-1)}>← Week ${vs.week - 1 || 52}</button>
          <button class="chip is-on" @click=${() => { const t = todayInfo(); vs.year=t.year; vs.week=t.week; loadAll(); }}>
            Week ${vs.week}
          </button>
          <button class="chip" @click=${() => changeWeek(1)}>Week ${vs.week + 1 > 52 ? 1 : vs.week + 1} →</button>
        </div>
      </div>

      ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}

      <div class="week-grid">
        ${[1,2,3,4,5,6,7].map(day => renderDayColumn(day, dates[day - 1], today, isCurrentWeek, persoon))}
      </div>
    </section>

    <style>
      .weekview { display: flex; flex-direction: column; gap: 24px; }

      .hero {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 20px;
      }
      .hero-main {
        background: var(--ink);
        color: var(--bg);
        border-radius: var(--r-lg);
        padding: 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 220px;
        border: 1px solid var(--ink);
      }
      .hero-main .cmt { color: var(--bg); opacity: 0.6; }
      .hero-main .display {
        font-size: clamp(38px, 5vw, 64px);
        margin-top: 8px;
        line-height: 0.95;
      }
      .hero-main .lead { margin-top: 14px; opacity: 0.75; max-width: 460px; font-size: 14px; line-height: 1.5; }
      .hero-main .chip-row { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
      .hero-main .chip {
        background: transparent;
        border-color: oklch(40% 0.02 60);
        color: var(--bg);
      }

      .hero-side { display: grid; grid-template-rows: 1fr 1fr; gap: 14px; }
      .stat-card {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .stat-card .display { font-size: 48px; margin-top: 6px; line-height: 0.95; }
      .stat-card .lead { font-size: 12px; color: var(--ink-3); margin-top: 2px; }

      .grid-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }
      .grid-head h2 { font-size: 28px; margin: 0; }
      .week-nav { display: flex; gap: 6px; }
      .week-nav .chip { height: 32px; cursor: pointer; }
      .week-nav .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); }

      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }

      .week-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 12px;
        background: var(--bg-2);
        padding: 12px;
        border-radius: var(--r-lg);
        border: 1px solid var(--line);
      }
      .day-col {
        background: var(--bg);
        color: var(--ink);
        border-radius: var(--r-md);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid var(--line);
      }
      .day-col .slots {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .day-col.today { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      .day-col.today .cmt { color: var(--bg); opacity: 0.7; }
      .day-col.today .day-head .display { color: var(--bg); }
      .day-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }
      .day-head .display { font-size: 18px; }
      .slot-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .slot-add {
        height: 56px;
        border: 1px dashed var(--line-2);
        border-radius: var(--r-sm);
        color: var(--ink-3);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        cursor: pointer;
      }
      .day-col.today .slot-add {
        border-color: oklch(40% 0.02 60);
        color: oklch(70% 0.02 60);
      }
      .slot-add:hover { color: var(--ink); border-color: var(--ink); background: var(--bg-2); }
      .day-col.today .slot-add:hover { background: oklch(28% 0.02 60); border-color: var(--bg); color: var(--bg); }

      .ph-row {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px;
      }
      .ph-row .person-tag {
        display: inline-block;
        width: 14px; height: 14px;
        border-radius: 50%;
        font-size: 9px; line-height: 14px;
        text-align: center; color: white; font-weight: 700;
      }
      .ph-row .person-tag.peter { background: var(--peter); }
      .ph-row .person-tag.miranda { background: var(--miranda); }

      .meal-mini {
        background: var(--bg-2);
        border-radius: var(--r-sm);
        padding: 6px 8px;
        cursor: pointer;
        display: flex; flex-direction: column; gap: 3px;
        position: relative;
        font-size: 11px;
        line-height: 1.2;
        border: 1px solid var(--line);
      }
      .day-col.today .meal-mini { background: oklch(28% 0.02 60); color: var(--bg); border-color: oklch(35% 0.02 60); }
      .day-col.today .meal-mini .cmt { color: var(--bg); opacity: 0.6; }
      .meal-mini:hover { transform: translateY(-1px); }
      .meal-mini .name { font-weight: 600; }
      .meal-mini .x {
        position: absolute; top: 2px; right: 4px;
        font-size: 11px; opacity: 0; cursor: pointer;
        background: transparent; border: none;
        color: inherit;
      }
      .meal-mini:hover .x { opacity: 0.7; }
      .meal-mini .x:hover { opacity: 1; }

      .empty-week {
        padding: 32px;
        text-align: center;
        background: var(--bg);
        border: 1px dashed var(--line-2);
        border-radius: var(--r-lg);
        display: flex; flex-direction: column; gap: 12px; align-items: center;
      }

      @media (max-width: 960px) {
        .hero { grid-template-columns: 1fr; }
        .hero-side { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
      }
      @media (max-width: 720px) {
        .week-grid { grid-template-columns: 1fr; gap: 8px; }
        .day-col { display: grid; grid-template-columns: 70px 1fr; gap: 10px; align-items: start; }
        .day-col .day-head { flex-direction: column; align-items: flex-start; gap: 0; margin: 0; }
        .day-col .slots { display: flex; flex-direction: column; gap: 8px; grid-column: 2; }
        .day-head { grid-column: 1; }
      }
    </style>
  `;
}

function renderHero(persoon, isCurrentWeek, dates, sparkData, avg, filled, totalSlots) {
  const dateRange = `${formatDate(dates[0])} – ${formatDate(dates[6])} ${dates[6].getUTCFullYear()}`;
  const heroTitle = isCurrentWeek ? `Week ${vs.week}` : `Week ${vs.week}`;
  const persoonLabel = persoon === 'beiden' ? 'voor het hele huishouden' : `voor ${persoon[0].toUpperCase()}${persoon.slice(1)}`;

  return html`
    <div class="hero">
      <div class="hero-main">
        <div class="cmt">// weekmenu · ${dateRange}</div>
        <div>
          <div class="display">${heroTitle}.</div>
          <div class="lead">
            ${filled} van de ${totalSlots} maaltijden gepland · ${persoonLabel}
            ${avg > 0 ? html` · gem. ${avg.toLocaleString('nl-NL')} kcal/dag` : ''}
          </div>
        </div>
        <div class="chip-row">
          ${isCurrentWeek ? html`<span class="chip">● huidige week</span>` : ''}
          <span class="chip">${persoon === 'beiden' ? '👥 beiden' : (persoon === 'peter' ? '🟦 Peter' : '🟪 Miranda')}</span>
        </div>
      </div>

      <div class="hero-side">
        <div class="stat-card">
          <div>
            <div class="cmt">// gem. kcal/dag</div>
            <div class="display">${avg ? avg.toLocaleString('nl-NL') : '—'}</div>
            <div class="lead">${persoon === 'beiden' ? "Peter's totaal" : 'over zeven dagen'}</div>
          </div>
          ${sparkData.some(v => v > 0) ? Sparkline({
            data: sparkData,
            labels: DAGEN_KORT,
            highlightIndex: isCurrentWeek ? todayInfo().day - 1 : -1,
            width: 180,
            height: 60,
          }) : ''}
        </div>
        <div class="stat-card">
          <div>
            <div class="cmt">// boodschappen</div>
            <div class="display" style="font-size: 32px;">→</div>
            <div class="lead">genereer lijst voor week ${vs.week}</div>
          </div>
          <button class="btn tomato" @click=${() => setRoute('lijst')}>Lijst openen →</button>
        </div>
      </div>
    </div>
  `;
}

// Hoofdmaaltijden altijd tonen; snacks alleen als ze in deze week voor minstens één persoon gevuld zijn.
const ALWAYS_VISIBLE = new Set(['ontbijt', 'lunch', 'diner']);

function visibleSlots(persoon) {
  const owners = persoon === 'beiden' ? ['peter', 'miranda'] : [persoon];
  return SLOTS.filter(slot => {
    if (ALWAYS_VISIBLE.has(slot.id)) return true;
    for (const slug of owners) {
      if (vs.meals[slug]?.some(wm => wm.slot === slot.id)) return true;
    }
    return false;
  });
}

function renderDayColumn(day, date, today, isCurrentWeek, persoon) {
  const isToday = isCurrentWeek && day === today.day;
  const slots = visibleSlots(persoon);
  return html`
    <div class="day-col ${isToday ? 'today' : ''}">
      <div class="day-head">
        <div class="display">${DAGEN[day - 1]}</div>
        <div class="cmt">${date.getUTCDate()}/${date.getUTCMonth() + 1}</div>
      </div>
      <div class="slots">
        ${slots.map(slot => renderSlotCell(day, slot, persoon))}
      </div>
    </div>
  `;
}

function renderSlotCell(day, slot, persoon) {
  // Persoon-tag tonen alleen in 'beiden'-modus, want bij 'peter' of 'miranda' weet je al wie het is.
  const showPerson = persoon === 'beiden';

  if (persoon === 'beiden') {
    const p = findMeal('peter', day, slot.id);
    const m = findMeal('miranda', day, slot.id);
    if (!p && !m) {
      return html`<button class="slot-add" @click=${() => openPicker('peter', day, slot.id)}>+</button>`;
    }
    return html`
      <div class="slot-cell">
        ${p ? renderMiniCard('peter', p, day, slot.id, true) : ''}
        ${m ? renderMiniCard('miranda', m, day, slot.id, true) : ''}
      </div>
    `;
  }

  const wm = findMeal(persoon, day, slot.id);
  if (!wm) {
    return html`<button class="slot-add" @click=${() => openPicker(persoon, day, slot.id)}>+</button>`;
  }
  return renderMiniCard(persoon, wm, day, slot.id, false);
}

function renderMiniCard(slug, wm, day, slot, showPerson = false) {
  return html`
    <div class="meal-mini" @click=${() => openPicker(slug, day, slot)}>
      <div class="ph-row">
        ${SlotIcon({ slot, size: 14 })}
        ${showPerson ? html`<span class="person-tag ${slug}">${slug === 'peter' ? 'P' : 'M'}</span>` : ''}
      </div>
      <span class="name">${wm.meal.name}</span>
      ${wm.meal.kcal ? html`<span class="cmt">${wm.meal.kcal}k</span>` : ''}
      <button class="x" title="verwijder" @click=${(e) => { e.stopPropagation(); clearSlot(slug, day, slot); }}>×</button>
    </div>
  `;
}
