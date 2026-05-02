// Gestreepte placeholder voor maaltijd-foto. Hue stuurt de kleur.
import { html } from 'lit-html';
import { styleMap } from 'lit-html/directives/style-map.js';

export function FoodPh({ hue = 80, label = null, height = 120, radius = 14, style = {} }) {
  const styles = {
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
    '--ph-stripe-a': `oklch(92% 0.05 ${hue})`,
    '--ph-stripe-b': `oklch(86% 0.09 ${hue})`,
    ...style,
  };
  return html`
    <div class="ph" style=${styleMap(styles)}>
      ${label ? html`<span class="ph-label">${label}</span>` : ''}
    </div>
  `;
}
