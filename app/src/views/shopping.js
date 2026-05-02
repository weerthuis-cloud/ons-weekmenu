// Boodschappenlijst v0.6: prototype-stijl met 4-kolom hero + filter-chips + winkel-cards.
import { html, nothing } from 'lit-html';
import { todayInfo, formatWeekRange } from '../lib/datums.js';
import { listProfiles, getWeek, getWeekMeals,
         getShoppingList, createShoppingList, updateShoppingList, deleteShoppingList,
         listOpenNotes, addNote, dismissNote, markNoteAdded,
         onDataChange } from '../lib/data.js';
import { classifyIngredient } from '../lib/categorie.js';
import { aggregateShopping, groupByCategory, groupByStore, itemKey } from '../lib/shopping.js';
import { formatQty } from '../lib/units.js';
import { winkelLabel, WINKELS } from '../lib/winkels.js';
import { Checkbox } from '../components/checkbox.js';
import { rerender, state as appState, actions as appActions } from '../main.js';

const STORE_HUE = {
  '': 80, ah: 240, jumbo: 130, plus: 28, lidl: 200, aldi: 200, markt: 145, biologisch: 145, anders: 80,
};

const vs = {
  year: null,
  week: null,
  modus: 'huishouden',  // 'huishouden' | 'peter' | 'miranda'
  storeFilter: 'all',
  loading: false,
  error: null,
  profiles: null,
  weeks: { peter: null, miranda: null },
  meals: { peter: [], miranda: [] },
  list: null,
  items: [],
  initialized: false,
  editingKey: null,     // itemKey van item dat momenteel in qty-edit mode staat
  // Notities
  notes: [],
  noteInput: '',
  notesOpen: true,
};

function ensureInit() {
  if (vs.initialized) return;
  const t = todayInfo();
  vs.year = t.year;
  vs.week = t.week;
  vs.initialized = true;
  onDataChange((scope) => {
    if (scope === 'shopping_lists' || scope === 'meals' || scope === 'week_meals' || scope === 'weeks') loadAll();
    if (scope === 'shopping_notes') loadNotes();
  });
  queueMicrotask(loadAll);
  queueMicrotask(loadNotes);
  appActions.setViewWeek(vs.year, vs.week);
}

async function loadNotes() {
  try { vs.notes = await listOpenNotes(); rerender(); }
  catch (err) { vs.error = err.message; rerender(); }
}

async function submitNote(e) {
  e?.preventDefault?.();
  const txt = vs.noteInput.trim();
  if (!txt) return;
  try {
    await addNote({ ownerId: appState.auth.profile.id, name: txt });
    vs.noteInput = '';
    await loadNotes();
  } catch (err) { vs.error = err.message; rerender(); }
}

async function noteToList(note) {
  // Voeg note toe als nieuw item in de huidige shopping_list (of maak aan).
  const newItem = {
    name: note.name,
    qty: note.qty,
    unit: note.unit || '',
    store: '',
    category: classifyIngredient(note.name.toLowerCase()),
    who: [],
    partial: false,
    variants: [note.name],
    sources: [{ noteId: note.id, addedBy: 'manual' }],
    checked: false,
    manual: true,
  };
  const weekIds = activeWeekIds();
  if (vs.list) {
    const next = [...vs.items, newItem];
    vs.list = await updateShoppingList({ id: vs.list.id, items: next });
    vs.items = vs.list.items;
  } else if (weekIds.length > 0) {
    vs.list = await createShoppingList({
      ownerId: appState.auth.profile.id, weekIds, items: [newItem],
    });
    vs.items = vs.list.items;
  } else {
    vs.error = 'Maak eerst een lijst aan (Genereer) voor je notities kunt toevoegen.';
    rerender();
    return;
  }
  await markNoteAdded(note.id, vs.list.id);
  await loadNotes();
}

async function noteDismiss(note) {
  await dismissNote(note.id);
  await loadNotes();
}

