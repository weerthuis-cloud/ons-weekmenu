// ImportView v0.7b: PDF uploaden + parse + edit-grid + bulk-import.
// Voor de wekelijkse routine: gebruik Cowork (sleep PDF in chat, ik importeer direct).
// Deze view is een handmatige fallback voor als Cowork niet beschikbaar is.
import { html, nothing } from 'lit-html';
import { extractPdf } from '../lib/pdf-extract.js';
import { parseDietPdf, suggestMealName, suggestIngredients } from '../lib/pdf-parse-soft.js';
import { listProfiles, importWeek, uploadDietistPdf } from '../lib/data.js';
import { SLOTS, SLOT_BY_ID } from '../lib/slots.js';
import { todayInfo } from '../lib/datums.js';
import { SlotIcon } from '../components/slot-icon.js';
import { rerender, state as appState } from '../main.js';

const DAGEN = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];

const vs = {
  loading: false,
  parsing: false,
  saving: false,
  error: null,
  file: null,
  parsed: null,           // { weekNumber, ownerName, cells }
  editCells: {},
  ownerSlug: null,
  year: null,
  week: null,
  source: 'dietist',
  savePdf: true,
  profiles: null,
  initialized: false,
  done: false,
  doneMsg: '',
};

function ensureInit() {
  if (vs.initialized) return;
  const t = todayInfo();
  vs.year = t.year;
  vs.week = t.week;
  vs.initialized = true;
  queueMicrotask(async () => {
    try { vs.profiles = await listProfiles(); }
    catch (err) { vs.error = err.message; }
    rerender();
  });
}

async function onFile(file) {
  if (!file || file.type !== 'application/pdf') {
    vs.error = 'Geen geldig PDF-bestand.';
    rerender();
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    vs.error = 'PDF te groot (max 10 MB).';
    rerender();
    return;
  }
  vs.file = file;
  vs.error = null;
  vs.parsing = true;
  vs.done = false;
  rerender();
  try {
    const extracted = await extractPdf(file);
    const parsed = parseDietPdf(extracted);
    vs.parsed = parsed;
    if (parsed.weekNumber) vs.week = parsed.weekNumber;
    // Default ownerSlug op basis van detected name
    if (parsed.ownerName) {
      const lower = parsed.ownerName.toLowerCase();
      if (lower.includes('peter')) vs.ownerSlug = 'peter';
      else if (lower.includes('miranda')) vs.ownerSlug = 'miranda';
    }
    if (!vs.ownerSlug) vs.ownerSlug = appState.auth?.profile?.slug || 'peter';

    // Init edit-grid: vul met suggesties
    vs.editCells = {};
    for (let d = 1; d <= 7; d++) {
      vs.editCells[d] = {};
      const dayName = DAGEN[d - 1];
      for (const slot of SLOTS) {
        const raw = parsed.cells?.[dayName]?.[slot.id] ?? '';
        const name = suggestMealName(raw, slot.id);
        vs.editCells[d][slot.id] = {
          raw,
          name,
          // Diner: cel-tekst is gerecht, geen ingrediënten in de PDF
          ingredients: slot.id === 'diner' ? [] : suggestIngredients(raw),
          include: !!name,
        };
      }
    }
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.parsing = false;
    rerender();
  }
}

async function confirmImport() {
  if (!vs.parsed || !vs.ownerSlug) return;
  vs.saving = true; vs.error = null; rerender();
  try {
    const profile = vs.profiles[vs.ownerSlug];
    if (!profile) throw new Error('Profiel niet gevonden');

    // PDF naar storage (optioneel)
    let pdfPath = null;
    if (vs.savePdf && vs.file) {
      pdfPath = await uploadDietistPdf(vs.file, { ownerId: profile.id, year: vs.year, week: vs.week });
    }

    // Verzamel entries
    const entries = [];
    for (let d = 1; d <= 7; d++) {
      for (const slot of SLOTS) {
        const cell = vs.editCells[d][slot.id];
        if (!cell.include || !cell.name?.trim()) continue;
        entries.push({
          day: d,
          slot: slot.id,
          name: cell.name.trim(),
          kcal: cell.kcal || null,
          ingredients: cell.ingredients?.filter(i => i.name) ?? [],
          suitableFor: [vs.ownerSlug],
        });
      }
    }

    if (entries.length === 0) {
      throw new Error('Geen maaltijden geselecteerd om te importeren.');
    }

    await importWeek({
      ownerId: profile.id,
      year: vs.year,
      week: vs.week,
      source: vs.source,
      pdfPath,
      entries,
    });

    vs.done = true;
    vs.doneMsg = `${entries.length} maaltijden geïmporteerd voor ${profile.naam}, week ${vs.week} ${vs.year}.`;
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.saving = false;
    rerender();
  }
}

