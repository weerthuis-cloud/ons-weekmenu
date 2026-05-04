// Detail-modal voor een gevulde meal-cell.
// Voor diner: toont recept (markdown-light). Voor andere slots: ingrediëntenlijst.
// Knoppen: vervang (opent meal-picker), verwijder (clearSlot), sluit.

import { html, render, nothing } from 'lit-html';
import { SLOT_BY_ID } from '../lib/slots.js';
import { SlotIcon } from './slot-icon.js';
import { formatQty } from '../lib/units.js';
import { DAGEN_KORT } from '../lib/datums.js';
import { setWeekMealsPorties } from '../lib/data.js';
import { scaleRecipeIngredients } from '../lib/shopping.js';

const HOST_ID = '__meal_detail_host';

const ui = {
  open: false,
  slot: null,
  wm: null,            // de week_meal-row inclusief meal-data
  onReplace: null,
  onClear: null,
  onMove: null,         // (toDay) → Promise
  onSwap: null,         // (otherDay) → Promise
  // sub-mode binnen modal: 'detail' (default) | 'move' | 'swap'
  mode: 'detail',
  // alle bestaande week_meals voor zelfde slug+slot, voor "ruil met" UI
  siblings: [],
  // v1.9b: gekozen porties voor recipe-meals (chips in modal)
  porties: 2,
  savingPorties: false,
};

async function setPortiesFromModal(n) {
  if (!ui.wm) return;
  ui.porties = n;
  ui.savingPorties = true;
  rerender();
  try {
    await setWeekMealsPorties({
      ids: [ui.wm.id],
      weekIds: ui.wm.week_id ? [ui.wm.week_id] : [],
      porties: n,
    });
    // Update lokale wm zodat re-render correct is
    ui.wm = { ...ui.wm, porties: n };
  } catch (err) {
    alert('Opslaan mislukt: ' + err.message);
  } finally {
    ui.savingPorties = false;
    rerender();
  }
}

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

function close() {
  ui.open = false;
  ui.wm = null;
  ui.onReplace = null;
  ui.onClear = null;
  ui.onMove = null;
  ui.onSwap = null;
  ui.mode = 'detail';
  ui.siblings = [];
  rerender();
}

function rerender() {
  render(view(), ensureHost());
}

function doReplace() {
  const cb = ui.onReplace;
  close();
  if (cb) cb();
}

function doClear() {
  const cb = ui.onClear;
  if (!confirm(`"${ui.wm?.meal?.name ?? 'deze maaltijd'}" verwijderen uit dit slot?`)) return;
  close();
  if (cb) cb();
}

async function doMove(toDay) {
  const cb = ui.onMove;
  close();
  if (cb) await cb(toDay);
}

async function doSwap(otherDay) {
  const cb = ui.onSwap;
  close();
  if (cb) await cb(otherDay);
}

function setMode(mode) {
  ui.mode = mode;
  rerender();
}

export function openMealDetail({ slot, wm, onReplace, onClear, onMove, onSwap, siblings = [] }) {
  ui.open = true;
  ui.slot = slot;
  ui.wm = wm;
  ui.onReplace = onReplace;
  ui.onClear = onClear;
  ui.onMove = onMove;
  ui.onSwap = onSwap;
  ui.siblings = siblings;
  ui.mode = 'detail';
  ui.porties = Number(wm?.porties ?? (slot === 'diner' ? 2 : 1));
  ui.savingPorties = false;
  rerender();
}

// v1.9b: porties-chips + geschaalde ingrediëntenlijst voor diner-recepten
function renderPortionsAndScaledIngredients(meal) {
  const cur = ui.porties;
  const scaled = scaleRecipeIngredients(meal, cur);
  return html`
    <div class="md-portions">
      <div class="cmt">// ingrediënten voor</div>
      <div class="md-portions-chips">
        ${[1, 2, 3, 4].map(n => html`
          <button
            class="md-portion-chip ${cur === n ? 'is-on' : ''}"
            ?disabled=${ui.savingPorties}
            @click=${() => setPortiesFromModal(n)}
          >${n} ${n === 1 ? 'eter' : 'eters'}</button>
        `)}
      </div>
      <ul class="md-ing-list">
        ${scaled.map(ing => html`
          <li>
            <span class="ing-name">${ing.name}</span>
            <span class="ing-qty mono">${ing.qtyBase != null ? formatQty(ing.qtyBase, ing.unitBase) : ''}</span>
          </li>
        `)}
      </ul>
    </div>
  `;
}

