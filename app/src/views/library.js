// Archief v0.6: prototype-stijl mosaic preview-cards.
import { html, nothing } from 'lit-html';
import { listProfiles, listWeeks, countSlotsByWeek, addWeek, getWeek, duplicateWeekMeals, onDataChange,
         exportAllData, restoreFromBackup, deleteWeeksOlderThan, wipeAllUserData } from '../lib/data.js';
import { formatWeekRange, todayInfo } from '../lib/datums.js';
import { rerender } from '../main.js';
import { setRoute } from '../router.js';
import { gotoWeek } from './week.js';

const vs = {
  loading: false,
  error: null,
  profiles: null,
  weeks: { peter: [], miranda: [] },
  slotCounts: {},
  initialized: false,
  filter: 'all', // 'all' | 'dietist' | 'eigen'
  dup: null,
};

function ensureInit() {
  if (vs.initialized) return;
  vs.initialized = true;
  onDataChange((scope) => {
    if (scope === 'weeks' || scope === 'week_meals') loadAll();
  });
  queueMicrotask(loadAll);
}

async function loadAll() {
  vs.loading = true; vs.error = null; rerender();
  try {
    if (!vs.profiles) vs.profiles = await listProfiles();
    const allIds = [];
    for (const slug of ['peter', 'miranda']) {
      const p = vs.profiles[slug];
      if (!p) continue;
      vs.weeks[slug] = await listWeeks({ ownerId: p.id });
      for (const w of vs.weeks[slug]) allIds.push(w.id);
    }
    vs.slotCounts = await countSlotsByWeek(allIds);
  } catch (err) {
    vs.error = err.message;
  } finally {
    vs.loading = false;
    rerender();
  }
}

function openWeek(year, weekNr) {
  gotoWeek(year, weekNr);
  setRoute('week');
}

function startDuplicate(srcSlug, srcWeek) {
  const t = todayInfo();
  const next = t.week + 1 > 52 ? { year: t.year + 1, week: 1 } : { year: t.year, week: t.week + 1 };
  vs.dup = { srcSlug, srcWeek, year: next.year, week: next.week };
  rerender();
}

async function confirmDuplicate() {
  if (!vs.dup) return;
  vs.loading = true; rerender();
  try {
    const profile = vs.profiles[vs.dup.srcSlug];
    let dst = await getWeek(profile.id, vs.dup.year, vs.dup.week);
    if (!dst) dst = await addWeek({ ownerId: profile.id, year: vs.dup.year, week: vs.dup.week, source: 'eigen' });
    await duplicateWeekMeals(vs.dup.srcWeek.id, dst.id);
    vs.dup = null;
    await loadAll();
    openWeek(dst.year, dst.week_nr);
  } catch (err) {
    vs.error = err.message;
    vs.loading = false;
    rerender();
  }
}

// Standaard 3 hues voor mosaic (varieert subtiel per week-id voor visuele variatie)
function mosaicHues(weekId, source) {
  // basis-hues; rotatie op basis van eerste karakters van weekId
  const base = source === 'dietist' ? [28, 145, 85] : [145, 85, 260];
  if (!weekId) return base;
  const seed = weekId.charCodeAt(0) % 3;
  return [...base.slice(seed), ...base.slice(0, seed)];
}

