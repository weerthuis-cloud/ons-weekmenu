import { html } from 'lit-html';
import { signInWithPassword, sendPasswordReset } from '../lib/auth.js';

const ui = {
  email: '',
  password: '',
  busy: false,
  mode: 'login',          // 'login' | 'reset'
  resetSent: false,
  error: null,
};

export function LoginView(state, actions, rerender) {
  async function submit(e) {
    e.preventDefault();
    ui.busy = true;
    ui.error = null;
    rerender();
    try {
      if (ui.mode === 'login') {
        await signInWithPassword(ui.email, ui.password);
        // Bij succes: onAuthChange → Shell verschijnt; geen extra UI nodig.
      } else {
        await sendPasswordReset(ui.email);
        ui.resetSent = true;
      }
    } catch (err) {
      ui.error = err.message || 'Onbekende fout.';
    } finally {
      ui.busy = false;
      rerender();
    }
  }

  function switchMode(next) {
    ui.mode = next;
    ui.error = null;
    ui.resetSent = false;
    rerender();
  }

  const isReset = ui.mode === 'reset';

  return html`
    <section class="auth-shell">
      <div class="auth-card card">
        <header class="auth-head">
          <h1 class="display">ons weekmenu</h1>
          <p class="lead">${isReset ? 'Vul je e-mail in. Je krijgt een mail om je wachtwoord opnieuw in te stellen.' : 'Log in met je e-mail en wachtwoord.'}</p>
        </header>

        ${ui.resetSent ? html`
          <div class="ok">
            <strong>Mail onderweg.</strong>
            <p>Check je inbox op <span class="mono">${ui.email}</span> en klik op de link om een nieuw wachtwoord te kiezen.</p>
          </div>
          <button class="btn ghost" @click=${() => switchMode('login')}>← terug naar inloggen</button>
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
                autocomplete="username"
              />
            </label>

            ${!isReset ? html`
              <label>
                <span>Wachtwoord</span>
                <input
                  type="password"
                  required
                  .value=${ui.password}
                  @input=${(e) => { ui.password = e.target.value; }}
                  autocomplete="current-password"
                  minlength="6"
                />
              </label>
            ` : ''}

            ${ui.error ? html`<div class="err">${ui.error}</div>` : null}

            <button class="btn" type="submit" ?disabled=${ui.busy}>
              ${ui.busy ? 'Bezig…' : (isReset ? 'Stuur reset-mail' : 'Inloggen')}
            </button>

            <div class="links">
              ${isReset
                ? html`<button type="button" class="linkbtn" @click=${() => switchMode('login')}>← inloggen</button>`
                : html`<button type="button" class="linkbtn" @click=${() => switchMode('reset')}>wachtwoord vergeten?</button>`}
            </div>
          </form>
        `}

        <footer class="hint mono">v1.0 • alleen toegestane e-mails</footer>
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
        .links { display: flex; justify-content: center; }
        .linkbtn {
          background: transparent; border: none;
          color: var(--ink-2); font: inherit; font-size: 13px;
          cursor: pointer; text-decoration: underline;
        }
        .linkbtn:hover { color: var(--ink); }
        .hint { color: var(--ink-3); font-size: 11px; align-self: center; }
      </style>
    </section>
  `;
}
