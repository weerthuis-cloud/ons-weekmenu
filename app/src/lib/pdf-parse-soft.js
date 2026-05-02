// Best-effort cel-extractie uit een diëtist-PDF (HTY-format en variaties).
// Doel: per (dag, slot) een ruwe tekst-suggestie geven die de gebruiker kan corrigeren.
// Geen aannames over exact format; faalt zacht als headers niet gevonden worden.

const DAGEN = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];

// Tokens die als slot-label tellen in de label-kolom van de PDF.
const SLOT_LABEL_TOKENS = ['Ontbijt', 'Lunch', 'Avondeten', 'Tussendoor', 'Diner'];

// Verwachte volgorde van slot-id's, top→bottom in een diëtist-PDF.
const SLOT_ID_ORDER = ['ontbijt','snack_ochtend','lunch','snack_middag','diner','snack_avond'];

function findDayColumns(items) {
  // Vind X-positie van iedere dag-header
  const cols = {};
  for (const it of items) {
    if (DAGEN.includes(it.text)) cols[it.text] = it.x;
  }
  return cols;
}

// Bereken kolom-grenzen aannemende dat dag-headers GECENTREERD boven hun cel staan.
// Cel-grens = midpoint tussen 2 opeenvolgende headers; eerste cel-links = header - halve gem-breedte.
function computeColRanges(columns) {
  const dayList = DAGEN.filter(d => columns[d] != null);
  if (dayList.length < 2) return {};
  const xs = dayList.map(d => columns[d]);
  const diffs = [];
  for (let i = 0; i < xs.length - 1; i++) diffs.push(xs[i + 1] - xs[i]);
  const avgW = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const ranges = {};
  for (let i = 0; i < dayList.length; i++) {
    const left  = i === 0 ? xs[i] - avgW / 2 : (xs[i - 1] + xs[i]) / 2;
    const right = i === xs.length - 1 ? xs[i] + avgW / 2 : (xs[i] + xs[i + 1]) / 2;
    ranges[dayList[i]] = [left, right];
  }
  return ranges;
}

function findSlotRows(items) {
  // Label-kolom = items vóór de linkergrens van de eerste dag-cel.
  const dayCols = findDayColumns(items);
  const colRanges = computeColRanges(dayCols);
  const firstDay = DAGEN.find(d => colRanges[d]);
  const labelMaxX = firstDay ? colRanges[firstDay][0] - 2 : Infinity;

  // Verzamel alle label-tokens (Ontbijt, Lunch, Avondeten, Tussendoor) in de label-kolom.
  // 'Tussendoor' en zijn nummer (1/2/3) staan op verschillende y-coords; we negeren het nummer
  // en gebruiken alleen de positie van 'Tussendoor' om de rij te bepalen.
  const found = items
    .filter(it => it.x < labelMaxX && SLOT_LABEL_TOKENS.includes(it.text))
    .map(it => ({ y: it.y, label: it.text }))
    .sort((a, b) => a.y - b.y);

  // Map in volgorde naar SLOT_ID_ORDER. Verwacht: [Ontbijt, Tussendoor, Lunch, Tussendoor, Avondeten, Tussendoor].
  const slots = [];
  for (let i = 0; i < found.length && i < SLOT_ID_ORDER.length; i++) {
    slots.push({ id: SLOT_ID_ORDER[i], y: found[i].y, label: found[i].label });
  }
  return slots;
}

function detectWeekNumber(items) {
  // Zoek "W 19" of "week 19" in de header
  for (const it of items) {
    const m = it.text.match(/^[Ww]\s*(\d{1,2})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 53) return n;
    }
  }
  // Fallback: zoek 'week X' in adjacent items
  for (let i = 0; i < items.length - 1; i++) {
    if (/week/i.test(items[i].text)) {
      const m = items[i + 1].text.match(/(\d{1,2})/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 53) return n;
      }
    }
  }
  return null;
}

function detectName(items) {
  // Zoek "Hey, Peter" of "voor Peter"
  for (let i = 0; i < items.length - 1; i++) {
    if (items[i].text === 'Hey,' || items[i].text === 'voor') {
      return items[i + 1].text.replace(/[,.!?]$/, '');
    }
  }
  return null;
}

/**
 * @returns {{
 *   weekNumber: number|null,
 *   ownerName: string|null,
 *   columns: Record<dag, x>,
 *   slots: Array<{id, y}>,
 *   cells: Record<dag, Record<slotId, string>>  // ruwe cel-tekst, regels gescheiden door \n
 * }}
 */
