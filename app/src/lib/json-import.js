// JSON-import helper. Definieert het verwachte formaat en valideert.
// Peter dropt een PDF in Claude, vraagt om JSON in dit formaat, plakt in de app.

import { SLOTS } from './slots.js';

const VALID_SLOTS = SLOTS.map(s => s.id);
const VALID_SOURCES = ['dietist', 'eigen'];
const VALID_SLUGS  = ['peter', 'miranda'];

/**
 * Valideer + normaliseer JSON-input.
 * @returns {{ ok: true, data } | { ok: false, error: string }}
 */
export function parseJsonImport(jsonString) {
  let raw;
  try { raw = JSON.parse(jsonString); }
  catch (e) { return { ok: false, error: 'Ongeldige JSON: ' + e.message }; }

  if (!raw || typeof raw !== 'object') return { ok: false, error: 'JSON moet een object zijn.' };

  const year   = parseInt(raw.year, 10);
  const week   = parseInt(raw.week, 10);
  const owner  = String(raw.owner || '').toLowerCase();
  const source = String(raw.source || 'dietist').toLowerCase();

  if (!Number.isInteger(year) || year < 2024 || year > 2030) return { ok: false, error: 'year moet 2024-2030 zijn' };
  if (!Number.isInteger(week) || week < 1 || week > 53)      return { ok: false, error: 'week moet 1-53 zijn' };
  if (!VALID_SLUGS.includes(owner))                          return { ok: false, error: `owner moet "peter" of "miranda" zijn (kreeg "${owner}")` };
  if (!VALID_SOURCES.includes(source))                       return { ok: false, error: `source moet "dietist" of "eigen" zijn` };

  if (!Array.isArray(raw.entries)) return { ok: false, error: 'entries moet een array zijn' };

  const entries = [];
  const seen = new Set();
  for (let i = 0; i < raw.entries.length; i++) {
    const e = raw.entries[i];
    const day = parseInt(e.day, 10);
    const slot = String(e.slot || '').toLowerCase();
    const name = String(e.name || '').trim();

    if (!Number.isInteger(day) || day < 1 || day > 7) return { ok: false, error: `entry ${i}: day moet 1-7 zijn (kreeg ${e.day})` };
    if (!VALID_SLOTS.includes(slot))                  return { ok: false, error: `entry ${i}: slot moet één van ${VALID_SLOTS.join(', ')} zijn (kreeg "${slot}")` };
    if (!name)                                        return { ok: false, error: `entry ${i}: name verplicht` };

    const key = `${day}-${slot}`;
    if (seen.has(key)) return { ok: false, error: `dubbele entry voor day ${day}, slot ${slot}` };
    seen.add(key);

    const ingredients = Array.isArray(e.ingredients)
      ? e.ingredients
          .filter(ing => ing && typeof ing.name === 'string' && ing.name.trim())
          .map(ing => ({
            name: String(ing.name).trim(),
            qty:  ing.qty == null || ing.qty === '' ? null : Number(ing.qty),
            unit: String(ing.unit || ''),
            store: String(ing.store || ''),
          }))
      : [];

    entries.push({
      day,
      slot,
      name,
      kcal: e.kcal == null ? null : parseInt(e.kcal, 10),
      ingredients,
      suitableFor: [owner],
    });
  }

  return {
    ok: true,
    data: { year, week, owner, source, entries },
  };
}

// Genereer een prompt-template die Peter aan Claude kan geven.
// Bevat ons exacte JSON-schema + instructie om de PDF te lezen.
export function claudePromptTemplate({ ownerSlug = 'peter', defaultSource = 'dietist' } = {}) {
  return `Lees de PDF die ik upload (een wekelijks voedingsschema van mijn diëtist) en geef het terug als JSON in exact dit formaat. Geef alleen de JSON, geen uitleg.

Schema:
{
  "year": 2026,
  "week": <ISO-weeknummer uit de PDF, bv. 19>,
  "owner": "${ownerSlug}",
  "source": "${defaultSource}",
  "entries": [
    {
      "day": 1,                    // 1=maandag .. 7=zondag
      "slot": "ontbijt",           // ontbijt | snack_ochtend | lunch | snack_middag | diner | snack_avond
      "name": "<korte gerecht-naam>",
      "ingredients": [
        { "name": "Honing (rauwe)", "qty": 10, "unit": "g" },
        { "name": "Blauwe bessen/frambozen", "qty": 100, "unit": "g" }
      ]
    }
    // ... één entry per niet-lege cel in het schema
  ]
}

Regels:
- Sla lege cellen ("-" of helemaal leeg) over.
- Mapping van slot-namen: "Ontbijt" → ontbijt, "Tussendoor 1" → snack_ochtend, "Lunch" → lunch, "Tussendoor 2" → snack_middag, "Avondeten" of "Diner" → diner, "Tussendoor 3" → snack_avond.
- Voor diner: alleen de gerecht-naam, geen ingredients (recepten staan in de bijlage).
- Voor andere slots: vul ingredients met name + qty + unit. Geldige units: g, kg, ml, l, st, el, tl. Voor "stuks", "plakje", "sneetjes" gebruik "st". Voor "onbeperkt" of "naar keuze": laat qty leeg of weg.
- name is een korte beschrijvende titel (bv. "Kwark met bessen en honing", niet "Ontbijt maandag").

Geef de complete JSON terug, geldig en parseable.`;
}
