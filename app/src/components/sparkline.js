// SVG sparkline voor kcal-trend over een week. Uit prototype.
import { html, svg } from 'lit-html';

export function Sparkline({ data = [], labels = [], highlightIndex = -1, width = 200, height = 70 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => [i * step, height - (v / max) * height * 0.85 - 4]);
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  return html`
    <svg width=${width} height=${height + 16} viewBox=${`0 0 ${width} ${height + 16}`}>
      <path d=${path} stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${points.map((p, i) => svg`
        <circle cx=${p[0]} cy=${p[1]} r=${i === highlightIndex ? 4 : 2.5}
          fill=${i === highlightIndex ? 'var(--tomato)' : 'var(--ink)'} />
      `)}
      ${labels.map((label, i) => svg`
        <text x=${points[i][0]} y=${height + 12}
              text-anchor="middle" font-family="JetBrains Mono"
              font-size="9" fill="var(--ink-3)">${label}</text>
      `)}
    </svg>
  `;
}
