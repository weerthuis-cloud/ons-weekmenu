// Detail-modal voor een gevulde meal-cell.
// Voor diner: toont recept (markdown-light). Voor andere slots: ingrediëntenlijst.
// Knoppen: vervang (opent meal-picker), verwijder (clearSlot), sluit.

import { html, render, nothing } from 'lit-html';
import { SLOT_BY_ID } from '../lib/slots.js';
import { SlotIcon } from './slot-icon.js';
import { formatQty } from '../lib/units.js';

const HOST_ID = '__meal_detail_host';

const ui = {
  open: false,
  slot: null,
  wm: null,            // de week_meal-row inclusief meal-data
  onReplace: null,
  onClear: null,
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

function close() {
  ui.open = false;
  ui.wm = null;
  ui.onReplace = null;
  ui.onClear = null;
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

export function openMealDetail({ slot, wm, onReplace, onClear }) {
  ui.open = true;
  ui.slot = slot;
  ui.wm = wm;
  ui.onReplace = onReplace;
  ui.onClear = onClear;
  rerender();
}

// Lichte markdown→HTML: **bold**, *italic*, lijsten, paragraaf-breaks
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
          ${isDiner && meal.recipe
            ? html`<div class="md-recipe">${renderRecipe(meal.recipe)}</div>`
            : ingredients.length
              ? html`
                <div class="cmt">// ingrediënten</div>
                <ul class="md-ing-list">
                  ${ingredients.map(ing => html`
                    <li>
                      <span class="ing-name">${ing.name}</span>
                      <span class="ing-qty mono">${formatQty(ing.qty, ing.unit)}</span>
                    </li>
                  `)}
                </ul>
              `
              : html`<p class="cmt">Geen ingrediënten of recept opgegeven.</p>`}

          ${isDiner && !meal.recipe ? html`
            <div class="md-norecipe">
              <span class="cmt">// geen recept</span>
              <p>Voor dit gerecht is nog geen recept opgeslagen. Voeg het toe via Maker → bewerken.</p>
            </div>
          ` : nothing}
        </div>

        <footer class="md-foot">
          <button class="btn ghost danger" @click=${doClear}>verwijder</button>
          <span style="flex:1"></span>
          <button class="btn ghost" @click=${doReplace}>vervang</button>
          <button class="btn" @click=${close}>klaar</button>
        </footer>
      </div>

      <style>
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
        }
        .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
        .btn.ghost.danger:hover { background: var(--tomato-tint); }
      </style>
    </div>
  `;
}
