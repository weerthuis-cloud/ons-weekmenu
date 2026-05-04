// Categorie-classifier voor ingrediënten.
// Keyword-lookup op de genormaliseerde naam. Eerste match wint.
// Volgorde van categorieën = volgorde in de boodschappenlijst (logische supermarkt-route).

export const CATEGORIES = [
  {
    id: 'groente_fruit',
    label: 'Groente & fruit',
    hue: 145,
    keywords: [
      'mandarijn','appel','banaan','peer','sinaasappel','citroen','limoen',
      'aardbei','aardbeien','blauwe bes','blauwe bessen','blauwe bessen/frambozen','frambozen','framboos','bessen','bes',
      'bramen','druiven','meloen','ananas','mango','vijg','vijgen','perzik','nectarine','kiwi',
      'tomaat','komkommer','sla','rucola','spinazie','andijvie','paprika','courgette','aubergine',
      'pompoen','wortel','wortels','knoflook','ui','prei','sjalot','bleekselderij','selderij',
      'broccoli','bloemkool','spruitjes','sperziebonen','sperzieboon','snijbonen','boontjes',
      'asperges','radijs','rabarber','rabarber','avocado','olijven','dadel','vijgen',
      'champignons','paddenstoel','paddestoel','prei',
      'krulpeterselie','peterselie','bieslook','aspergebroccoli','zoete aardappel','zoete aardappelen','aardappel','aardappelen',
      'cherrytomaten','cherrytomaat','salade-ui','salade ui','boerenkool','mais','kidneybonen',
      'fruit (diepvries)','fruit','groente','groente naar keuze',
    ],
  },
  {
    id: 'zuivel_eieren',
    label: 'Zuivel & eieren',
    hue: 85,
    keywords: [
      'ei','eieren','omelet','roerei','gekookt ei','gebakken ei',
      'kwark','yoghurt','griekse yoghurt','skyr','hüttenkäse','hüttenkase','huttenkase','kefir',
      'melk','halfvolle melk','volle melk','karnemelk','volle yoghurt','sojamelk','havermelk','amandelmelk',
      'kookzuivel','zuivel',
      'kaas','geitenkaas','feta','mozzarella','parmezaan','parmezaanse kaas','brie','camembert','cheddar','witte kaas','geraspte kaas','geraspte belegen 30+ kaas','belegen kaas',
      'roomboter','boter','margarine','room','crème fraîche','creme fraiche','zure room','slagroom','kookroom','vla',
    ],
  },
  {
    id: 'brood_granen',
    label: 'Brood & granen',
    hue: 28,
    keywords: [
      'brood','boterham','bolletje','bolletjes','pistolet','wrap','wraps','pita','tortilla','tortillawraps','volkoren tortillawraps',
      'crackers','beschuit','knäckebröd','knackebrod','rijstwafel','rijstwafels',
      'havermout','muesli','granola','cornflakes',
      'rijst','basmatirijst','witte rijst','zilvervliesrijst','basmati','jasmijn','sushi rijst','sushirijst','risotto','risottorijst',
      'pasta','spaghetti','penne','volkoren penne','macaroni','macaroni-spaghettigroente','lasagne','tagliatelle','farfalle','mezzelune','linzen','linzenpasta',
      'couscous','quinoa','bulgur','gerst','spelt','boekweit','meel','bloem','suiker',
    ],
  },
  {
    id: 'vlees_vis',
    label: 'Vlees & vis',
    hue: 0,
    keywords: [
      'kip','kippendij','kippendijen','kipdijfilet','kipfilet','kipfiletreepjes','kipreepjes','kalkoen',
      'rund','rundvlees','beef','biefstuk','biefstukpuntjes','rundergehakt','gehakt','tartaar','carpaccio',
      'varken','varkensvlees','speklap','kotelet','spareribs','bacon','spek',
      'lam','lamsvlees','wild','konijn',
      'salami','ham','beleg','vega balletjes','vegaburger','tofu','tempeh','seitan',
      'zalm','tonijn','tonijnstukken','kabeljauw','schol','makreel','haring','garnalen','garnaal','mosselen','sardines',
      'vis','poelevlees','vleeswaren','vleesvervanger',
    ],
  },
  {
    id: 'kruiden_sausen',
    label: 'Kruiden & sausen',
    hue: 60,
    keywords: [
      'olijfolie','milde olijfolie','zonnebloemolie','sesamolie','olie','azijn','balsamico',
      'mosterd','mayonaise','ketchup','ketjap','ketjap manis','sambal','sojasaus','vissaus','pesto','verse groene pesto','picadillo','paloeloe','paloeloe smoorsaus','smoorsaus',
      'zout','peper','kruiden','basilicum','dille','rozemarijn','tijm','oregano','laurier','chilivlokken',
      'kaneel','nootmuskaat','kerrie','kerriepoeder','komijn','paprikapoeder','kurkuma','curry',
      'knoflookpoeder','uipoeder','vanille','vanillesuiker',
      'bouillon','bouillontablet','groentebouillon','kippenbouillon','kippenbouillontablet','runderbouillon','kokosmelk','kokosmelk light',
    ],
  },
  {
    id: 'houdbaar',
    label: 'Houdbaar / kast',
    hue: 50,
    keywords: [
      'honing','siroop','jam','hagelslag','pindakaas','chocoladepasta','speculoospasta',
      'noten','noot','amandel','amandelen','walnoot','walnoten','cashew','cashewnoten','pistache','pinda','pindas','pinda\'s','pecan','pecannoot','pecannoten','kokossnippers',
      'zaden','zaad','lijnzaad','sesamzaad','chiazaad','pompoenpitten','zonnebloempitten',
      'rozijn','rozijnen','dadel','dadels','vijg gedroogd',
      'olijven','zongerijpte olijven','kappertjes','augurken','zilveruitjes','tomatenblokjes','tomatenpuree','pomodorini',
    ],
  },
  {
    id: 'drank',
    label: 'Drank',
    hue: 200,
    keywords: [
      'water','spa','spa rood','bruisend water','thee','koffie','espresso',
      'sap','jus','sinaasappelsap','appelsap','smoothie',
      'wijn','witte wijn','rode wijn','rosé','bier','frisdrank','cola','sprite',
    ],
  },
  {
    id: 'overig',
    label: 'Overig',
    hue: 80,
    keywords: [], // catch-all
  },
];