function toggleNotesPanel() {
  vs.notesOpen = !vs.notesOpen;
  rerender();
}

async function loadWeeksAndMeals() {
  if (!vs.profiles) vs.profiles = await listProfiles();
  for (const slug of ['peter', 'miranda']) {
    const profile = vs.profiles[slug];
    if (!profile) { vs.weeks[slug] = null; vs.meals[slug] = []; continue; }
    const week = await getWeek(profile.id, vs.year, vs.week);
    vs.weeks[slug] = week;
    vs.meals[slug] = week ? await getWeekMeals(week.id) : [];
  }
}

function activeWeekIds() {
  const owners = vs.modus === 'huishouden' ? ['peter','miranda'] : [vs.modus];
  return owners.map(s => vs.weeks[s]?.id).filter(Boolean);
}

async function loadAll() {
  vs.loading = true; vs.error = null; rerender();
  try {
    await loadWeeksAndMeals();
    const weekIds = activeWeekIds();
    if (weekIds.length === 0) { vs.list = null; vs.items = []; }
    else {
      vs.list = await getShoppingList({ ownerId: appState.auth.profile.id, weekIds });
      vs.items = vs.list?.items || [];
      // Geen lijst voor deze selectie? Auto-genereer.
      if (!vs.list) {
        vs.loading = false;
        await generateOrRefresh();
        return;
      }
    }
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.loading = false;
    rerender();
  }
}

async function generateOrRefresh() {
  vs.loading = true; vs.error = null; rerender();
  try {
    const weekIds = activeWeekIds();
    if (weekIds.length === 0) {
      vs.error = 'Geen week aanwezig voor deze selectie. Maak eerst een week aan via de Week-tab.';
      vs.loading = false; rerender(); return;
    }
    const aggregated = aggregateShopping(vs.meals, vs.modus);
    const oldByKey = new Map((vs.list?.items || []).map(it => [itemKey(it), it]));
    const items = aggregated.map(it => ({ ...it, checked: oldByKey.get(itemKey(it))?.checked ?? false }));
    if (vs.list) vs.list = await updateShoppingList({ id: vs.list.id, items });
    else vs.list = await createShoppingList({ ownerId: appState.auth.profile.id, weekIds, items });
    vs.items = vs.list.items;
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.loading = false;
    rerender();
  }
}

async function toggleChecked(idx) {
  const next = vs.items.map((x, i) => i === idx ? { ...x, checked: !x.checked } : x);
  vs.items = next;
  rerender();
  try { vs.list = await updateShoppingList({ id: vs.list.id, items: next }); }
  catch (err) { vs.error = err.message; rerender(); }
}

function startEditQty(key) {
  vs.editingKey = key;
  rerender();
  // Focus de input na de re-render
  queueMicrotask(() => {
    const el = document.querySelector('input.qty-edit-input');
    if (el) { el.focus(); el.select(); }
  });
}

async function commitEditQty(idx, rawValue) {
  vs.editingKey = null;
  const trimmed = (rawValue || '').trim();
  let newQty = null;
  if (trimmed !== '') {
    const n = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) newQty = n;
  }
  const next = vs.items.map((x, i) => i === idx ? { ...x, qty: newQty } : x);
  vs.items = next;
  rerender();
  try { vs.list = await updateShoppingList({ id: vs.list.id, items: next }); }
  catch (err) { vs.error = err.message; rerender(); }
}

function cancelEditQty() {
  vs.editingKey = null;
  rerender();
}

async function clearAllChecks() {
  if (!vs.list) return;
  const next = vs.items.map(it => ({ ...it, checked: false }));
  vs.items = next; rerender();
  vs.list = await updateShoppingList({ id: vs.list.id, items: next });
}

async function deleteList() {
  if (!vs.list) return;
  if (!confirm('Lijst verwijderen? Dit wist alle vinkjes.')) return;
  await deleteShoppingList(vs.list.id);
  vs.list = null; vs.items = []; rerender();
}