function reset() {
  vs.file = null; vs.parsed = null; vs.editCells = {};
  vs.error = null; vs.done = false; vs.doneMsg = '';
  rerender();
}

export function ImportView(state) {
  ensureInit();
  return html`
    <section class="view-wrap importview">
      <div class="iv-head">
        <div class="cmt">// PDF van de diëtist inlezen, controleren, opslaan</div>
        <h1 class="display">Import</h1>
      </div>

      ${!vs.done ? html`
        <div class="hint-card">
          <div class="cmt">// snelle route</div>
          <div class="hint-text">
            Voor de wekelijkse import: open <strong>Cowork</strong> met dit project, sleep je diëtist-PDF in de chat en zeg "importeer".
            Ik regel de rest direct. Deze view is een handmatige fallback voor als Cowork niet bij de hand is.
          </div>
        </div>
      ` : ''}

      ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}
      ${vs.done ? html`<div class="ok">✓ ${vs.doneMsg} <button class="btn ghost small" @click=${reset}>nog een import</button></div>` : nothing}

      ${!vs.done && !vs.parsed ? renderUpload() : nothing}
      ${!vs.done &&  vs.parsed ? renderEditGrid() : nothing}
    </section>

    <style>
      .importview { display: flex; flex-direction: column; gap: 24px; }
      .iv-head h1 { font-size: clamp(36px, 5vw, 56px); margin: 4px 0 0; line-height: 0.95; }
      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }
      .ok { background: var(--leaf-tint); color: oklch(38% 0.12 145); padding: 12px 16px; border-radius: var(--r-md); display: flex; gap: 12px; align-items: center; }

      .hint-card {
        background: var(--mustard-tint);
        border: 1px solid oklch(85% 0.08 85);
        border-radius: var(--r-md);
        padding: 14px 16px;
        display: flex; flex-direction: column; gap: 6px;
      }
      .hint-card .cmt { color: oklch(35% 0.10 85); }
      .hint-text { font-size: 13px; color: oklch(30% 0.10 85); line-height: 1.5; }

      .drop {
        border: 2px dashed var(--line-2);
        border-radius: var(--r-lg);
        padding: 60px 32px;
        text-align: center;
        background: var(--bg);
        cursor: pointer;
        transition: border-color .15s, background .15s;
      }
      .drop:hover, .drop.dragover { border-color: var(--ink); background: var(--bg-2); }
      .drop .display { font-size: 28px; }
      .drop .lead { color: var(--ink-2); margin-top: 8px; }
      .drop .file-info { color: var(--ink-3); font-size: 12px; margin-top: 12px; font-family: var(--mono); }

      .meta-bar {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 18px 20px;
        display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;
      }
      .meta-bar label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-3); }
      .meta-bar input, .meta-bar select { font: inherit; padding: 6px 10px; border-radius: var(--r-sm); border: 1px solid var(--line-2); background: var(--bg); }
      .meta-bar .grow { flex: 1; min-width: 200px; }
      .meta-bar .actions { display: flex; gap: 8px; margin-left: auto; }

      .grid-wrap { overflow-x: auto; }
      .edit-grid {
        display: grid;
        grid-template-columns: 110px repeat(7, minmax(180px, 1fr));
        gap: 6px;
        background: var(--bg-2);
        border-radius: var(--r-md);
        padding: 6px;
      }
      .edit-grid .col-head, .edit-grid .row-head, .edit-grid .cell {
        background: var(--bg);
        border-radius: var(--r-sm);
        padding: 8px 10px;
      }
      .edit-grid .col-head { font-weight: 700; font-size: 13px; text-align: center; padding: 10px; }
      .edit-grid .row-head { display: flex; flex-direction: column; gap: 4px; }
      .edit-grid .row-head .lbl { font-weight: 600; font-size: 13px; }
      .edit-grid .row-head .icon { color: var(--ink); }

      .cell { display: flex; flex-direction: column; gap: 4px; min-height: 88px; }
      .cell .toggle { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-3); }
      .cell input.name {
        font: inherit;
        font-size: 12px;
        padding: 4px 6px;
        border-radius: 4px;
        border: 1px solid var(--line-2);
        background: var(--bg);
      }
      .cell .raw {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        white-space: pre-wrap;
        line-height: 1.3;
        max-height: 80px;
        overflow-y: auto;
        background: var(--bg-2);
        padding: 4px;
        border-radius: 4px;
      }
      .cell .ing-count { font-size: 10px; color: var(--ink-3); }
      .cell.disabled { opacity: 0.4; }
      .cell.disabled input { pointer-events: none; }
    </style>
  `;
}

