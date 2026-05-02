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
      'fruit (diepvries)','fruit','groente','groente naar keuze',
    ],
  },
  {
    id: 'zuivel_eieren',
    label: 'Zuivel & eieren',
    hue: 85,
    keywords: [
      'ei','eieren','omelet',
      'kwark','yoghurt','griekse yoghurt','skyr','hüttenkäse','hüttenkase','huttenkase',
      'melk','halfvolle melk','volle melk','karnemelk','volle yoghurt','sojamelk','havermelk','amandelmelk',
      'kaas','geitenkaas','feta','mozzarella','parmezaan','parmezaanse kaas','brie','camembert','cheddar',
      'roomboter','boter','margarine','room','crème fraîche','creme fraiche','zure room','slagroom','kookroom','vla',
    ],
  },
  {
    id: 'brood_granen',
    label: 'Brood & granen',
    hue: 28,
    keywords: [
      'brood','boterham','bolletje','bolletjes','pistolet','wrap','wraps','pita','tortilla',
      'crackers','beschuit','knäckebröd','knackebrod','rijstwafel','rijstwafels',
      'havermout','muesli','granola','cornflakes',
      'rijst','basmati','jasmijn','sushi rijst','sushirijst','risotto','risottorijst',
      'pasta','spaghetti','penne','macaroni','lasagne','tagliatelle','farfalle','linzen','linzenpasta',
      'couscous','quinoa','bulgur','gerst','spelt','boekweit','meel','bloem','suiker',
    ],
  },
  {
    id: 'vlees_vis',
    label: 'Vlees & vis',
    hue: 0,
    keywords: [
      'kip','kippendij','kippendijen','kipfilet','kipreepjes','kalkoen',
      'rund','rundvlees','beef','biefstuk','rundergehakt','gehakt','tartaar','carpaccio',
      'varken','varkensvlees','speklap','kotelet','spareribs','bacon','spek',
      'lam','lamsvlees','wild','konijn',
      'salami','ham','vegaburger','tofu','tempeh','seitan',
      'zalm','tonijn','kabeljauw','schol','makreel','haring','garnalen','garnaal','mosselen','sardines',
      'vis','poelevlees','vleeswaren','vleesvervanger',
    ],
  },
  {
    id: 'kruiden_sausen',
    label: 'Kruiden & sausen',
    hue: 60,
    keywords: [
      'olijfolie','zonnebloemolie','sesamolie','olie','azijn','balsamico',
      'mosterd','mayonaise','ketchup','sambal','sojasaus','vissaus','pesto',
      'zout','peper','kruiden','peterselie','basilicum','dille','rozemarijn','tijm','oregano','laurier',
      'kaneel','nootmuskaat','kerrie','kerriepoeder','komijn','paprikapoeder','kurkuma','curry',
      'knoflookpoeder','uipoeder','suiker','vanille','vanillesuiker',
      'bouillon','groentebouillon','kippenbouillon','runderbouillon','kokosmelk',
    ],
  },
  {
    id: 'houdbaar',
    label: 'Houdbaar / kast',
    hue: 50,
    keywords: [
      'honing','siroop','jam','hagelslag','pindakaas','chocoladepasta','speculoospasta',
      'noten','noot','amandel','amandelen','walnoot','walnoten','cashew','cashewnoten','pistache','pinda','pindas',
      'zaden','zaad','lijnzaad','sesamzaad','chiazaad','pompoenpitten','zonnebloempitten',
      'rozijn','rozijnen','dadel','dadels','vijg gedroogd',
      'olijven','kappertjes','augurken','zilveruitjes','tomatenblokjes','tomatenpuree',
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
  // Sorteer keywords aflopend per lengte zodat 'blauwe bessen' eerder matched dan 'bessen' alleen.
  const tokens = n.split(/\s+/);
  for (let len = tokens.length; len > 0; len--) {
    for (let start = 0; start <= tokens.length - len; start++) {
      const phrase = tokens.slice(start, start + len).join(' ');
      if (KEYWORD_INDEX.has(phrase)) return KEYWORD_INDEX.get(phrase);
    }
  }

  return 'overig';
}

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
