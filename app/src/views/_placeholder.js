// Hergebruikbare placeholder voor lege schermen tot ze gevuld worden.
import { html } from 'lit-html';

export function Placeholder({ titel, subtitel, vanafVersie, todo }) {
  return html`
    <section class="view">
      <header class="view-head">
        <h2 class="display">${titel}</h2>
        ${subtitel ? html`<p class="lead">${subtitel}</p>` : null}
      </header>

      <div class="card placeholder-card">
        <div class="ph-tag mono">komt in ${vanafVersie}</div>
        <ul class="todo">
          ${todo.map(t => html`<li>${t}</li>`)}
        </ul>
      </div>

      <style>
        .view { display: flex; flex-direction: column; gap: var(--gap); }
        .view-head { display: flex; flex-direction: column; gap: 4px; padding: 8px 0 4px; }
        .view-head h2 { font-size: 36px; }
        .lead { color: var(--ink-2); margin: 0; font-size: 15px; }
        .placeholder-card { display: flex; flex-direction: column; gap: 12px; }
        .ph-tag {
          display: inline-block;
          width: fit-content;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 6px;
          background: var(--mustard-tint);
          color: oklch(40% 0.1 85);
          border: 1px solid oklch(85% 0.08 85);
        }
        .todo { margin: 0; padding-left: 20px; color: var(--ink-2); }
        .todo li { margin: 4px 0; }
        @media (max-width: 640px) {
          .view-head h2 { font-size: 28px; }
        }
      </style>
    </section>
  `;
}
