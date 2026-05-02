// Gekleurde checkbox (uit prototype).
import { html, nothing } from 'lit-html';

export function Checkbox({ checked = false, hue = 80, onClick = null, size = 20 }) {
  const stroke = checked ? `oklch(60% 0.16 ${hue})` : 'var(--line-2)';
  const fill   = checked ? `oklch(60% 0.16 ${hue})` : 'transparent';
  return html`
    <button
      type="button"
      class="cb"
      style="width:${size}px;height:${size}px;border-color:${stroke};background:${fill};"
      @click=${(e) => { e.stopPropagation(); onClick?.(); }}
      aria-checked=${checked}
      role="checkbox"
    >
      ${checked ? html`
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M2 5.5 L4.5 8 L9 3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      ` : nothing}
    </button>

    <style>
      .cb {
        border-style: solid;
        border-width: 1.5px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }
    </style>
  `;
}
