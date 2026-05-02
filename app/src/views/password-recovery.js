// Wachtwoord-set-formulier na klikken op een password-recovery-mail-link.
import { html } from 'lit-html';
import { updatePassword, signOut } from '../lib/auth.js';

const ui = {
  pwd: '',
  pwd2: '',
  busy: false,
  done: false,
  error: null,
};

export function PasswordRecoveryView(state, actions, rerender) {
  async function submit(e) {
    e.preventDefault();
    if (ui.pwd !== ui.pwd2) {
      ui.error = 'Wachtwoorden komen niet overeen.';
      rerender();
      return;
    }
    ui.busy = true; ui.error = null; rerender();
    try {
      await updatePassword(ui.pwd);
      ui.done = true;
      ui.pwd = ''; ui.pwd2 = '';
    } catch (err) {
      ui.error = err.message || 'Kon wachtwoord niet wijzigen.';
    } finally {
      ui.busy = false;
      rerender();
    }
  }

  return html`
    <section class="auth-shell">
      <div class="auth-card card">
        <header class="auth-head">
          <h1 class="display">Nieuw wachtwoord</h1>
          <p class="lead">Kies een wachtwoord van minimaal 6 tekens. Daarna ben je ingelogd.</p>
        </header>

        ${ui.done ? html`
          <div class="ok">
            <strong>Wachtwoord opgeslagen.</strong>
            <p>Je wordt nu doorgestuurd naar de app.</p>
          </div>
        ` : html`
          <form @submit=${submit}>
            <label>
              <span>Wachtwoord</span>
              <input
                type="password"
                required
                minlength="6"
                autofocus
                .value=${ui.pwd}
                @input=${(e) => { ui.pwd = e.target.value; }}
                autocomplete="new-password"
              />
            </label>
            <label>
              <span>Herhaal wachtwoord</span>
              <input
                type="password"
                required
                minlength="6"
                .value=${ui.pwd2}
                @input=${(e) => { ui.pwd2 = e.target.value; }}
                autocomplete="new-password"
              />
            </label>

            ${ui.error ? html`<div class="err">${ui.error}</div>` : null}

            <button class="btn" type="submit" ?disabled=${ui.busy}>
              ${ui.busy ? 'Bezig…' : 'Opslaan en inloggen'}
            </button>
            <button type="button" class="btn ghost" @click=${() => signOut()}>annuleren</button>
          </form>
        `}
      </div>

      <style>
        .auth-shell { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: var(--pad); }
        .auth-card { max-width: 420px; width: 100%; display: flex; flex-direction: column; gap: 18px; }
        .auth-head h1 { font-size: 28px; }
        .lead { color: var(--ink-2); margin: 4px 0 0; }
        form { display: flex; flex-direction: column; gap: 14px; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--ink-2); }
        input { font: inherit; padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); }
        input:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
        .err { background: var(--tomato-tint); color: oklch(40% 0.14 28); border: 1px solid oklch(85% 0.08 28); padding: 10px 14px; border-radius: var(--r-md); font-size: 14px; }
        .ok { background: var(--leaf-tint); color: oklch(38% 0.12 145); border: 1px solid oklch(85% 0.08 145); padding: 14px; border-radius: var(--r-md); }
        .ok p { margin: 6px 0 0; }
      </style>
    </section>
  `;
}
