// App-shell v0.6: prototype-header met logo, nav-pills, persoon-toggle, uit-knop.
import { html } from 'lit-html';
import { ROUTES } from './router.js';
import { Logo } from './components/logo.js';
import { WeekView }     from './views/week.js';
import { DayView }      from './views/day.js';
import { ShoppingView } from './views/shopping.js';
import { LibraryView }  from './views/library.js';
import { BuildView }    from './views/build.js';
import { ImportView }   from './views/import.js';
import { todayInfo } from './lib/datums.js';

const VIEW_MAP = {
  week:    WeekView,
  dag:     DayView,
  lijst:   ShoppingView,
  archief: LibraryView,
  maker:   BuildView,
  import:  ImportView,
};

const NAV_ITEMS = [
  { id: 'week',    label: 'Week',         mobileShow: true  },
  { id: 'dag',     label: 'Vandaag',      mobileShow: true  },
  { id: 'lijst',   label: 'Boodschappen', mobileShow: true  },
  { id: 'archief', label: 'Bibliotheek',  mobileShow: false },
  { id: 'maker',   label: 'Stel zelf samen', mobileShow: false },
  { id: 'import',  label: 'Import',       mobileShow: false },
];

const PERSONEN = [
  { id: 'peter',   label: 'Peter',   color: 'berry' },
  { id: 'miranda', label: 'Miranda', color: 'plum'  },
  { id: 'beiden',  label: 'Beiden',  color: 'leaf'  },
];

export function Shell(state, actions) {
  const View = VIEW_MAP[state.route] || WeekView;
  const profile = state.auth.profile;
  const today = todayInfo();
  const initials = (profile?.naam || '?').slice(0, 2).toUpperCase();

  return html`
    <header class="topbar">
      <div class="brand">
        ${Logo({ size: 32 })}
        <h1 class="display brand-title">ons weekmenu</h1>
      </div>

      <nav class="nav-pills" aria-label="Schermen">
        ${NAV_ITEMS.map(i => html`
          <a href="#${i.id}"
             class="pill ${state.route === i.id ? 'is-on' : ''} ${i.mobileShow ? '' : 'desktop-only'}">${i.label}</a>
        `)}
      </nav>

      <div class="topbar-right">
        <span class="cmt week-info">// week ${today.week} · huishouden ${profile?.naam ?? '?'}</span>
        <div class="persoon-toggle" role="tablist" aria-label="Welk menu">
          ${PERSONEN.map(p => html`
            <button
              role="tab"
              class="chip ${p.color} ${state.persoon === p.id ? 'is-on' : ''}"
              aria-selected=${state.persoon === p.id}
              @click=${() => actions.setPersoon(p.id)}
            >${p.label}</button>
          `)}
        </div>
        <button class="avatar" @click=${actions.signOut} title="Uitloggen">${initials}</button>
      </div>
    </header>

    <main class="content">
      ${View(state, actions)}
    </main>

    <style>
      .topbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 28px;
        background: var(--bg);
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
      }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-title { font-size: 22px; letter-spacing: -0.03em; }

      .nav-pills {
        display: flex;
        gap: 4px;
        flex: 1;
        overflow-x: auto;
        padding: 0 4px;
      }
      .pill {
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-2);
        white-space: nowrap;
        transition: background .12s ease, color .12s ease;
      }
      .pill:hover { background: var(--bg-2); }
      .pill.is-on { background: var(--ink); color: var(--bg); }

      .topbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .week-info { white-space: nowrap; }

      .persoon-toggle { display: flex; gap: 4px; }
      .persoon-toggle .chip {
        cursor: pointer;
        height: 30px;
      }
      .persoon-toggle .chip.is-on { outline: 2px solid var(--ink); outline-offset: 1px; }

      .avatar {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: var(--mustard);
        color: var(--ink);
        font-weight: 700;
        font-size: 12px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform .12s ease;
      }
      .avatar:hover { transform: scale(1.05); }

      .content { flex: 1; }

      @media (max-width: 960px) {
        .week-info { display: none; }
      }
      @media (max-width: 720px) {
        .topbar { padding: 10px 14px; gap: 8px; }
        .brand-title { font-size: 18px; }
        .pill { padding: 6px 12px; font-size: 12px; }
        .persoon-toggle .chip { height: 26px; font-size: 11px; }
        .pill.desktop-only { display: none; }
      }
    </style>
  `;
}
