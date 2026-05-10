// v2.17: pantry-default voor de restjes-zoeker.
//
// Pantry-items worden uit de score-noemer gehaald: ze tellen niet mee als
// "vereist" want ze staan altijd in huis. Een recept dat alleen pantry plus
// 'kip' vraagt en je hebt 'kip' opgegeven → 100% match (niet 50% omdat boter
// ook in het recept staat).
//
// Lijst is hardcoded in v2.17. Toekomst (v2.18+): per profile aanpasbaar.

export const PANTRY = new Set([
  'water',
  'zout',
  'peper',
  'peper en zout',
  'zout en peper',
  'olijfolie',
  'zonnebloemolie',
  'neutrale olie',
  'sesamolie',
  'boter',
  'bloem',
  'suiker',
]);

export function isPantry(canonicalKey) {
  if (!canonicalKey) return false;
  return PANTRY.has(canonicalKey);
}