function renderUpload() {
  const onDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };
  const onSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };
  return html`
    <div class="drop"
      @click=${() => document.getElementById('iv-file-input').click()}
      @dragover=${(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
      @dragleave=${(e) => e.currentTarget.classList.remove('dragover')}
      @drop=${onDrop}>
      <div class="cmt">// upload PDF</div>
      <div class="display">Sleep hier de PDF van de diëtist</div>
      <div class="lead">of klik om te selecteren</div>
      ${vs.parsing ? html`<div class="file-info">parsen…</div>` : ''}
      ${vs.file && !vs.parsing ? html`<div class="file-info">${vs.file.name} · ${(vs.file.size / 1024).toFixed(0)} KB</div>` : ''}
      <input id="iv-file-input" type="file" accept="application/pdf" hidden @change=${onSelect} />
    </div>
  `;
}

function renderEditGrid() {
  return html`
    <div class="meta-bar">
      <label>Persoon
        <select .value=${vs.ownerSlug} @change=${(e) => { vs.ownerSlug = e.target.value; rerender(); }}>
          ${vs.profiles ? Object.entries(vs.profiles).map(([slug, p]) => html`
            <option value=${slug} ?selected=${slug === vs.ownerSlug}>${p.naam}</option>
          `) : ''}
        </select>
      </label>
      <label>Jaar
        <input type="number" min="2024" max="2030" .value=${vs.year} @input=${(e) => { vs.year = +e.target.value; }} />
      </label>
      <label>Week
        <input type="number" min="1" max="53" .value=${vs.week} @input=${(e) => { vs.week = +e.target.value; }} />
      </label>
      <label>Bron
        <select .value=${vs.source} @change=${(e) => { vs.source = e.target.value; }}>
          <option value="dietist" ?selected=${vs.source === 'dietist'}>diëtist</option>
          <option value="eigen" ?selected=${vs.source === 'eigen'}>eigen</option>
        </select>
      </label>
      <label class="toggle-line">
        <input type="checkbox" .checked=${vs.savePdf} @change=${(e) => { vs.savePdf = e.target.checked; }} />
        PDF bewaren in storage
      </label>
      <div class="actions">
        <button class="btn ghost" @click=${reset}>annuleer</button>
        <button class="btn" @click=${confirmImport} ?disabled=${vs.saving}>
          ${vs.saving ? 'opslaan…' : 'Importeer week →'}
        </button>
      </div>
    </div>

    ${vs.parsed?.weekNumber || vs.parsed?.ownerName ? html`
      <div class="cmt">// gedetecteerd: ${vs.parsed.weekNumber ? `week ${vs.parsed.weekNumber}` : ''} ${vs.parsed.ownerName ? `· voor ${vs.parsed.ownerName}` : ''}</div>
    ` : ''}

    <div class="grid-wrap">
      <div class="edit-grid">
        <div></div>
        ${DAGEN.map(d => html`<div class="col-head">${d}</div>`)}
        ${SLOTS.map(slot => html`
          <div class="row-head">
            <span class="icon">${SlotIcon({ slot: slot.id, size: 18 })}</span>
            <span class="lbl">${slot.label}</span>
          </div>
          ${[1,2,3,4,5,6,7].map(d => renderCell(d, slot))}
        `)}
      </div>
    </div>
  `;
}

function renderCell(day, slot) {
  const cell = vs.editCells[day]?.[slot.id] || {};
  return html`
    <div class="cell ${cell.include ? '' : 'disabled'}">
      <label class="toggle">
        <input type="checkbox" .checked=${cell.include}
          @change=${(e) => { cell.include = e.target.checked; rerender(); }} />
        opnemen
      </label>
      <input type="text" class="name"
        placeholder="maaltijd-naam"
        .value=${cell.name || ''}
        @input=${(e) => { cell.name = e.target.value; }} />
      ${cell.ingredients?.length ? html`<div class="ing-count">${cell.ingredients.length} ingr.</div>` : ''}
      ${cell.raw ? html`<details><summary class="cmt">ruwe tekst</summary><div class="raw">${cell.raw}</div></details>` : ''}
    </div>
  `;
}
