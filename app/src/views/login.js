import { html } from 'lit-html';
import { signInWithEmail } from '../lib/auth.js';

const ui = {
  email: '',
  sending: false,
  sent: false,
  error: null,
};

export function LoginView(state, actions, rerender) {
  async function submit(e) {
    e.preventDefault();
    ui.sending = true;
    ui.error = null;
    rerender();
    try {
      await signInWithEmail(ui.email);
      ui.sent = true;
    } catch (err) {
      ui.error = err.message || 'Onbekende fout bij inloggen.';
    } finally {
      ui.sending = false;
      rerender();
    }
  }

  return html`
    <section class="auth-shell">
      <div class="auth-card card">
        <header class="auth-head">
          <h1 class="display">ons weekmenu</h1>
          <p class="lead">Log in met je e-mailadres. Je krijgt een magic link toegestuurd.</p>
        </header>

        ${ui.sent ? html`
          <div class="ok">
            <strong>Mail onderweg.</strong>
            <p>Check je inbox op <span class="mono">${ui.email}</span> en klik op de link om in te loggen.</p>
          </div>
        ` : html`
          <form @submit=${submit}>
            <label>
              <span>E-mailadres</span>
              <input
                type="email"
                required
                autofocus
                .value=${ui.email}
                @input=${(e) => { ui.email = e.target.value; }}
                placeholder="naam@voorbeeld.nl"
              />
            </label>
            ${ui.error ? html`<div class="err">${ui.error}</div>` : null}
            <button class="btn" type="submit" ?disabled=${ui.sending}>
              ${ui.sending ? 'Verzenden…' : 'Stuur magic link'}
            </button>
          </form>
        `}

        <footer class="hint mono">v0.2 • alleen toegestane e-mails</footer>
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
        form { display: flex; flex-direction: column; gap: 14px; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--ink-2); }
        input {
          font: inherit;
          padding: 12px 14px;
          border-radius: var(--r-md);
          border: 1px solid var(--line-2);
          background: var(--bg);
          color: var(--ink);
        }
        input:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
        .err {
          background: var(--tomato-tint);
          color: oklch(40% 0.14 28);
          border: 1px solid oklch(85% 0.08 28);
          padding: 10px 14px;
          border-radius: var(--r-md);
          font-size: 14px;
        }
        .ok {
          background: var(--leaf-tint);
          color: oklch(38% 0.12 145);
          border: 1px solid oklch(85% 0.08 145);
          padding: 14px;
          border-radius: var(--r-md);
        }
        .ok p { margin: 6px 0 0; }
        .hint { color: var(--ink-3); font-size: 11px; align-self: center; }
      </style>
    </section>
  `;
}