export function LibraryView(state) {
  ensureInit();
  const persoon = state.persoon;
  const showSlugs = persoon === 'beiden' ? ['peter','miranda'] : [persoon];

  return html`
    <section class="view-wrap libview">
      <div class="lv-head">
        <div>
          <div class="cmt">// alle weekmenu's, ooit ingevoerd</div>
          <h1 class="display">Bibliotheek</h1>
        </div>
        <div class="filter-bar">
          ${[
            { id: 'all',     label: 'Alles' },
            { id: 'dietist', label: 'Diëtist alleen' },
            { id: 'eigen',   label: 'Zelf gemaakt' },
          ].map(f => html`
            <button class="chip ${vs.filter === f.id ? 'is-on' : ''}" @click=${() => { vs.filter = f.id; rerender(); }}>${f.label}</button>
          `)}
        </div>
      </div>

      ${vs.error ? html`<div class="err">${vs.error}</div>` : nothing}

      ${showSlugs.map(slug => renderSlugSection(slug))}

      ${renderMaintenancePanel()}

      ${vs.dup ? renderDupModal() : nothing}
    </section>

    <style>
      .libview { display: flex; flex-direction: column; gap: 24px; }

      .lv-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .lv-head h1 { font-size: clamp(36px, 5vw, 56px); margin: 4px 0 0; line-height: 0.95; }
      .filter-bar { display: flex; gap: 6px; flex-wrap: wrap; }
      .filter-bar .chip { cursor: pointer; height: 32px; }
      .filter-bar .chip.is-on { background: var(--ink); color: var(--bg); border-color: var(--ink); }

      .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); }
      .empty { padding: 32px; text-align: center; background: var(--bg); border: 1px dashed var(--line-2); border-radius: var(--r-lg); color: var(--ink-2); }

      .slug-block { display: flex; flex-direction: column; gap: 14px; }
      .block-head { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }
      .block-head .dot { width: 10px; height: 10px; border-radius: 50%; }
      .block-head .dot.peter { background: var(--peter); }
      .block-head .dot.miranda { background: var(--miranda); }

      .week-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 18px;
      }

      .week-card {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        overflow: hidden;
        cursor: pointer;
        transition: transform .15s ease;
        text-align: left;
        padding: 0;
        font: inherit;
        color: inherit;
        display: flex; flex-direction: column;
      }
      .week-card:hover { transform: translateY(-3px); }
      .week-card.is-current { outline: 2px solid var(--ink); }

      .mosaic {
        display: grid;
        grid-template-columns: 2fr 1fr;
        grid-template-rows: 1fr 1fr;
        height: 140px;
        gap: 2px;
        background: var(--bg-2);
      }
      .mosaic .ph {
        border-radius: 0;
      }
      .mosaic .ph:nth-child(1) { grid-row: 1 / 3; }

      .week-card-body {
        padding: 16px 18px 18px;
        display: flex; flex-direction: column; gap: 6px;
      }
      .wb-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .wb-title { font-size: 18px; font-weight: 700; font-family: var(--display); letter-spacing: -0.01em; }
      .wb-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-3); }
      .wb-actions { display: flex; gap: 8px; margin-top: 8px; }
      .wb-actions .chip { cursor: pointer; height: 26px; }

      .mp-backdrop {
        position: fixed; inset: 0; background: oklch(18% 0.02 60 / 0.55);
        z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .mp-modal {
        background: var(--bg); border-radius: var(--r-lg); padding: 22px;
        width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 12px;
        box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3);
      }
      .mp-modal h3 { font-size: 22px; }
      .mp-modal label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ink-2); }
      .mp-modal input { padding: 8px 10px; border-radius: var(--r-md); border: 1px solid var(--line-2); font: inherit; }
      .mp-modal .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .mp-modal .row.right { display: flex; justify-content: flex-end; gap: 8px; }
      .mp-modal .warn { color: oklch(40% 0.14 28); font-size: 13px; }
    </style>
  `;
}

function renderSlugSection(slug) {
  const profile = vs.profiles?.[slug];
  let weeks = vs.weeks[slug] || [];
  if (vs.filter === 'dietist') weeks = weeks.filter(w => w.source === 'dietist');
  else if (vs.filter === 'eigen') weeks = weeks.filter(w => w.source === 'eigen');

  if (!profile) return html`<div class="empty">Profiel "${slug}" nog niet aangemaakt.</div>`;
  if (weeks.length === 0) {
    return html`<div class="empty">
      <p>Geen ${vs.filter === 'all' ? '' : vs.filter + '-'}weken voor ${profile.naam}.</p>
    </div>`;
  }

  return html`
    <div class="slug-block">
      <div class="block-head"><span class="dot ${slug}"></span> ${profile.naam} <span class="cmt" style="margin-left:auto;">${weeks.length} weken</span></div>
      <div class="week-grid">
        ${weeks.map(w => renderWeekCard(slug, w))}
      </div>
    </div>
  `;
}

