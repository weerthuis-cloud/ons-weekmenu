// Pure helpers voor het recepten-paneel. Eerste stap van de refactor (v1.7 #4):
// alleen utilities zonder state-dependencies hier; render-functies en
// state-mutators blijven nog in views/shopping.js tot een dedicated v1.8-pass.

// Dag-kleuren voor recepten-tracking (oklch hue per dag-index 1-7).
export const DAY_HUE = { 1: 280, 2: 145, 3: 28, 4: 85, 5: 350, 6: 50, 7: 175 };

export function dayColor(day) {
  return `oklch(70% 0.16 ${DAY_HUE[day] || 240})`;
}

// Een recept is 'incompleet' als serves of ingredients ontbreken.
// Gebruikt voor de waarschuwingsbadge in het recepten-paneel.
export function isRecipeIncomplete(meal) {
  if (!meal) return false;
  return !(Number(meal.serves) > 0) || !(meal.ingredients?.length > 0);
}

// Inline SVG voor het 'in huis'-knopje. Pure render-helper.
import { html } from 'lit-html';
export function houseIcon() {
  return html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v10h14V10"/></svg>`;
}