// Lichte markdown→HTML: **bold**, *italic*, lijsten, paragraaf-breaks
// Helper: krijg een sibling voor een specifieke dag (uit ui.siblings)
function siblingForDay(day) {
  return ui.siblings.find(s => s.day === day);
}

function currentDay() {
  return ui.wm?.day;
}

function renderMovePanel() {
  return html`
    <div class="md-mode-head">
      <div class="cmt">// verplaats naar...</div>
      <p class="lead">Kies de dag waar deze maaltijd heen moet. Een maaltijd op dezelfde plek wordt overschreven.</p>
    </div>
    <div class="md-day-grid">
      ${[1,2,3,4,5,6,7].map(d => {
        const sib = siblingForDay(d);
        const isCurrent = d === currentDay();
        return html`
          <button
            class="md-day-btn ${isCurrent ? 'is-current' : ''} ${!sib && !isCurrent ? 'is-empty' : ''}"
            ?disabled=${isCurrent}
            @click=${() => doMove(d)}
            title=${sib ? sib.meal?.name ?? '' : 'leeg'}
          >
            <span class="md-day-name">${DAGEN_KORT[d - 1]}</span>
            <span class="md-day-status">${isCurrent ? 'huidige' : (sib ? (sib.meal?.name ?? '...').slice(0, 14) + (sib.meal?.name?.length > 14 ? '…' : '') : 'leeg')}</span>
          </button>
        `;
      })}
    </div>
  `;
}

function renderSwapPanel() {
  const validDays = [1,2,3,4,5,6,7].filter(d => d !== currentDay() && siblingForDay(d));
  return html`
    <div class="md-mode-head">
      <div class="cmt">// ruil met...</div>
      <p class="lead">${validDays.length === 0
        ? 'Geen andere dag in deze week heeft een maaltijd in dit slot. Niets om mee te ruilen.'
        : 'Kies een dag. De twee maaltijden wisselen plaats.'}</p>
    </div>
    <div class="md-day-grid">
      ${[1,2,3,4,5,6,7].map(d => {
        const sib = siblingForDay(d);
        const isCurrent = d === currentDay();
        const canSwap = !isCurrent && !!sib;
        return html`
          <button
            class="md-day-btn ${isCurrent ? 'is-current' : ''} ${!sib ? 'is-empty' : ''}"
            ?disabled=${!canSwap}
            @click=${() => canSwap && doSwap(d)}
            title=${sib ? sib.meal?.name ?? '' : 'leeg'}
          >
            <span class="md-day-name">${DAGEN_KORT[d - 1]}</span>
            <span class="md-day-status">${isCurrent ? 'huidige' : (sib ? (sib.meal?.name ?? '...').slice(0, 14) + (sib.meal?.name?.length > 14 ? '…' : '') : '—')}</span>
          </button>
        `;
      })}
    </div>
  `;
}

function renderRecipe(text) {
  if (!text) return null;
  // Splits per regel, render per regel met mini-formatting
  const lines = text.split('\n');
  const out = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(html`<ul>${listBuf.map(li => html`<li>${formatInline(li)}</li>`)}</ul>`);
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushList(); continue; }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      listBuf.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      // genummerde stap → toon zoals het is, met nummer in mono
      flushList();
      const m = line.match(/^(\d+)\.\s+(.*)$/);
      out.push(html`<p class="step"><span class="step-no mono">${m[1]}.</span>${formatInline(m[2])}</p>`);
    } else {
      flushList();
      out.push(html`<p>${formatInline(line)}</p>`);
    }
  }
  flushList();
  return out;
}

