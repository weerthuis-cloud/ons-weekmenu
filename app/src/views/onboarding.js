import { html } from 'lit-html';
import { createOwnProfile, signOut } from '../lib/auth.js';

const ui = { busy: false, error: null };

export function OnboardingView(state, actions, rerender) {
  async function pick(slug, naam) {
    ui.busy = true;
    ui.error = null;
    rerender();
    try {
      await createOwnProfile({ slug, naam });
      // setState in createOwnProfile zorgt voor status 'ready'.
    } catch (err) {
      ui.error = err.message || 'Kon profiel niet aanmaken.';
    } finally {
      ui.busy = false;
      rerender();
    }
  }

  return html`
    <section class="auth-shell">
      <div class="auth-card card">
        <header class="auth-head">
          <h1 class="display">Wie ben je?</h1>
          <p class="lead">Eenmalige keuze. Bepaalt welk menu standaard van jou is.</p>
        </header>

        <div class="picks">
          <button class="pick peter" ?disabled=${ui.busy} @click=${() => pick('peter', 'Peter')}>
            <span class="dot"></span>
            <span class="naam">Peter</span>
          </button>
          <button class="pick miranda" ?disabled=${ui.busy} @click=${() => pick('miranda', 'Miranda')}>
            <span class="dot"></span>
            <span class="naam">Miranda</span>
          </button>
        </div>

        ${ui.error ? html`<div class="err">${ui.error}</div>` : null}

        <button class="btn ghost" @click=${() => signOut()}>Uitloggen</button>
      </div>

      <style>
        .auth-shell {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--pad);
        }
        .auth-card { max-width: 420px; width: 100%; display: flex; flex-direction: column; gap: 18px; }
        .auth-head h1 { font-size: 32px; }
        .lead { color: var(--ink-2); margin: 4px 0 0; }
        .picks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pick {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 22px 16px;
          border: 1px solid var(--line-2);
          border-radius: var(--r-lg);
          background: var(--bg);
          font: inherit;
          color: var(--ink);
          font-weight: 600;
          cursor: pointer;
          transition: transform .12s ease;
        }
        .pick:hover { transform: translateY(-1px); }
        .pick:disabled { opacity: 0.5; cursor: wait; }
        .pick .dot { width: 32px; height: 32px; border-radius: 50%; }
        .pick.peter .dot   { background: var(--peter); }
        .pick.miranda .dot { background: var(--miranda); }
        .err {
          background: var(--tomato-tint);
          color: oklch(40% 0.14 28);
          border: 1px solid oklch(85% 0.08 28);
          padding: 10px 14px;
          border-radius: var(--r-md);
          font-size: 14px;
        }
      </style>
    </section>
  `;
}
