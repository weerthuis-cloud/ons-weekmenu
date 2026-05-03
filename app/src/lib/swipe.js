// Horizontale swipe-navigatie tussen routes. Alleen actief op mobile.
// Gebruik: installSwipeNavigation(element, { routes: ['week','dag','lijst'] })

const H_THRESHOLD = 60;   // min. horizontale beweging in pixels
const V_LIMIT = 40;       // max. verticale drift (anders is het scroll-poging)
const MOBILE_MAX = 720;   // viewport-breedte waar swipe actief is

// Skip swipe als de touch start in een van deze elementen — voorkomt conflict
// met scrollbare lijsten, formulieren, knoppen die er zelf actie op willen.
const SKIP_SELECTOR = [
  'input', 'textarea', 'select', 'button',
  '.modal-backdrop', '.modal',           // detail-modal e.d.
  '.dp-chips', '.dp-chip',                // diner-chips
  '.qty-edit-btn', '.qty-edit-input',
  '.notes-panel',
  '.recipe-actions',
  '[data-no-swipe]',
].join(',');

export function installSwipeNavigation(element, { routes, getCurrent, setRoute }) {
  if (!element || !routes?.length) return () => {};

  let startX = 0, startY = 0, startTime = 0, active = false;

  function onStart(e) {
    if (window.innerWidth > MOBILE_MAX) { active = false; return; }
    const t = e.touches?.[0];
    if (!t) return;
    if (e.target.closest && e.target.closest(SKIP_SELECTOR)) { active = false; return; }
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    active = true;
  }

  function onEnd(e) {
    if (!active) return;
    active = false;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dy) > V_LIMIT) return;            // te veel verticale drift
    if (Math.abs(dx) < H_THRESHOLD) return;        // te weinig horizontaal
    if (Date.now() - startTime > 600) return;      // te traag, geen swipe

    const cur = getCurrent();
    const idx = routes.indexOf(cur);
    if (idx < 0) return;

    let next = idx;
    if (dx < 0) next = Math.min(routes.length - 1, idx + 1);   // swipe-links → volgende
    else        next = Math.max(0, idx - 1);                    // swipe-rechts → vorige
    if (next === idx) return;

    setRoute(routes[next]);
  }

  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchend',   onEnd,   { passive: true });
  element.addEventListener('touchcancel', () => { active = false; }, { passive: true });

  return function uninstall() {
    element.removeEventListener('touchstart', onStart);
    element.removeEventListener('touchend',   onEnd);
  };
}