function renderWeekCard(slug, w) {
  const count = vs.slotCounts[w.id] || 0;
  const today = todayInfo();
  const isCurrent = today.year === w.year && today.week === w.week_nr;
  const hues = mosaicHues(w.id, w.source);
  return html`
    <button class="week-card ${isCurrent ? 'is-current' : ''}" @click=${() => openWeek(w.year, w.week_nr)}>
      <div class="mosaic">
        ${hues.map(h => html`
          <div class="ph" style="--ph-stripe-a: oklch(92% 0.05 ${h}); --ph-stripe-b: oklch(86% 0.09 ${h});"></div>
        `)}
      </div>
      <div class="week-card-body">
        <div class="wb-row">
          <div class="wb-meta">${w.year} · week ${w.week_nr}${isCurrent ? ' · nu' : ''}</div>
          ${w.source === 'dietist'
            ? html`<span class="chip leaf" style="height:20px; font-size: 10px; padding: 0 8px;">✓ diëtist</span>`
            : html`<span class="chip mustard" style="height:20px; font-size: 10px; padding: 0 8px;">eigen</span>`}
        </div>
        <div class="wb-title">${formatWeekRange(w.year, w.week_nr)}</div>
        <div class="wb-meta">${count}/42 slots gevuld</div>
        <div class="wb-actions">
          <span class="chip">Open →</span>
          <span class="chip" @click=${(e) => { e.stopPropagation(); startDuplicate(slug, w); }}>Dupliceer</span>
        </div>
      </div>
    </button>
  `;
}

function renderDupModal() {
  return html`
    <div class="mp-backdrop" @click=${() => { vs.dup = null; rerender(); }}>
      <div class="mp-modal" @click=${(e) => e.stopPropagation()}>
        <h3 class="display">Dupliceer week</h3>
        <p style="color: var(--ink-2); font-size: 13px;">
          Kopieer alle maaltijden van week ${vs.dup.srcWeek.week_nr} (${vs.dup.srcWeek.year}) van ${vs.profiles[vs.dup.srcSlug].naam} naar:
        </p>
        <div class="row">
          <label>Jaar
            <input type="number" min="2024" max="2030" .value=${vs.dup.year}
              @input=${(e) => { vs.dup.year = parseInt(e.target.value, 10) || vs.dup.year; }} />
          </label>
          <label>Week
            <input type="number" min="1" max="52" .value=${vs.dup.week}
              @input=${(e) => { vs.dup.week = parseInt(e.target.value, 10) || vs.dup.week; }} />
          </label>
        </div>
        <p class="warn">Bestaande maaltijden in de doel-week worden overschreven.</p>
        <div class="row right">
          <button class="btn ghost" @click=${() => { vs.dup = null; rerender(); }}>annuleer</button>
          <button class="btn" @click=${confirmDuplicate} ?disabled=${vs.loading}>kopieer →</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// v1.8: Onderhoud — backup-export + AVG-cleanup
// ============================================================
async function doDownloadBackup() {
  vs.error = null;
  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `owm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    vs.error = 'Backup mislukt: ' + err.message;
    rerender();
  }
}

async function doRestoreBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';   // reset zodat zelfde file opnieuw kan
  if (!file) return;
  if (!confirm(`Restore "${file.name}" — dit OVERSCHRIJFT al je huidige data (profielen, maaltijden, weken, lijsten). Doorgaan?`)) return;
  if (!confirm('Echt zeker? Maak eerst een backup van de huidige data als je twijfelt.')) return;
  vs.error = null; rerender();
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const res = await restoreFromBackup(json);
    alert(`Restore klaar:\n${res.profiles} profielen\n${res.meals} maaltijden\n${res.weeks} weken\n${res.week_meals} weekmaaltijden\n${res.shopping_lists} lijsten\n${res.shopping_notes} notities`);
    location.reload();
  } catch (err) {
    vs.error = 'Restore mislukt: ' + err.message;
    rerender();
  }
}