function setModus(modus) { vs.modus = modus; loadAll(); }
function setStoreFilter(s) { vs.storeFilter = s; rerender(); }
function changeWeek(delta) {
  vs.week += delta;
  if (vs.week < 1) { vs.week = 52; vs.year -= 1; }
  else if (vs.week > 52) { vs.week = 1; vs.year += 1; }
  appActions.setViewWeek(vs.year, vs.week);
  loadAll();
}

export function ShoppingView(state) {
  ensureInit();

  const all = vs.items;
  const filteredItems = vs.storeFilter === 'all'
    ? all
    : all.filter(it => it.store === vs.storeFilter);
  // Primaire groepering: categorie (groente/zuivel/brood/etc.)
  const groups = groupByCategory(filteredItems);

  const totalCount = all.length;
  const checkedCount = all.filter(i => i.checked).length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const usedStores = Array.from(new Set(all.map(i => i.store)));
  const weekIdsCount = activeWeekIds().length;

  return html`
    <section class="view-wrap shopview">
      ${renderNotesPanel()}

      <div class="hero-row">
        <div class="hero-card hero-dark hero-totaal">
          <div class="cmt">// totaal</div>
          <div class="display">${totalCount}</div>
          <div class="lead">items voor week ${vs.week}</div>
        </div>
        <div class="hero-card hero-checked">
          <div class="cmt">// afgevinkt</div>
          <div class="display">${checkedCount}<span class="frac">/${totalCount}</span></div>
          <div class="bar"><div style="width:${progressPct}%;"></div></div>
        </div>
        <div class="hero-card hero-soft hero-modus">
          <div class="cmt">// modus</div>
          <div class="display modus-display">${vs.modus === 'huishouden' ? 'Huishouden' : (vs.modus[0].toUpperCase() + vs.modus.slice(1))}</div>
          <div class="lead">${formatWeekRange(vs.year, vs.week)}</div>
        </div>
        <div class="hero-card actions-card hero-acties">
          <div class="cmt">// acties</div>
          <div class="actions">
            <button class="btn" @click=${generateOrRefresh} ?disabled=${vs.loading || weekIdsCount === 0}>
              ${vs.list ? 'Vernieuw' : 'Genereer'}
            </button>
            ${vs.list ? html`
              <button class="btn ghost small" @click=${() => window.print()}>Print</button>
              <button class="btn ghost small" @click=${clearAllChecks}>Wis ✓</button>
              <button class="btn ghost small danger" @click=${deleteList}>×</button>
            ` : nothing}
          </div>
        </div>
      </div>

      <div class="filter-row no-print">
        <div class="modus-toggle">
          ${[
            { id: 'huishouden', label: 'Huishouden', kleur: 'leaf' },
            { id: 'peter',      label: 'Peter',      kleur: 'berry' },
            { id: 'miranda',    label: 'Miranda',    kleur: 'plum' },
          ].map(m => html`
            <button class="chip ${m.kleur} ${vs.modus === m.id ? 'is-on' : ''}" @click=${() => setModus(m.id)}>${m.label}</button>
          `)}
        </div>
        <div class="week-nav">
          <button class="chip" @click=${() => changeWeek(-1)}>← Wk ${vs.week - 1 || 52}</button>
          <button class="chip is-on" @click=${() => { const t = todayInfo(); vs.year = t.year; vs.week = t.week; loadAll(); }}>Wk ${vs.week}</button>
          <button class="chip" @click=${() => changeWeek(1)}>Wk ${vs.week + 1 > 52 ? 1 : vs.week + 1} →</button>
        </div>
      </div>

      ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}

      <div class="filter-row no-print store-filter-row" style="justify-content: flex-start;">
        <div class="cmt" style="margin-right: 8px;">// gegroepeerd per winkel</div>
        <button class="chip ${vs.storeFilter === 'all' ? 'is-on' : ''}" @click=${() => setStoreFilter('all')}>
          Alle winkels (${all.length})
        </button>
        ${usedStores.map(s => html`
          <button class="chip ${vs.storeFilter === s ? 'is-on' : ''}" @click=${() => setStoreFilter(s)}>
            ${winkelLabel(s)} (${all.filter(i => i.store === s).length})
          </button>
        `)}
      </div>

      ${all.length === 0 && !vs.loading ? html`
        <div class="empty">
          ${weekIdsCount === 0
            ? html`<p>Geen weken voor ${vs.modus === 'huishouden' ? 'het huishouden' : vs.modus} in week ${vs.week}. Maak eerst een week aan via Week-tab.</p>`
            : html`<p>Klik <strong>Genereer</strong> bovenin om de boodschappen voor week ${vs.week} samen te stellen.</p>`}
        </div>
      ` : nothing}

      <div class="store-grid">
        ${groups.map(group => renderCategoryCard(group, all))}
      </div>
    </section>

    <style>
      .shopview { display: flex; flex-direction: column; gap: 24px; }

      .hero-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      .hero-card {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 20px;
      }
      .hero-card .display { font-size: 48px; margin-top: 4px; line-height: 0.95; }
      .hero-card .lead { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
      .hero-card .frac { font-size: 18px; color: var(--ink-3); }
      .hero-card .bar { height: 4px; background: var(--bg-3); border-radius: 2px; margin-top: 12px; overflow: hidden; }
      .hero-card .bar > div { height: 100%; background: var(--leaf); transition: width .3s ease; }

      .hero-dark { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      .hero-dark .cmt { color: var(--bg); opacity: 0.6; }
      .hero-dark .lead { color: var(--bg); opacity: 0.7; }

      .hero-soft { background: var(--bg-2); }
      .modus-display { font-size: 28px; font-family: var(--display); font-weight: 700; }

      .actions-card { display: flex; flex-direction: column; gap: 8px; }
      .actions-card .actions { display: flex; flex-direction: column; gap: 6px; }
      .actions-card .btn { width: 100%; justify-content: center; }
      .actions-card .btn.small { height: 32px; padding: 0 10px; font-size: 12px; }
      .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
      .btn.ghost.danger:hover { background: var(--tomato-tint); }

      .filter-row {
        display: flex; gap: 6px; flex-wrap: wrap;
        align-items: center; justify-content: space-between;
      }
      .modus-toggle { display: flex; gap: 4px; }
      .modus-toggle .chip { cursor: pointer; }
      .modus-toggle .chip.is-on { outline: 2px solid var(--ink); outline-offset: 1px; }
      .week-nav { display: flex; gap: 4px; }
      .week-nav .chip { cursor: pointer; }
      .week-nav .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      .filter-row .chip { cursor: pointer; }
      .filter-row .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); }

      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }
      .empty { padding: 32px; text-align: center; background: var(--bg); border: 1px dashed var(--line-2); border-radius: var(--r-lg); color: var(--ink-2); }

      .store-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }
      .store-card {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 18px;
      }
      .store-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
      }
      .store-head .left { display: flex; align-items: center; gap: 10px; }
      .store-head .dot { width: 10px; height: 10px; border-radius: 50%; }
      .store-head .name { font-weight: 700; font-size: 14px; }
      .store-head .count { font-family: var(--mono); font-size: 10px; color: var(--ink-3); }

      .item-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .item-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: background .15s;
      }
      .item-row:hover { background: var(--bg-2); }
      .item-row.is-done { opacity: 0.45; }
      .item-row.is-done .name, .item-row.is-done .qty { text-decoration: line-through; }
      .item-row .name-col { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; cursor: pointer; }
      .item-row .name { font-size: 14px; font-weight: 500; }
      .item-row .variant-hint { font-size: 10px; color: var(--ink-3); font-style: italic; }
      .item-row .qty { font-family: var(--mono); font-size: 11px; color: var(--ink-3); }

      .qty-edit-btn {
        font-family: var(--mono); font-size: 12px;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
        color: var(--ink-2);
        min-width: 60px;
        text-align: right;
      }
      .qty-edit-btn:hover { border-color: var(--ink); color: var(--ink); }
      .qty-empty { color: var(--ink-3); font-style: italic; }
      .partial-mark { color: var(--tomato); font-weight: 700; margin-left: 2px; }

      .qty-edit-input {
        font-family: var(--mono); font-size: 12px;
        width: 70px;
        padding: 4px 8px;
        border: 1.5px solid var(--ink);
        border-radius: 6px;
        background: var(--bg);
        color: var(--ink);
        text-align: right;
      }
      .qty-edit-input:focus { outline: none; }
      .qty-unit { font-family: var(--mono); font-size: 11px; color: var(--ink-3); margin-left: -4px; }

      .notes-panel {
        background: var(--mustard-tint);
        border: 1px solid oklch(85% 0.08 85);
        border-radius: var(--r-lg);
        padding: 14px 18px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .notes-head {
        display: flex; align-items: center; justify-content: space-between;
        cursor: pointer;
      }
      .notes-meta { display: flex; align-items: center; gap: 8px; }
      .notes-meta .badge {
        background: var(--ink); color: var(--bg);
        font-size: 11px; font-weight: 700;
        padding: 2px 8px; border-radius: 999px;
        font-family: var(--mono);
      }
      .notes-meta .caret { color: oklch(40% 0.10 85); }

      .notes-input { display: flex; gap: 8px; }
      .notes-input input {
        flex: 1; font: inherit; padding: 8px 12px;
        border-radius: var(--r-md);
        border: 1px solid oklch(80% 0.08 85);
        background: var(--bg);
        color: var(--ink);
      }
      .notes-input input:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
      .notes-input .btn { white-space: nowrap; }

      .notes-empty { margin: 4px 0; color: oklch(35% 0.10 85); }
      .notes-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
      .note-row {
        background: var(--bg);
        border-radius: var(--r-sm);
        padding: 8px 10px;
        display: flex; align-items: center; gap: 8px;
        font-size: 13px;
      }
      .note-row .note-name { font-weight: 600; }
      .note-row .btn.small { height: 26px; padding: 0 8px; font-size: 11px; }

      .person-tag {
        display: inline-block;
        padding: 1px 6px;
        margin-left: 4px;
        border-radius: 999px;
        font-size: 10px;
        color: white;
        font-weight: 700;
      }
      .person-tag.peter { background: var(--peter); }
      .person-tag.miranda { background: var(--miranda); }

      @media (max-width: 960px) {
        .hero-row { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 720px) {
        .hero-row { display: contents; }
        .hero-card { display: flex; flex-direction: column; gap: 4px; }
        .hero-card .display { font-size: 32px; }
        .modus-display { font-size: 22px; }
        /* Alle hero-cards naar onderen op mobiel; volgorde Totaal → Afgevinkt → Modus → Acties */
        .hero-totaal  { order: 99; }
        .hero-checked { order: 100; }
        .hero-modus   { order: 101; }
        .hero-acties  { order: 102; }
        .actions-card .btn { font-size: 13px; }

        /* Winkel-filter rij verbergen op mobiel — niet relevant zonder winkel-data */
        .store-filter-row { display: none; }
      }

      @media print {
        .no-print { display: none !important; }
        body { background: white; }
        .hero-row { grid-template-columns: 1fr 1fr; }
        .hero-card { box-shadow: none; padding: 12px; }
        .hero-card .display { font-size: 28px; }
        .store-card { box-shadow: none; page-break-inside: avoid; }
        .item-row { padding: 4px 0; }
      }
    </style>
  `;
}

