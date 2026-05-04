// Monochrome SVG-iconen per slot. Volgen currentColor zodat ze in elke kleur renderen.
// Dag-cyclus: zonsopgang → middag → middag-snack → ondergang → maan.
import { html, svg } from 'lit-html';

const STROKE = 1.6;

// 24×24 viewbox, line-based, geen fill (behalve gevulde cirkel voor lunch-zenith)
const PATHS = {
  // Ontbijt — zon met stralen (klein, opkomend)
  ontbijt: svg`
    <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width=${STROKE} />
    <g stroke="currentColor" stroke-width=${STROKE} stroke-linecap="round">
      <line x1="12" y1="3"  x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="21" />
      <line x1="3"  y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="7.4" y2="7.4" />
      <line x1="16.6" y1="16.6" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="18.4" x2="7.4" y2="16.6" />
      <line x1="16.6" y1="7.4" x2="18.4" y2="5.6" />
    </g>
  `,

  // Snack ochtend — leeg klein vierkantje (à la sticky-note / herinnering)
  snack_ochtend: svg`
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width=${STROKE} />
    <line x1="9" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width=${STROKE} stroke-linecap="round" />
    <line x1="9" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width=${STROKE} stroke-linecap="round" />
  `,

  // Lunch — gevulde cirkel (zenith-zon, vol licht)
  lunch: svg`
    <circle cx="12" cy="12" r="6" fill="currentColor" />
  `,

  // Snack middag — driehoekje (drink / appel-stilering)
  snack_middag: svg`
    <path d="M12 5 L19 19 L5 19 Z" fill="none" stroke="currentColor" stroke-width=${STROKE} stroke-linejoin="round" />
  `,

  // Diner — halve maan (begin van de avond)
  diner: svg`
    <path d="M16 4 a 8 8 0 1 0 0 16 a 6 6 0 1 1 0 -16 z" fill="currentColor" />
  `,

  // Snack avond — kleine ster
  snack_avond: svg`
    <path d="M12 4 L13.6 10 L20 10 L14.8 13.6 L16.8 19.6 L12 16 L7.2 19.6 L9.2 13.6 L4 10 L10.4 10 Z"
      fill="none" stroke="currentColor" stroke-width=${STROKE} stroke-linejoin="round" />
  `,
};

export function SlotIcon({ slot, size = 18, color = 'currentColor' } = {}) {
  // v1.9c: ontbijt/lunch/tussendoor-iconen weggehaald (geen functie meer
  // naast de tekstlabels). Diner-icoon blijft staan tenzij anders gevraagd.
  if (slot !== 'diner') return null;
  const path = PATHS[slot];
  if (!path) return null;
  return html`
    <svg width=${size} height=${size} viewBox="0 0 24 24"
         style="color: ${color}; display: inline-block; vertical-align: middle;"
         aria-hidden="true">
      ${path}
    </svg>
  `;
}