async function doDeleteOldWeeks() {
  // Cutoff: 8 weken vóór huidige week
  const t = todayInfo();
  let cutoffWeek = t.week - 8;
  let cutoffYear = t.year;
  while (cutoffWeek < 1) { cutoffWeek += 52; cutoffYear -= 1; }
  if (!confirm(`Wis alle weken ouder dan week ${cutoffWeek} van ${cutoffYear}? Maaltijden, boodschappen en PDFs van die weken worden verwijderd. Bibliotheek-meals (recepten) blijven bestaan.`)) return;
  vs.error = null;
  try {
    const res = await deleteWeeksOlderThan(cutoffYear, cutoffWeek);
    alert(`Klaar. ${res.deletedWeeks} weken verwijderd, ${res.deletedPdfs} PDFs gewist.`);
    await loadAll();
  } catch (err) {
    vs.error = 'Verwijderen mislukt: ' + err.message;
    rerender();
  }
}

async function doWipeAll() {
  if (!confirm('Wis ALLE data van Peter en Miranda (profielen, weken, maaltijden in weekmenu, boodschappenlijsten, PDFs)? Dit kan niet ongedaan gemaakt worden.')) return;
  if (!confirm('Echt zeker? Type-it nogmaals: dit wist je hele history. Maak eerst een backup als je dat nog niet hebt gedaan.')) return;
  vs.error = null;
  try {
    const res = await wipeAllUserData();
    alert(`Alle data gewist. ${res.deletedProfiles} profielen, ${res.deletedPdfs} PDFs.`);
    location.reload();
  } catch (err) {
    vs.error = 'Wissen mislukt: ' + err.message;
    rerender();
  }
}

function renderMaintenancePanel() {
  return html`
    <div class="maint-panel">
      <div class="cmt">// onderhoud — backup en AVG-cleanup</div>
      <div class="maint-row">
        <button class="btn" @click=${doDownloadBackup}>↓ download backup (.json)</button>
        <span class="cmt">Alle tabellen als JSON. Bewaar lokaal als veiligheidskopie.</span>
      </div>
      <div class="maint-row">
        <label class="btn ghost" for="owm-restore-input" style="cursor:pointer;">↑ herstel uit backup</label>
        <input id="owm-restore-input" type="file" accept="application/json" style="display:none;" @change=${doRestoreBackup} />
        <span class="cmt">Overschrijft alle huidige data met de inhoud van een eerdere backup.</span>
      </div>
      <div class="maint-row">
        <button class="btn ghost" @click=${doDeleteOldWeeks}>wis weken ouder dan 8 weken</button>
        <span class="cmt">Inclusief bijbehorende PDFs. Bibliotheek-meals blijven.</span>
      </div>
      <div class="maint-row">
        <button class="btn ghost danger" @click=${doWipeAll}>wis al mijn data (recht op vergetelheid)</button>
        <span class="cmt">Profielen + alles. Definitief.</span>
      </div>
    </div>
    <style>
      .maint-panel {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: 16px 18px;
        display: flex; flex-direction: column; gap: 10px;
        margin-top: 24px;
      }
      .maint-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .maint-row .btn { min-width: 200px; }
      .maint-row .cmt { font-size: 12px; color: var(--ink-3); }
      .btn.ghost.danger { color: oklch(40% 0.14 28); border-color: oklch(85% 0.08 28); }
      .btn.ghost.danger:hover { background: var(--tomato-tint); }
      @media (max-width: 720px) {
        .maint-row { flex-direction: column; align-items: stretch; }
        .maint-row .btn { width: 100%; }
      }
    </style>
  `;
}
