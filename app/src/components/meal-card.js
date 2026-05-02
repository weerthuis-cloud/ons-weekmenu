// Hergebruikbare meal-card uit prototype. Sizes: sm (week-grid), md (build), lg (day).
import { html, nothing } from 'lit-html';
import { FoodPh } from './food-ph.js';
import { hueForSlot, chipForSlot, SLOT_VISUAL } from '../lib/cat.js';

const HEIGHTS = { sm: 78, md: 104, lg: 160 };

export function MealCard({ meal, size = 'md', onClick = null, showMacros = false, badge = null }) {
  if (!meal) return null;
  const hue = hueForSlot(meal.type) ?? 80;
  const chip = chipForSlot(meal.type);
  const slotLabel = SLOT_VISUAL[meal.type]?.korte ?? meal.type;
  const namePreview = (meal.name || '').toLowerCase().slice(0, 22);
  const fontSize = size === 'sm' ? 12 : size === 'md' ? 13 : 15;

  return html`
    <button
      class="mc"
      data-size=${size}
      @click=${onClick ?? (() => {})}
      ?disabled=${!onClick}
    >
      <div class="mc-img">
        ${FoodPh({ hue, label: `// ${namePreview}`, height: HEIGHTS[size] })}
        ${badge ? html`<span class="mc-badge">${badge}</span>` : nothing}
      </div>
      <div class="mc-meta">
        <span class="chip ${chip}">${slotLabel}</span>
        ${meal.bereidingstijd ? html`<span class="cmt">${meal.bereidingstijd}m</span>` : ''}
      </div>
      <div class="mc-name" style="font-size:${fontSize}px;">${meal.name}</div>
      ${showMacros && meal.kcal ? html`
        <div class="cmt mc-macros">
          ${meal.kcal} kcal${meal.eiwit_g ? ` · P${meal.eiwit_g}` : ''}${meal.koolh_g ? ` · K${meal.koolh_g}` : ''}${meal.vet_g ? ` · V${meal.vet_g}` : ''}
        </div>
      ` : nothing}
    </button>

    <style>
      .mc {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }
      .mc:disabled { cursor: default; }
      .mc:hover .mc-img { transform: translateY(-1px); }
      .mc-img { position: relative; transition: transform .15s ease; }
      .mc-badge {
        position: absolute; top: 8px; right: 8px;
        background: var(--leaf); color: white;
        font-size: 10px; font-weight: 700;
        padding: 3px 7px; border-radius: 999px;
      }
      .mc-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
      .mc-meta .chip { height: 20px; font-size: 11px; padding: 0 8px; }
      .mc-name { margin-top: 4px; font-weight: 600; line-height: 1.25; color: var(--ink); }
      .mc-macros { margin-top: 4px; font-size: 10px; }
    </style>
  `;
}
