// Hash-router. Werkt op GitHub Pages zonder server-rewrites.
// Routes: 'week' (default), 'dag', 'lijst', 'archief', 'maker', 'import'

export const ROUTES = ['week', 'dag', 'lijst', 'archief', 'maker', 'import'];

export function getRoute() {
  const hash = (location.hash || '#week').slice(1);
  return ROUTES.includes(hash) ? hash : 'week';
}

export function setRoute(route) {
  if (!ROUTES.includes(route)) return;
  if (location.hash.slice(1) !== route) location.hash = route;
}

export function initRouter(onChange) {
  window.addEventListener('hashchange', () => onChange(getRoute()));
}
