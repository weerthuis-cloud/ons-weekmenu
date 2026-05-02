// ons weekmenu — entry point v0.2
import { render } from 'lit-html';
import { Shell } from './shell.js';
import { LoginView } from './views/login.js';
import { OnboardingView } from './views/onboarding.js';
import { PasswordRecoveryView } from './views/password-recovery.js';
import { initRouter, getRoute } from './router.js';
import { initAuth, onAuthChange, getAuthState, signOut } from './lib/auth.js';
import { todayInfo } from './lib/datums.js';

const _today = todayInfo();

export const state = {
  route: getRoute(),
  persoon: localStorage.getItem('weekmenu.persoon') || 'beiden',
  density: localStorage.getItem('weekmenu.density') || 'comfortable',
  auth: getAuthState(), // referentie naar reactieve state
  // viewWeek = de week die actief in WeekView/DayView/ShoppingView wordt getoond.
  // Views updaten dit bij navigatie. Shell leest het voor de header-info.
  viewYear: _today.year,
  viewWeek: _today.week,
};

const root = document.getElementById('app');

export function rerender() {
  document.documentElement.dataset.density = state.density;
  const view = pickView();
  render(view, root);
}

function pickView() {
  switch (state.auth.status) {
    case 'loading':
      return loadingView();
    case 'recovery':
      return PasswordRecoveryView(state, actions, rerender);
    case 'anonymous':
    case 'denied':
      return LoginView(state, actions, rerender);
    case 'needs_onboarding':
      return OnboardingView(state, actions, rerender);
    case 'ready':
      return Shell(state, actions);
    default:
      return loadingView();
  }
}

function loadingView() {
  // Minimal: voorkomt flash van login-scherm tijdens session-restore.
  return null;
}

export const actions = {
  setPersoon(p) {
    state.persoon = p;
    localStorage.setItem('weekmenu.persoon', p);
    rerender();
  },
  setDensity(d) {
    state.density = d;
    localStorage.setItem('weekmenu.density', d);
    rerender();
  },
  setViewWeek(year, week) {
    state.viewYear = year;
    state.viewWeek = week;
    rerender();
  },
  signOut() {
    signOut();
  },
};

initRouter((route) => {
  state.route = route;
  rerender();
});

onAuthChange((auth) => {
  state.auth = auth;
  // Eerste keer dat we ingelogd zijn met een eigen profile: maak die persoon de default.
  if (auth.status === 'ready' && auth.profile && state.persoon === 'beiden') {
    // Niet automatisch overschrijven na eerste keuze; alleen op verse start (geen localStorage-key).
    if (!localStorage.getItem('weekmenu.persoon-set')) {
      state.persoon = auth.profile.slug;
      localStorage.setItem('weekmenu.persoon', auth.profile.slug);
      localStorage.setItem('weekmenu.persoon-set', '1');
    }
  }
  rerender();
});

initAuth();
rerender();
