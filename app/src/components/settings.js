// v2.6: settings-modal voor macro-targets per profiel.
// Geopend via tandwiel-knop in shell-topbar.

import { html, render } from 'lit-html';
import { listProfiles, updateProfileMacros } from '../lib/data.js';

const HOST_ID = '__settings_host';

const ui = {
  open: false,
  profiles: null,
  drafts: {},     // { peter: {...}, miranda: {...} }
  busy: false,
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

function rerender() {
  render(view(), ensureHost());
}

export async function openSettings() {
  ui.open = true;
  ui.error = null;
  ui.busy = false;
  rerender();
  try {
    ui.profiles = await listProfiles();
    ui.drafts = {};
    for (const slug of Object.keys(ui.profiles)) {
      const p = ui.profiles[slug];
      ui.drafts[slug] = {
        kcal_doel: p.kcal_doel ?? '',
        eiwit_g_doel: p.eiwit_g_doel ?? '',
        koolh_g_doel: p.koolh_g_doel ?? '',
        vet_g_doel: p.vet_g_doel ?? '',
      };
    }
  } catch (err) {
    ui.error = err.message;
  }
  rerender();
}

function close() {
  ui.open = false;
  rerender();
}

async function save() {
  ui.busy = true; ui.error = null; rerender();
  try {
    for (const slug of Object.keys(ui.drafts)) {
      const d = ui.drafts[slug];
      const profile = ui.profiles[slug];
      await updateProfileMacros(profile.id, {
        kcal_doel: d.kcal_doel === '' ? null : parseInt(d.kcal_doel, 10),
        eiwit_g_doel: d.eiwit_g_doel === '' ? null : parseFloat(d.eiwit_g_doel),
        koolh_g_doel: d.koolh_g_doel === '' ? null : parseFloat(d.koolh_g_doel),
        vet_g_doel:   d.vet_g_doel   === '' ? null : parseFloat(d.vet_g_doel),
      });
    }
    close();
  } catch (err) {
    ui.error = err.message;
    ui.busy = false;
    rerender();
  }
}

function setField(slug, field, val) {
  ui.drafts[slug][field] = val;
}

function view() {
  if (!ui.open) return null;
  const slugs = Object.keys(ui.drafts || {});
  return html`
    <div class="set-backdrop" @click=${close}>
      <div class="set-modal" @click=${(e) => e.stopPropagation()}>
        <header class="set-head">
          <div>
            <p class="lead">// instellingen</p>
            <h3 class="display">Macro-targets</h3>
          </div>
          <button class="btn ghost small" @click=${close}>sluit</button>
        </header>

        <div class="set-body">
          <p class="cmt">Doelwaarden per dag, gebruikt voor het kleuroordeel in het weekmenu. Leeg laten als je geen target wilt.</p>
          ${slugs.length === 0 ? html`<p class="cmt">Profielen laden…</p>` : slugs.map(slug => {
            const p = ui.profiles[slug];
            const d = ui.drafts[slug];
            return html`
              <fieldset class="set-fs">
                <legend>${p.naam}</legend>
                <div class="set-grid">
                  <label>kcal/dag<input type="number" min="0" step="50" .value=${d.kcal_doel} @input=${(e) => setField(slug, 'kcal_doel', e.target.value)} /></label>
                  <label>eiwit g/dag<input type="number" min="0" step="5" .value=${d.eiwit_g_doel} @input=${(e) => setField(slug, 'eiwit_g_doel', e.target.value)} /></label>
                  <label>koolh g/dag<input type="number" min="0" step="5" .value=${d.koolh_g_doel} @input=${(e) => setField(slug, 'koolh_g_doel', e.target.value)} /></label>
                  <label>vet g/dag<input type="number" min="0" step="5" .value=${d.vet_g_doel} @input=${(e) => setField(slug, 'vet_g_doel', e.target.value)} /></label>
                </div>
              </fieldset>
            `;
          })}
          ${ui.error ? html`<div class="err">${ui.error}</div>` : ''}
        </div>

        <footer class="set-foot">
          <button class="btn ghost" @click=${close}>annuleer</button>
          <button class="btn" @click=${save} ?disabled=${ui.busy}>${ui.busy ? 'Opslaan…' : 'Opslaan'}</button>
        </footer>
      </div>

      <style>
        .set-backdrop { position: fixed; inset: 0; background: oklch(18% 0.02 60 / 0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .set-modal { background: var(--bg); border-radius: var(--r-lg); width: 100%; max-width: 520px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px oklch(18% 0.02 60 / 0.3); }
        .set-head { padding: 22px 22px 14px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .set-head h3 { font-size: 22px; }
        .set-head .lead { font-size: 12px; color: var(--ink-3); margin: 0 0 4px; }
        .set-body { padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
        .set-fs { border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; }
        .set-fs legend { padding: 0 6px; color: var(--ink-2); font-size: 13px; font-weight: 600; }
        .set-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .set-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-2); }
        .set-grid input { font: inherit; padding: 8px 10px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); }
        .set-foot { padding: 14px 22px 18px; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: flex-end; }
        .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); padding: 10px 14px; border-radius: var(--r-md); font-size: 14px; }
      </style>
    </div>
  `;
}