function renderNotesPanel() {
  const count = vs.notes.length;
  return html`
    <div class="notes-panel ${vs.notesOpen ? '' : 'collapsed'}">
      <div class="notes-head" @click=${toggleNotesPanel}>
        <div class="cmt">// notities — losse boodschappen die je deze week tegenkomt</div>
        <div class="notes-meta">
          ${count > 0 ? html`<span class="badge">${count}</span>` : ''}
          <span class="caret">${vs.notesOpen ? '▾' : '▸'}</span>
        </div>
      </div>
      ${vs.notesOpen ? html`
        <form class="notes-input" @submit=${submitNote}>
          <input
            type="text"
            placeholder="bv. kaas, koffiefilters, wc-papier"
            .value=${vs.noteInput}
            @input=${(e) => { vs.noteInput = e.target.value; }}
          />
          <button class="btn" type="submit" ?disabled=${!vs.noteInput.trim()}>+ noteer</button>
        </form>

        ${count === 0 ? html`
          <p class="notes-empty cmt">Nog geen open notities. Tik er één in als je iets tegenkomt.</p>
        ` : html`
          <ul class="notes-list">
            ${vs.notes.map(n => html`
              <li class="note-row">
                <span class="note-name">${n.name}</span>
                ${n.profiles?.naam ? html`<span class="cmt">door ${n.profiles.naam}</span>` : ''}
                <span style="flex:1"></span>
                <button class="btn ghost small" @click=${() => noteToList(n)} title="naar boodschappenlijst">✓ naar lijst</button>
                <button class="btn ghost small" @click=${() => noteDismiss(n)} title="weg">×</button>
              </li>
            `)}
          </ul>
        `}
      ` : ''}
    </div>
  `;
}