export function parseDietPdf(extracted) {
  const allItems = extracted.pages.flatMap(p => p.items);
  const weekNumber = detectWeekNumber(allItems);
  const ownerName = detectName(allItems);
  const columns = findDayColumns(allItems);
  const slots = findSlotRows(allItems);

  // Cel-X-grenzen: dag-headers staan GECENTREERD boven hun cel.
  const colRanges = computeColRanges(columns);
  const dayList = DAGEN.filter(d => colRanges[d]);

  // Slot Y-grenzen
  slots.sort((a, b) => a.y - b.y);
  const slotRanges = {};
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const y0 = s.y;
    const y1 = i + 1 < slots.length ? slots[i + 1].y : Infinity;
    slotRanges[s.id] = [y0, y1];
  }

  // Verzamel woorden per cel
  const cells = {};
  for (const d of dayList) cells[d] = {};
  for (const slot of slots) {
    const [y0, y1] = slotRanges[slot.id];
    for (const d of dayList) {
      const [x0, x1] = colRanges[d];
      // Kleine marge: x0 - 2 om woorden net binnen kolom te vangen
      const inCell = allItems.filter(it =>
        it.x >= x0 - 2 && it.x < x1 - 2 && it.y >= y0 - 2 && it.y < y1 - 2
      );
      // Sorteer per regel (y dan x), groepeer regels
      inCell.sort((a, b) => (Math.round(a.y) - Math.round(b.y)) || (a.x - b.x));
      const lines = [];
      let cur = null;
      for (const it of inCell) {
        if (cur && Math.abs(it.y - cur.y) < 4) cur.tokens.push(it.text);
        else { cur = { y: it.y, tokens: [it.text] }; lines.push(cur); }
      }
      const text = lines.map(l => l.tokens.join(' ')).join('\n').trim();
      cells[d][slot.id] = text;
    }
  }

  return { weekNumber, ownerName, columns: colRanges, slots: slotRanges, cells };
}

// Snel: geef een suggestie voor maaltijd-naam o.b.v. cel-tekst.
// Voor diner: voeg alle regels samen (gerecht-naam staat op meerdere regels in de PDF).
// Voor andere slots: synthetiseer "ing1, ing2, ing3" uit eerste niet-qty regels.
const QTY_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|stuks?|stuk|el|tl|plakje|sneetjes|sneetje)\s*$/i;
const VOOR_QTY_RE = /^voor\s+\d+\s+(stuks?|stuk|sneetjes?|sneetje)/i;

export function suggestMealName(rawText, slotId) {
  if (!rawText) return '';
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const nonQty = lines.filter(l => !QTY_RE.test(l) && !VOOR_QTY_RE.test(l) && l !== '-' && l !== 'onbeperkt');
  if (nonQty.length === 0) return '';

  // Diner: gerecht-naam staat over meerdere regels in de cel ("Kip kerrie met\nbroccoli en rijst").
  if (slotId === 'diner') {
    return nonQty.join(' ').replace(/\s+/g, ' ').slice(0, 120);
  }

  // Tussendoor / Ontbijt / Lunch: synthetiseer naam uit eerste 3 ingrediënt-namen.
  if (nonQty.length === 1) return nonQty[0].slice(0, 80);
  return nonQty.slice(0, 3).join(', ').slice(0, 80);
}

// Pak ingrediënten uit cel: per regel zoek naar (naam, qty)
export function suggestIngredients(rawText) {
  if (!rawText) return [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    // Probeer "Naam ... 100 g" of "100 g Naam" patterns
    const tailMatch = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|stuks?|stuk|el|tl|plakje|sneetjes|sneetje)$/i);
    const headMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|stuks?|stuk|el|tl|plakje|sneetjes|sneetje)\s+(.+)$/i);
    if (tailMatch) {
      result.push({ name: tailMatch[1].trim(), qty: Number(tailMatch[2].replace(',', '.')), unit: normalizeUnit(tailMatch[3]) });
    } else if (headMatch) {
      result.push({ name: headMatch[3].trim(), qty: Number(headMatch[1].replace(',', '.')), unit: normalizeUnit(headMatch[2]) });
    } else if (line === '-' || line === 'onbeperkt') {
      // skip
    } else if (!QTY_RE.test(line)) {
      // Naam zonder qty
      result.push({ name: line, qty: null, unit: '' });
    }
  }
  return result;
}

function normalizeUnit(u) {
  const x = u.toLowerCase();
  if (x === 'kg') return 'kg';
  if (x === 'l')  return 'l';
  if (x === 'g')  return 'g';
  if (x === 'ml') return 'ml';
  if (x.startsWith('stuk')) return 'st';
  if (x === 'el') return 'el';
  if (x === 'tl') return 'tl';
  if (x === 'plakje') return 'st';
  if (x.startsWith('sneetje')) return 'st';
  return '';
}