function formatInline(text) {
  // Vervang **bold** en *italic* door spans
  const parts = [];
  let rest = text;
  while (rest.length) {
    const boldMatch = rest.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/s);
    const italicMatch = rest.match(/^(.*?)\*([^*]+)\*(.*)$/s);
    const m = boldMatch && (!italicMatch || boldMatch[1].length <= italicMatch[1].length) ? boldMatch : italicMatch;
    if (!m) { parts.push(rest); break; }
    if (m[1]) parts.push(m[1]);
    parts.push(m === boldMatch
      ? html`<strong>${m[2]}</strong>`
      : html`<em>${m[2]}</em>`);
    rest = m[3];
  }
  return parts;
}

function view() {
  if (!ui.open || !ui.wm) return null;
  const slotInfo = SLOT_BY_ID[ui.slot];
  const meal = ui.wm.meal || {};
  const isDiner = ui.slot === 'diner';
  const ingredients = meal.ingredients || [];
  const hasRecipe = !!meal.recipe;
  // v1.5c: ingrediënten van recipe-meals (serves > 0) verbergen — die staan
  // al in het recepten-paneel + boodschappenlijst, dubbele weergave is verwarrend.
  const isRecipeMeal = Number(meal.serves) > 0;
  const hasIngredients = ingredients.length > 0 && !isRecipeMeal;

  return html`
    <div class="md-backdrop" @click=${close}>
      <div class="md-modal" @click=${(e) => e.stopPropagation()}>
        <header class="md-head">
          <div class="md-title">
            <span class="md-icon">${SlotIcon({ slot: ui.slot, size: 22 })}</span>
            <div>
              <p class="lead">${slotInfo?.label ?? ''}</p>
              <h3 class="display">${meal.name ?? '—'}</h3>
            </div>
          </div>
          <button class="btn ghost small" @click=${close}>sluit</button>
        </header>

        <div class="md-body">
          ${isDiner && isRecipeMeal && ingredients.length > 0 ? renderPortionsAndScaledIngredients(meal) : nothing}

          ${hasIngredients ? html`
            <div class="cmt">// ingrediënten</div>
            <ul class="md-ing-list">
              ${ingredients.map(ing => html`
                <li>
                  <span class="ing-name">${ing.name}</span>
                  <span class="ing-qty mono">${formatQty(ing.qty, ing.unit)}</span>
                </li>
              `)}
            </ul>
          ` : nothing}

          ${hasRecipe ? html`
            <div class="cmt">// ${isDiner ? 'recept' : 'tips'}</div>
            <div class="md-recipe">${renderRecipe(meal.recipe)}</div>
          ` : nothing}

          ${!hasRecipe && !hasIngredients ? html`
            <p class="cmt">Geen ingrediënten of recept opgegeven.</p>
          ` : nothing}

          ${isDiner && !hasRecipe ? html`
            <div class="md-norecipe">
              <span class="cmt">// geen recept</span>
              <p>Voor dit gerecht is nog geen recept opgeslagen. Voeg het toe via Maker → bewerken.</p>
            </div>
          ` : nothing}
        </div>

        <footer class="md-foot">
          ${ui.mode === 'detail' ? html`
            <button class="btn ghost danger" @click=${doClear}>verwijder</button>
            <span style="flex:1"></span>
            ${ui.onMove ? html`<button class="btn ghost" @click=${() => setMode('move')}>verplaats</button>` : ''}
            ${ui.onSwap ? html`<button class="btn ghost" @click=${() => setMode('swap')}>ruil</button>` : ''}
            <button class="btn ghost" @click=${doReplace}>vervang</button>
            <button class="btn" @click=${close}>klaar</button>
          ` : html`
            <button class="btn ghost" @click=${() => setMode('detail')}>← terug</button>
          `}
        </footer>

        ${ui.mode === 'move' ? renderMovePanel() : nothing}
        ${ui.mode === 'swap' ? renderSwapPanel() : nothing}
      </div>

      <style>
        .md-day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding: 14px 22px; }
        .md-day-btn {
          background: var(--bg-2);
          border: 1px solid var(--line);
          border-radius: var(--r-sm);
          padding: 10px 6px;
          font: inherit;
          cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          color: var(--ink);
        }
        .md-day-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
        .md-day-btn.is-current { background: var(--mustard-tint); border-color: oklch(80% 0.08 85); cursor: default; }
        .md-day-btn.is-current:hover { transform: none; }
        .md-day-btn.is-empty .md-day-status { color: var(--ink-3); font-style: italic; }
        .md-day-btn .md-day-name { font-weight: 700; font-size: 12px; }
        .md-day-btn .md-day-status { font-size: 10px; color: var(--ink-2); text-align: center; line-height: 1.2; max-height: 30px; overflow: hidden; }
        .md-mode-head { padding: 14px 22px 0; }
        .md-mode-head .lead { color: var(--ink-2); font-size: 13px; }
        .md-backdrop {
          position: fixed; inset: 0;
          background: oklch(18% 0.02 60 / 0.55);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .md-modal {
          background: var(--bg);
          border-radius: var(--r-lg);
          width: 100%; max-width: 600px; max-height: 92vh;
          display: flex; flex-direction: column;
          box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3);
        }
        .md-head {
          padding: 22px 22px 14px;
          border-bottom: 1px solid var(--line);
          display: flex; gap: 12px; align-items: flex-start; justify-content: space-between;
        }
        .md-title { display: flex; gap: 12px; align-items: flex-start; }
        .md-icon { color: var(--ink); margin-top: 4px; }
        .md-head h3 { font-size: 22px; line-height: 1.15; }
        .md-head .lead { font-size: 12px; color: var(--ink-3); margin: 0 0 4px; }

        .md-body {
          padding: 18px 22px;
          overflow-y: auto;
          flex: 1;
          display: flex; flex-direction: column; gap: 14px;
        }

        .md-portions { display: flex; flex-direction: column; gap: 8px; }
        .md-portions-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .md-portion-chip {
          font-family: var(--mono); font-size: 12px;
          padding: 6px 12px;
          border: 1px solid var(--line);
          background: var(--bg);
          color: var(--ink-2);
          border-radius: 999px;
          cursor: pointer;
        }
        .md-portion-chip:hover:not(:disabled) { border-color: var(--ink); }
        .md-portion-chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); font-weight: 700; }
        .md-portion-chip:disabled { opacity: 0.5; cursor: wait; }

        .md-ing-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .md-ing-list li {
          display: flex; align-items: baseline; justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px dashed var(--line);
          gap: 12px;
        }
        .ing-name { font-size: 14px; }
        .ing-qty { font-size: 12px; color: var(--ink-3); }

        .md-recipe { display: flex; flex-direction: column; gap: 8px; line-height: 1.55; font-size: 14px; }
        .md-recipe p { margin: 0; }
        .md-recipe p.step { display: flex; gap: 8px; }
        .md-recipe .step-no { font-weight: 700; color: var(--ink-3); flex-shrink: 0; }
        .md-recipe ul { margin: 4px 0 8px; padding-left: 22px; }
        .md-recipe ul li { margin: 2px 0; }
        .md-recipe strong { color: var(--ink); }
        .md-recipe em { color: var(--ink-2); }

        .md-norecipe {
          background: var(--mustard-tint);
          border: 1px solid oklch(85% 0.08 85);
          border-radius: var(--r-md);
          padding: 12px 14px;
        }
        .md-norecipe p { margin: 4px 0 0; font-size: 13px; color: oklch(35% 0.10 85); }

        .md-foot {
          padding: 14px 22px 18px;
          border-top: 1px solid var(--line);
          display: flex; gap: 8px; align-items: center;
          flex-wrap: wrap;
        }
        .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
        .btn.ghost.danger:hover { background: var(--tomato-tint); }
        @media (max-width: 720px) {
          .md-foot {
            padding: 12px 14px 14px;
            gap: 6px;
            justify-content: flex-end;
          }
          .md-foot .btn { font-size: 12px; padding: 0 10px; height: 32px; }
          /* Spacer (flex:1) laten verdwijnen zodat alle knoppen bij elkaar wrappen */
          .md-foot > span { display: none; }
        }
      </style>
    </div>
  `;
}
