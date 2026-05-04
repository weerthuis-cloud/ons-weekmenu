// v1.9: lokale negeer-lijst voor ingrediënten die je nooit op de boodschappen
// wil zien (water, zout, peper). Sleutels zijn lowercase + leestekens-strip
// (zelfde normalisatie als shopping.js). Persistent in localStorage.

const KEY = 'owm.ignored';

export function loadIgnored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

export function saveIgnored(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); }
  catch (e) { /* niet kritisch */ }
}

export function addIgnored(name) {
  const set = new Set(loadIgnored());
  set.add(name);
  saveIgnored(set);
}

export function removeIgnored(name) {
  const set = new Set(loadIgnored());
  set.delete(name);
  saveIgnored(set);
}

// onIgnoredChange listener-systeem zodat views auto-rerenderen bij wijziging
// vanuit een andere view (bv. Bibliotheek beheer).
const listeners = new Set();
export function onIgnoredChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function notifyIgnoredChange() { for (const cb of listeners) cb(); }