const KEYWORD_INDEX = (() => {
  const m = new Map();
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) m.set(kw.toLowerCase(), cat.id);
  }
  return m;
})();

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/**
 * Classificeer ingrediënt-naam naar categorie-id.
 * Match op exacte normalized name, anders op het eerste woord, anders 'overig'.
 */
export function classifyIngredient(normalizedName) {
  if (!normalizedName) return 'overig';
  const n = normalizedName.toLowerCase().trim();

  // Exacte match
  if (KEYWORD_INDEX.has(n)) return KEYWORD_INDEX.get(n);

  // Probeer per woord (langste-keyword-eerst voor multi-word)
  const tokens = n.split(/\s+/);
  for (let len = tokens.length; len > 0; len--) {
    for (let start = 0; start <= tokens.length - len; start++) {
      const phrase = tokens.slice(start, start + len).join(' ');
      if (KEYWORD_INDEX.has(phrase)) return KEYWORD_INDEX.get(phrase);
    }
  }

  // Substring-fallback: lange keywords zoeken in samengestelde namen
  // ('basmatirijst' bevat 'basmatirijst', 'kookzuivel' bevat 'kookzuivel').
  // Sorteer keywords aflopend op lengte zodat specifiekere matches voorgaan.
  for (const kw of KEYWORD_BY_LENGTH) {
    if (kw.length < 4) continue;             // korte woorden geven false positives
    if (n.includes(kw)) return KEYWORD_INDEX.get(kw);
  }

  return 'overig';
}

// Keywords gesorteerd op lengte (langste eerst) voor substring-fallback.
const KEYWORD_BY_LENGTH = [...KEYWORD_INDEX.keys()].sort((a, b) => b.length - a.length);

export function categoryLabel(id) {
  return CATEGORY_BY_ID[id]?.label ?? 'Overig';
}

export function categoryHue(id) {
  return CATEGORY_BY_ID[id]?.hue ?? 80;
}

// Volgorde-index om sortering te garanderen
export function categoryOrder(id) {
  const i = CATEGORIES.findIndex(c => c.id === id);
  return i === -1 ? 999 : i;
}
