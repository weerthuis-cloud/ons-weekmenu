// ISO-week en datum-utilities. Week 1 = de week met de eerste donderdag van het jaar.

export const DAGEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
export const DAGEN_KORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// ISO-weeknummer berekenen uit Date
export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// Maandag van een gegeven ISO week
export function isoWeekStart(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  return monday;
}

// Geeft alle 7 datums van een week-nr
export function weekDates(year, week) {
  const start = isoWeekStart(year, week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function formatDate(d) {
  return `${d.getUTCDate()} ${MAANDEN_KORT[d.getUTCMonth()]}`;
}

export function formatWeekRange(year, week) {
  const dates = weekDates(year, week);
  const first = dates[0];
  const last = dates[6];
  return `${formatDate(first)} t/m ${formatDate(last)} ${last.getUTCFullYear()}`;
}

// "Vandaag" = welk dag-nummer (1=ma .. 7=zo) in welke ISO-week
export function todayInfo() {
  const now = new Date();
  const { year, week } = getISOWeek(now);
  const dayNum = now.getDay() === 0 ? 7 : now.getDay(); // js: zo=0, wij: zo=7
  return { year, week, day: dayNum };
}