function renderCategoryCard(group, allItems) {
  return html`
    <div class="store-card">
      <div class="store-head">
        <div class="left">
          <span class="dot" style="background:oklch(70% 0.16 ${group.hue});"></span>
          <span class="name">${group.label}</span>
        </div>
        <span class="count">${group.items.length}</span>
      </div>
      <ul class="item-list">
        ${group.items.map(item => {
          const idx = allItems.indexOf(item);
          const key = itemKey(item);
          const isEditing = vs.editingKey === key;
          const variantHint = item.variants && item.variants.length > 1
            ? `ook: ${item.variants.filter(v => v.toLowerCase() !== item.name.toLowerCase()).join(', ')}`
            : '';
          return html`
            <li class="item-row ${item.checked ? 'is-done' : ''}">
              <span @click=${() => toggleChecked(idx)}>
                ${Checkbox({ checked: item.checked, hue: group.hue, onClick: () => toggleChecked(idx) })}
              </span>
              <div class="name-col" @click=${() => toggleChecked(idx)}>
                <span class="name">${item.name}</span>
                ${variantHint ? html`<span class="variant-hint">${variantHint}</span>` : ''}
              </div>
              ${isEditing ? html`
                <input
                  class="qty-edit-input"
                  type="text"
                  inputmode="decimal"
                  .value=${item.qty != null ? String(item.qty) : ''}
                  @blur=${(e) => commitEditQty(idx, e.target.value)}
                  @keydown=${(e) => {
                    if (e.key === 'Enter') { e.target.blur(); }
                    else if (e.key === 'Escape') { cancelEditQty(); }
                  }}
                />
                <span class="qty-unit">${item.unit || ''}</span>
              ` : html`
                <button class="qty-edit-btn" title="aanpassen" @click=${(e) => { e.stopPropagation(); startEditQty(key); }}>
                  ${item.qty != null
                    ? html`${formatQty(item.qty, item.unit)}${item.partial ? html`<span class="partial-mark">+</span>` : ''}`
                    : html`<span class="qty-empty">+ qty</span>`}
                </button>
              `}
              <span class="who">
                ${item.who.includes('peter')   ? html`<span class="person-tag peter">P</span>`   : ''}
                ${item.who.includes('miranda') ? html`<span class="person-tag miranda">M</span>` : ''}
              </span>
            </li>
          `;
        })}
      </ul>
    </div>
  `;
}
