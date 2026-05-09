// Hergebruikbare meal-card uit prototype. Sizes: sm (week-grid), md (build), lg (day).
import { html, nothing } from 'lit-html';
import { FoodPh } from './food-ph.js';
import { hueForSlot, chipForSlot, SLOT_VISUAL } from '../lib/cat.js';

const HEIGHTS = { sm: 78, md: 104, lg: 160 };

export function MealCard({ meal, size = 'md', onClick = null, showMacros = false, badge = null, onToggleFavoriet = null }) {
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
      <div class="mc-img" style="height:${HEIGHTS[size]}px;">
        <div class="mc-fallback">${FoodPh({ hue, label: `// ${namePreview}`, height: HEIGHTS[size] })}</div>
        ${meal.image_url ? html`
          <img class="mc-photo" src=${meal.image_url} alt=${meal.name}
            loading="lazy" referrerpolicy="no-referrer"
            @error=${(e) => { e.target.style.display = 'none'; }}
            @load=${(e) => { e.target.style.opacity = '1'; }}
          />
        ` : nothing}
        ${badge ? html`<span class="mc-badge">${badge}</span>` : nothing}
        ${onToggleFavoriet ? html`
          <span class="mc-fav ${meal.favoriet ? 'is-on' : ''}"
            title=${meal.favoriet ? 'Favoriet — klik om te verwijderen' : 'Markeer als favoriet'}
            @click=${(e) => { e.stopPropagation(); onToggleFavoriet(meal); }}>
            ${meal.favoriet ? '★' : '☆'}
          </span>
        ` : nothing}
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
      .mc-img {
        position: relative;
        transition: transform .15s ease;
        border-radius: var(--r-md, 8px);
        overflow: hidden;
        background: var(--bg-2);
      }
      .mc-fallback {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
      }
      .mc-photo {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        background: var(--bg-2);
        opacity: 0;
        transition: opacity .25s ease;
      }
      .mc-badge {
        position: absolute; top: 8px; right: 8px;
        background: var(--leaf); color: white;
        font-size: 10px; font-weight: 700;
        padding: 3px 7px; border-radius: 999px;
      }
      .mc-fav {
        position: absolute; top: 6px; left: 8px;
        font-size: 18px; line-height: 1;
        cursor: pointer; user-select: none;
        color: oklch(70% 0.04 60);
        text-shadow: 0 1px 2px oklch(0% 0 0 / 0.3);
        transition: color .15s ease, transform .15s ease;
      }
      .mc-fav:hover { transform: scale(1.2); color: oklch(75% 0.18 70); }
      .mc-fav.is-on { color: oklch(72% 0.16 70); }
      .mc-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
      .mc-meta .chip { height: 20px; font-size: 11px; padding: 0 8px; }
      .mc-name { margin-top: 4px; font-weight: 600; line-height: 1.25; color: var(--ink); }
      .mc-macros { margin-top: 4px; font-size: 10px; }
    </style>
  `;
}
