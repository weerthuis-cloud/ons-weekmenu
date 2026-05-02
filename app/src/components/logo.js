// Logo: 4 cirkels in een afgeronde donkere tegel (uit prototype).
import { html } from 'lit-html';

export function Logo({ size = 32 } = {}) {
  return html`
    <svg width=${size} height=${size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="9" fill="oklch(18% 0.02 60)" />
      <circle cx="11" cy="12" r="3" fill="var(--mustard)" />
      <circle cx="21" cy="12" r="3" fill="var(--leaf)" />
      <circle cx="11" cy="22" r="3" fill="var(--berry)" />
      <circle cx="21" cy="22" r="3" fill="var(--tomato)" />
    </svg>
  `;
}
