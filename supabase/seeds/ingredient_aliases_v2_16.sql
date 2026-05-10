-- v2.16 seed: canonical-mapping voor de tier 1+2 stamingrediënten
-- (keys die in ≥5 actieve diner-recepten voorkomen, peilmoment mei 2026).
-- raw_key is wat shopping.normalizeName() teruggeeft.
-- canonical_key = NULL => ingredient overslaan in zoek (parser-vuiltje).
-- Long-tail keys (1-4 recepten) zitten bewust niet in de seed; die krijgen
-- via de fallback gewoon de raw_key terug.

INSERT INTO public.ingredient_aliases (raw_key, canonical_key) VALUES
-- olie / vet
('olijfolie',                'olijfolie'),
('milde olijfolie',          'olijfolie'),
('extra vierge olijfolie',   'olijfolie'),
('zonnebloemolie',           'zonnebloemolie'),
('neutrale olie',            'neutrale olie'),
('arachideolie',             'neutrale olie'),
('sesamolie',                'sesamolie'),

-- boter
('boter',                    'boter'),
('roomboter',                'boter'),
('ongezouten roomboter',     'boter'),
('g boter',                  'boter'),
('g roomboter',              'boter'),

-- ui
('ui',                       'ui'),
('uien',                     'ui'),
('rode ui',                  'ui'),
('rode uien',                'ui'),
('middelgrote uien',         'ui'),
('bosuien',                  'bosui'),
('sjalotten',                'sjalot'),

-- knoflook
('knoflook',                 'knoflook'),
('teentjes knoflook',        'knoflook'),
('teentje knoflook',         'knoflook'),

-- peper / zout (komen automatisch in pantry van de zoek-laag)
('peper en zout',            'peper en zout'),
('zout en peper',            'peper en zout'),
('zout',                     'zout'),
('peper',                    'peper'),

-- kruiden
('gedroogde oregano',        'oregano'),
('verse basilicum',          'basilicum'),
('koriander',                'koriander'),
('verse koriander',          'koriander'),
('gemalen komijn',           'komijn'),
('laurierblaadjes',          'laurier'),
('tijm',                     'tijm'),
('rozemarijn',               'rozemarijn'),
('peterselie',               'peterselie'),
('bieslook',                 'bieslook'),
('venkelzaad',               'venkelzaad'),
('kerriepoeder',             'kerriepoeder'),
('chilivlokken',             'chilivlokken'),

-- tomaat
('tomaten',                  'tomaat'),
('tomatenpuree',             'tomatenpuree'),

-- aardappel
('aardappels',               'aardappel'),
('kruimige aardappelen',     'aardappel'),

-- paprika
('rode paprika',             'paprika'),
('gele paprika',             'paprika'),

-- wortel
('wortel',                   'wortel'),
('winterpeen',               'wortel'),

-- losse groente
('komkommer',                'komkommer'),
('broccoli',                 'broccoli'),
('courgette',                'courgette'),
('prei',                     'prei'),
('avocado',                  'avocado'),
('spinazie',                 'spinazie'),
('verse spinazie',           'spinazie'),
('gember',                   'gember'),
('cm gember',                'gember'),
('rode peper',               'rode peper'),
('diepvries tuinerwten',     'tuinerwt'),
('g spruitjes',              'spruitje'),
('stengels bleekselderij',   'bleekselderij'),

-- citrus
('citroen',                  'citroen'),
('citroenen',                'citroen'),
('biologische citroen',      'citroen'),
('limoen',                   'limoen'),

-- ei
('ei',                       'ei'),
('eieren',                   'ei'),

-- vlees
('kipfilet',                 'kipfilet'),
('rundergehakt',             'rundergehakt'),

-- granen / pasta / rijst
('bloem',                    'bloem'),
('penne',                    'penne'),
('witte rijst',              'rijst'),

-- zuivel
('crème fraîche',            'crème fraîche'),
('parmezaanse kaas',         'parmezaanse kaas'),
('mozzarella',               'mozzarella'),
('slagroom',                 'slagroom'),
('melk',                     'melk'),
('volle melk',               'melk'),
('kokosmelk',                'kokosmelk'),
('griekse yoghurt',          'yoghurt'),

-- saus / zuur / vocht
('sojasaus',                 'sojasaus'),
('ketjap manis',             'ketjap manis'),
('kippenbouillon',           'bouillon'),
('groentebouillon',          'bouillon'),
('runderbouillon',           'bouillon'),
('rijstazijn',               'rijstazijn'),
('witte wijnazijn',          'wijnazijn'),
('rode wijn',                'rode wijn'),
('mayonaise',                'mayonaise'),
('mosterd',                  'mosterd'),
('kappertjes',               'kappertjes'),
('suiker',                   'suiker'),
('honing',                   'honing'),

-- noten / zaden
('pijnboompitten',           'pijnboompitten'),

-- water (in pantry van de zoek-laag)
('water',                    'water'),

-- niet-ingredient: parser-vuiltje, expliciet skippen in zoek
('keukenmachine',            NULL)

ON CONFLICT (raw_key) DO UPDATE
  SET canonical_key = EXCLUDED.canonical_key,
      source        = EXCLUDED.source;
