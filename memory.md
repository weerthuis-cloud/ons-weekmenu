# memory.md — projectlogboek "ons weekmenu"

Chronologisch logboek van beslissingen, redenering en lessen. Elke nieuwe versie krijgt een eigen blok.

---

## 2026-05-01 — start v0.1

**Context.** Peter en Miranda krijgen wekelijks een menu van de dietist. Doel: tool om dat in te voeren, te bekijken (week/dag), boodschappen te genereren, archief op te bouwen, en eigen menu's samen te stellen met filters.

**Bestaand prototype.** `Weekmenu Prototype _standalone_.html` is een gebundeld React+Babel design-prototype binnen een Figma-achtige canvas. Niet werkend, wel uitgewerkt qua flow en visuele taal. Hergebruikt voor v1.0:
- Design tokens (oklch-palet, fonts Bricolage Grotesque + Inter + JetBrains Mono).
- Schermenset (week, dag, boodschappen, archief, maker, import).
- Datavorm voor MEALS/WEEK/SHOPPING/LIBRARY.

Niet hergebruikt: React, het canvas-frame, de iOS-mock. Te zwaar voor productie.

**Beslissingen.**

1. **Framework: Vite + vanilla JS + lit-html.** React zou consistent zijn met het prototype, maar voegt gewicht toe dat we niet nodig hebben. Pure HTML/JS zonder build wordt rommelig zodra er routing en herbruikbare templates komen. Lit-html is klein (~5KB), template-only, geen virtual DOM, en past bij Peters voorkeur "geen frameworks tenzij gevraagd" (lit-html is een rendering library, geen framework).

2. **Twee aparte accounts (peter, miranda) met gedeelde leesrechten.** Geeft helder onderscheid bij invoer en audit-trail per actie. Magic-link auth via Supabase. Alternatief was één gedeeld account met UI-toggle, maar dat verliest "wie heeft wat ingevoerd".

3. **Gedeelde maaltijdpool met `suitable_for[]`.** Maximaal hergebruik. Veel maaltijden zullen voor beiden geschikt zijn (of met kleine variaties); dubbele bibliotheken kosten dubbel onderhoud.

4. **Hash-router.** Werkt zonder server-rewrites op GitHub Pages. Refresh blijft op de juiste pagina staan.

5. **PDF-parse client-side via pdf.js.** PDF van dietist bevat bijzondere persoonsgegevens (gezondheidsdata). Mag de browser niet uit. Vereist eigen parser voor het format van deze dietist (voorbeeld-PDF nodig in v0.6).

6. **Persoon-kleuren.** Peter = berry (blauwpaars), Miranda = plum (roze-paars), Beiden = leaf (groen). Komen uit de tint-set van het prototype.

**Wat ik bewust uitstel.**
- Donkere modus (v0.5 of later).
- Drag-and-drop bij maker (v0.5).
- "Wat heb ik in huis"-state (v0.5+).
- Eigen Google Fonts hosten (v1.0 indien AVG-streng).

**Vraagpunten voor latere versies.**
- Wil Miranda een eigen e-mailadres voor magic-link, of werkt het ook met één gedeeld?
- Welke supermarkt-categorisering willen we (per winkel of per gang)?
- Print-layout voor boodschappenlijst (A4 of compact mobiel?).
- Aantal eters per maaltijd (1, 2, varieert)? Wordt belangrijk voor schalen van ingrediënten.

---

## 2026-05-01 — v0.2 Supabase + auth

**Gedaan.**
- Supabase-project `ons-weekmenu` (id `domorqjzpaytpitvloeg`) aangemaakt in eu-central-1 (Frankfurt). Free tier, $0/maand.
- Schema toegepast (5 tabellen, RLS aan, alle policies). `get_advisors` security: 0 lints.
- Aparte `profiles self insert`-policy toegevoegd voor onboarding-flow.
- Code: `lib/supabase.js` (client + ALLOWED_EMAILS), `lib/auth.js` (state-machine: loading/anonymous/needs_onboarding/ready/denied), `views/login.js` (magic link), `views/onboarding.js` (Peter/Miranda kiezen).
- `main.js` herschreven als auth-router boven content-router.
- `.env.local` aangemaakt (niet in git), `.env.example` als sjabloon.

**Beslissingen.**

1. **Schoolprojectsplit.** Supabase-project per use-case, niet één megaproject. Schoolprojecten en huishoudprojecten strikt gescheiden, ook al zit alles onder dezelfde organisatie. AVG én eigen regel "leerlingdata blijft binnen schoolinfrastructuur".

2. **eu-central-1 (Frankfurt) i.p.v. eu-west-2 (UK).** Strikte EU-positie voor gezondheidsdata, ook al heeft UK een adequacy decision. Bewuste afwijking van Peters bestaande projecten.

3. **Free tier limiet 2 projecten.** Peter heeft `docentenplanner` verwijderd om ruimte te maken. `mondeling-ksh` ging direct daarna in INACTIVE-status (waarschijnlijk auto-pauzering bij free tier inactiviteit). Geen actie ondernomen, maar opgemerkt.

4. **Onboarding-flow met self-insert i.p.v. seed.** Nieuwe gebruiker kiest na eerste login zelf "Peter" of "Miranda". RLS-policy `profiles self insert` met `auth.uid() = id` zorgt dat je alleen je eigen rij kan maken. Slug-uniciteit zorgt dat er nooit twee 'peter' kunnen bestaan.

5. **Allowlist als soft check + dashboard-disable als strikte check.** `ALLOWED_EMAILS` in client-code is een eerste filter. Strikte beveiliging: signups in Supabase dashboard uitzetten zodra Peter en Miranda zijn ingelogd. Twee-laagse verdediging.

6. **Persoon-default = eigen profile bij eerste keer.** Bij eerste 'ready'-status: zet `state.persoon` op de slug van het profile, in plaats van standaard 'beiden'. Daarna respecteert de app handmatige keuze van de gebruiker (via een localStorage-flag `persoon-set`).

**Loopt nog.**
- Peters allowlist staat correct (`weerthuis@gmail.com`); Miranda's e-mail nog niet bekend.
- Signups disable in dashboard moet pas na haar eerste login.

**Volgende: v0.3** — handmatige menu-invoer, week- en dagweergave werkend.

---

## 2026-05-01 — v0.3 handmatige invoer + week- en dagweergave

**Gedaan.**
- DB-migratie: slot-check uitgebreid van 4 naar 6 (`ontbijt`, `snack_ochtend`, `lunch`, `snack_middag`, `diner`, `snack_avond`). Zelfde set in `meals.type` zodat een maaltijd weet voor welk slot ze bedoeld is.
- Datalaag: `lib/data.js` (cache + invalidate per write, listProfiles/listMeals/getWeek/addWeek/getWeekMeals/setWeekMeal/removeWeekMeal), `lib/datums.js` (ISO-week, weekDates, formatWeekRange), `lib/slots.js` (volgorde + labels + emoji's).
- Component `meal-picker`: modal met zoek over bestaande meals + inline "nieuwe maaltijd"-formulier.
- Views: WeekView (7×6 grid), DayView (1 dag, 6 slots, navigatie). 'Beiden'-view: één rooster met P/M-badges per cel.
- Build slaagt, 64 modules, 251 KB / 66 KB gzipped. Security advisors: 0 lints.

**Beslissingen.**

1. **Zes slots per dag op verzoek van Peter.** Diëtisten geven vaak 2-3 tussendoortjes voor stabiele bloedsuiker. Slot-namen: `snack_ochtend`, `snack_middag`, `snack_avond` (met underscore voor DB-vriendelijkheid).

2. **'Beiden'-weergave: één rooster met P/M-badges**, niet twee kolommen naast elkaar. Compacter, en omdat Peter en Miranda waarschijnlijk veel overlap hebben in maaltijden, zorgt dit voor minder herhaling op het scherm.

3. **Inline maaltijd-aanmaken vanuit slot-context.** Geen aparte "Maaltijden"-tab in v0.3. Bij klik op leeg slot opent meal-picker met zoekveld + "+ nieuwe maaltijd" knop. Type wordt vooraf ingevuld op basis van het slot.

4. **Cache met handmatige invalidate.** Geen reactieve query library. Data.js notificeert listeners bij writes; views herladen op `onDataChange`. Simpel, voldoende voor twee personen.

5. **Upsert via delete + insert** in `setWeekMeal` om ON CONFLICT-perikelen met composite unique key te vermijden.

**Niet gedaan, bewust uitgesteld.**
- Porties-invoer (kolom bestaat in DB, default 1.0) — komt in v0.4 als de boodschappenlijst dit nodig heeft.
- Aparte "Maaltijden"-tab voor CRUD op de hele bibliotheek — komt in v0.5 (Maker).
- Macros-toggle in WeekView — komt in v0.4 of v0.5.
- Dragging maaltijden tussen dagen — komt in v0.5.
- Mobile-accordions per dag in WeekView — voor nu gebruikt de mobile-versie hetzelfde grid met kleinere tekst. Voldoet, kan later beter.

**Vraagpunten voor latere versies.**
- Overschrijven of waarschuwen bij vervangen van een meal? Nu: stille vervang.
- Wat is de juiste UX om een hele week te kopiëren of dupliceren? (relevant voor v0.5)
- Print-layout van DayView voor op de koelkast?

---

## 2026-05-01 — v0.4 boodschappenlijst

**Gedaan.**
- Constants: `lib/units.js` (g/kg/ml/l/st/el/tl/snufje/naar smaak met basis-eenheid voor aggregatie), `lib/winkels.js` (AH/Jumbo/Plus/Lidl/Aldi/markt/bio/anders).
- Meal-picker uitgebreid: ingrediënten als rij-tabel met naam + qty + unit-dropdown + store-dropdown. + en × om rijen te beheren.
- `lib/shopping.js`: `aggregateShopping(mealsByOwner, modus)` voegt ingrediënten samen op (naam, unit-base, winkel), sommeert qty × porties, houdt `who[]` bij. `groupByStore` voor weergave.
- `lib/data.js` + 4 helpers voor shopping_lists CRUD.
- ShoppingView herschreven: modus-toggle (huishouden/peter/miranda) + week-nav + genereer/vernieuw + items per winkel + afvinken (optimistisch) + print-CSS.
- DB-migratie: shopping_lists nu shared-readable + shared-updateable tussen ingelogde users (zie beslissing 2 hieronder).

**Verificatie.** Build 67 modules, 264 KB / 70 KB gzipped. Security advisors: 0 lints. Aggregatie-unittest in node bevestigt: 50g + 50g + 0.5kg × 2 porties = 1100g havermout, correct gegroepeerd.

**Beslissingen.**

1. **Beide modi: huishouden + per persoon.** Toggle bovenin ShoppingView. 'Huishouden' is default omdat samen winkelen het normale geval is. Per-persoon is voor uitzonderingen (Miranda gaat alleen, Peter is langs een andere winkel).

2. **shopping_lists shared-access tussen ingelogde users.** RLS aangepast: alle ingelogde users mogen lezen + items updaten (afvinken). Insert + delete blijft eigendom van de aanmaker. Reden: als Miranda in de winkel is en iets afvinkt op haar telefoon, moet Peter dat ook zien op zijn laptop. Geen privacy-risico, items zijn alleen "boterham, kaas, ...".

3. **Optimistisch UI bij afvinken.** Vink wordt direct getoond, daarna pas DB-update. Bij fout: error-message en re-render. Geen 'loading'-flicker.

4. **Aggregatie-key = (naam-lower + unit-base + winkel).** Unit-base zorgt dat `kg` en `g` bij elkaar optellen, `l` en `ml` ook. Winkel-as-key zorgt dat je 200g havermout AH en 200g havermout Jumbo gescheiden ziet.

5. **Behoud van checked-status bij vernieuwen.** `generateOrRefresh` bewaart de checked-status van bestaande items op basis van hun key. Voorkomt dat al gewinkelde items opnieuw moeten worden aangevinkt na een week-update.

6. **Print-stijl ingebakken in component.** `@media print` verbergt de toggle-bar en navigatie, maakt typografie compacter. Browser-native print, geen extra library.

**Niet gedaan, bewust uitgesteld.**
- Multi-week selectie (v0.5: "boodschappen voor week 18+19").
- Categorisering binnen winkel (groenten/zuivel/etc.) — nu alleen per winkel-naam.
- Bewerken van geaggregeerde items (qty aanpassen, items toevoegen). Nu: alleen afvinken/lijst-vernieuwen.
- Suggestie van standaard-units per ingrediënt-naam (bv. tomaat → standaard 'st' of 'g').

**Vraagpunten voor latere versies.**
- Wil Peter qty in geaggregeerde lijst kunnen handmatig aanpassen?
- Volgorde-keuze: alfabetisch of "loop-volgorde door de winkel"?
- Shoppinglijst per dag in plaats van per week (voor verse boodschappen)?

---

## 2026-05-01 — v0.5 archief + maker

**Gedaan.**
- Migratie: `meals.deleted_at timestamptz` + index (soft-delete).
- `lib/data.js`: listMeals krijgt `includeDeleted`-flag (default false), updateMeal, softDeleteMeal, listWeeks, countSlotsByWeek, duplicateWeekMeals.
- Meal-picker uitgebreid: 'edit'-modus (laad bestaande data, update via updateMeal), verwijder-knop (rode ghost) met bevestigings-dialog. Aparte `openMealCreator` voor toevoegen vanuit Maker zonder slot-context. `openMealEditor` voor bewerken vanuit Maker.
- Week-view: `gotoWeek(year, week)` export voor navigatie vanuit Library.
- LibraryView herschreven: lijst per persoon (peter/miranda/beiden), per week jaar+weeknr+datum-range+bron-tag+aantal-slots-gevuld. "open" → springt naar WeekView op die week. "dupliceer" → modal met doel-jaar+weeknr → kopieert week_meals naar nieuwe of bestaande week (bestaande wordt overschreven).
- BuildView herschreven: filter-toolbar (zoek op naam/ingrediënt, slot-type, suitable_for, max-kcal, tag) + grid van meal-cards. Klik op kaart → openMealEditor.
- Verificatie: build 67 modules, 280 KB / 73 KB gzipped. Security advisors 0 lints.

**Beslissingen.**

1. **Soft-delete via `deleted_at`-kolom.** Per Peters keuze. Verwijderde maaltijden verdwijnen uit bibliotheek + meal-picker, blijven zichtbaar in oude weken (week_meals.meal_id blijft geldig). Vereiste een schema-wijziging (kolom + index) maar is netter dan FK-cascade en behoudt historie.

2. **listMeals filter standaard op `deleted_at is null`.** Bij week_meals join via getWeekMeals filteren we niet (dus oude weken blijven zichtbaar). Cache wordt apart bijgehouden voor "alleen actief" (gebruikt door bibliotheek + picker).

3. **duplicate overschrijft bestaande doel-week.** Praktisch: je dupliceert meestal naar een toekomstige (lege) week, maar als die niet leeg is wordt hij overschreven na waarschuwing. Geen merge-logica.

4. **Maker = aparte view, geen sub-tab van Archief.** Ze gaan over verschillende dingen: archief = weken, maker = maaltijden-pool. Behouden het mentale model uit het prototype.

5. **Filters in Maker zijn allemaal optioneel + 'wis filters' verschijnt zodra je iets gebruikt.** Geen apart "filter aan/uit" maar progressief disclosure.

6. **Klik op meal-card opent meteen edit-modal**, geen aparte detailpagina. Past bij compacte UX.

**Niet gedaan, bewust uitgesteld.**
- "Vul deze week automatisch"-functie. Te complex voor v0.5; pas overwegen na v0.6.
- Multi-week selectie in Boodschappen.
- Ingredient-suggesties op basis van naam (bv. "tomaat" → standaard 'st').
- Zoeken in archief op gerecht (zit nu in Maker via ingrediënt-zoek; voor archief laat ik het pas zien als Peter er om vraagt).

**Vraagpunten voor latere versies.**
- Hoe vaak wordt 'dupliceer' gebruikt in praktijk? Als nooit: misschien vervangen door 'kopie naar volgende week'-snelknop.
- Tags-bewerking is nu niet mogelijk (geen UI). Toevoegen aan meal-editor?

---

## 2026-05-01 — v0.6 polish-pass

**Aanleiding.** Peter merkte op dat de implementatie tot v0.5 functioneel was maar visueel ver afweek van het prototype. Bewust gekozen voor functie-eerst, zonder dit te bespreken — fout. Polish-pass voor alle 5 views.

**Hotfix vooraf.** Bij stoom-test van v0.5 werd Chrome vastgelopen door een infinite-loop bug: alle views deden `queueMicrotask(loadAll)` binnen render zonder beveiliging tegen herhaling. loadAll triggerde rerender → nieuwe queueMicrotask → loop. Fix: de queueMicrotask-call eenmalig in `ensureInit()` plaatsen (binnen `if (vs.initialized) return`-guard).

**Sandbox-leerpunt.** Vite build werkt niet meer in mijn sandbox nadat Peter `npm install` op Mac uitvoerde — verschillende platform-binaries voor rollup. Vanaf nu doe ik in sandbox alleen syntax-check en import-resolutie; build doet Peter lokaal.

**Gedaan.**
- `lib/cat.js`: slot → kleurchip-mapping (ontbijt=mustard, lunch=leaf, diner=tomato, snacks=leaf/plum/berry) + emoji's + standaard-tijden.
- `styles/base.css`: FoodPh-classes, `.cmt` mono-comment-class, `.view-wrap` container.
- 5 herbruikbare components: `food-ph`, `meal-card` (sm/md/lg), `checkbox` (gekleurd vinkje), `sparkline` (SVG kcal-trend), `logo`.
- Shell: prototype-header met logo, ronde nav-pills, persoon-toggle als chips + avatar-button voor uitloggen.
- WeekView: hero strip met zwarte seizoens-card + 2 stat-cards (sparkline + boodschappen-cta) + 7-kolom grid met mini-meal-cards.
- DayView: day-picker als horizontale chips bovenin + 1.6fr/1fr layout met FoodPh-rows en mustard kcal-card.
- ShoppingView: 4-kolom hero (totaal | afgevinkt + progress | modus | acties) + winkel-filter chips + card-grid met gekleurde Checkbox.
- BuildView: 320px sticky filter-rail (zoek + slot-segmented + suitable-chips + kcal-slider met aan/uit + seizoen-2x2 + tags) + meal-grid met MealCard.
- LibraryView: mosaic preview-cards met 3 FoodPh-tegels per week, klikbaar voor open + dupliceer.
- ImportView: tijdelijke "v0.7"-placeholder met cmt-stijl.

**Beslissingen.**

1. **Snacks krijgen subtielere chip-kleuren** dan hoofdmaaltijden, met aparte hues (ochtend=leaf, middag=plum, avond=berry). Het prototype had alleen 3 hoofdmaaltijden; deze uitbreiding houdt de visuele hiërarchie helder.

2. **Ron getallen en mono-comments overal**. Het "// commentaar"-pattern uit het prototype is nu een `.cmt`-class die overal wordt hergebruikt (header-info, kaart-labels, etc.). Geeft de app consistente "design-document"-feel.

3. **Geen fictieve data tonen**. Het prototype had hardcoded "Lente, weinig vlees" en "diëtist Lotte Bakker". Wij tonen wat er feitelijk is (week-nr, gevulde slots, gem-kcal alleen bij data). Hero blijft visueel maar niet leugenachtig.

4. **DayView toont alle 6 slots, ook bij 'beiden'**. Voor 'beiden' worden Peter en Miranda als aparte rijen onder elkaar getoond per slot. Ruim, helder, geen verwarring.

5. **WeekView toont alle 6 slots als compacte mini-cards**, geen aparte snack-rij. Past beter bij de strakke 7-kolom grid van het prototype.

6. **Sandbox-build losgelaten**. Build-verificatie doet Peter lokaal; ik doe alleen syntax + imports + DB-advisors.

**Niet gedaan, bewust uitgesteld.**
- "Wat heb ik in huis"-chips in BuildView (vereist voorraad-tabel of localStorage-state) — v0.7+.
- Match-badges op meal-cards in BuildView ("+3 match") — afhankelijk van voorraad-feature.
- Tabbar-segment voor breakfast/lunch/dinner in BuildView (we hebben 6 slots, segmented control vond ik visueel druk; vervangen door slot-emoji-row in filter-rail).
- Eigen Google Fonts hosten (AVG-improve voor v1.0).

---

## 2026-05-01 — v0.7a PDF-import

**Aanleiding.** Peter leverde een echte diëtist-PDF aan (HTY PT, week 19). Sandbox-analyse met pdfplumber liet zien dat full-auto cell-detection fragiel is (5 van 6 rijen detected, dag-kolomgrenzen overlappen). Pdf.js in browser is nog primitiever. Daarom v0.7 gesplitst in:
- **v0.7a** (deze versie): upload + best-effort cel-extractie + handmatige edit-grid + opslaan + PDF-archief.
- **v0.7b** (later): tabular auto-parser na meer voorbeeld-PDF's.

**Gedaan.**
- Storage bucket `dietist-pdfs` (private, max 10 MB, alleen PDF, alleen ingelogde users) via apply_migration.
- `pdfjs-dist` toegevoegd aan dependencies (Peter moet `npm install` draaien).
- `lib/pdf-extract.js`: pdf.js wrapper met Vite-vriendelijke worker-import. Geeft per pagina een lijst items met x/y/text.
- `lib/pdf-parse-soft.js`: best-effort parser. Detecteert week-nummer (W 19 / week 1), eigenaar-naam (Hey, Peter), dag-kolommen (Maandag-Zondag), slot-rijen (Ontbijt/Tussendoor 1-3/Lunch/Avondeten), en groepeert items per cel. Helpers `suggestMealName` (eerste niet-qty regel) en `suggestIngredients` (regex op "naam qty unit"-patterns).
- `lib/data.js`: `importWeek` (bulk-insert van meals + week_meals), `uploadDietistPdf` (storage), `getPdfDownloadUrl` (signed URL).
- `views/import.js`: drop-zone + parse-spinner + 7×6 edit-grid met checkbox + naam-input + ruwe-tekst-details per cel + meta-bar (persoon, jaar, week, bron, PDF-bewaren) + import-knop.

**Slot-mapping in parser:**
- Ontbijt → ontbijt
- Tussendoor 1 → snack_ochtend
- Lunch → lunch
- Tussendoor 2 → snack_middag
- Avondeten → diner
- Tussendoor 3 → snack_avond

**Beslissingen.**

1. **Best-effort + handmatige correctie i.p.v. perfect parser.** Eerlijk over de fragiliteit. De gebruiker krijgt suggesties ZIET ruwe tekst per cel, kan corrigeren. Sneller te bouwen, robuuster.

2. **Per import: nieuwe meal-rows, geen dedupe op naam.** Behoudt import-historie. Dedupe kan later in v0.8.

3. **Suitable_for = [ownerSlug]** bij import. Een PDF is voor één persoon (Peter of Miranda); maaltijden krijgen die tag automatisch. Beiden-tag moet handmatig.

4. **PDF-bewaren is opt-in maar default ON.** Voor referentie. AVG: gezondheidsdata, blijft binnen Supabase EU + jullie twee accounts.

5. **importWeek wist bestaande week_meals voor de gespecifieerde slots** voordat insert. Voorkomt duplicaten als je een week opnieuw importeert.

**Niet gedaan / volgt in v0.7b.**
- Auto-cel-grenzen via tabular layout-detection.
- Fuzzy-match tegen bestaande meals-bibliotheek (i.p.v. nieuwe meals aanmaken).
- Voorvertoning-rendering met FoodPh + chips.
- PDF-viewer in app voor referentie (download link via signed URL).

**Vraagpunten voor v0.7b.**
- Hoe vaak wijkt jullie diëtist's PDF-format af? (Bepaalt of een rigide parser zin heeft.)
- Wil je bij import ook automatisch een snel-check op kcal-totaal per dag?

---

## 2026-05-02 — v0.7a-plus 'Plak JSON' route

**Aanleiding.** Praktijktest van pdf.js auto-parser was rommelig vanaf woensdag (qty-kolom van vorige dag overlapt met naam-kolom van volgende dag). In dezelfde sessie heb ik Peters PDF voor week 19 als bewijs direct via Supabase-MCP geïmporteerd (met handmatige meal-namen + ingrediënten) — accuraat in 5 minuten. Peter koos: bouw een 'Plak JSON' route in de app zodat hij hetzelfde elke week zelf kan doen.

**Workflow voor Peter (per week):**
1. Open Claude (web/mobiel/Cowork), upload diëtist-PDF + plak prompt-template uit app.
2. Claude geeft JSON in het schema dat de app verwacht.
3. Plak JSON in Import-tab van app → "Controleer JSON →" → preview → "Importeer week →".

**Gedaan.**
- `lib/json-import.js`: validator + normalizer voor JSON-payload. Schema: `{ year, week, owner, source, entries: [{day, slot, name, kcal?, ingredients?}] }`. Strict op slug, slot-id, day 1-7, week 1-53, year 2024-2030.
- `claudePromptTemplate(opts)`: prompt-template met schema, slot-mapping (Tussendoor 1/2/3 → snack_ochtend/middag/avond, Avondeten → diner), regels (geen ingredients voor diner, valid units, "onbeperkt" → null).
- `views/import.js`: tab-switch "PDF uploaden" / "Plak JSON". JSON-mode heeft mustard prompt-bar met "Kopieer prompt"-knop, textarea, parse-knop, voorvertoningskaart (persoon/week/source + lijst entries), import-knop. Hergebruikt bestaande `importWeek` functie.

**Bewezen tijdens deze sessie:** Claude (in dezelfde chat-sessie via MCP) heeft Peters PDF feilloos in 28 maaltijden voor week 19 gestructureerd opgeslagen. Inclusief:
- 4 unieke ontbijten (Kwark+bessen+honing variaties + Shake + Omelet + Pistolet+ei)
- 4 unieke lunches
- 7 unieke gerechten voor diner (geen ingredients, naam alleen)
- Snack-avond per dag (Ei/Noten/Yoghurt)

**Beslissingen.**

1. **JSON-route is parallel aan PDF-route, niet een vervanging.** Privacy-bewust pdf.js blijft default; JSON is opt-in voor wie de Claude-route prefereert. Tab-switch maakt het expliciet.

2. **Prompt-template embed slot-mapping en regels.** Verkleint kans op format-fouten van Claude. Peter hoeft alleen "kopieer + plak" te doen.

3. **JSON-validatie strikt.** Alle invariants worden gecheckt voor de DB-call. Foutmeldingen in NL.

4. **suitable_for = [owner]** automatisch (uit JSON.owner). Geen handmatige stap.

5. **Geen PDF-storage in JSON-route.** Bij JSON heb je geen file lokaal. Wie dat wil, gebruikt PDF-tab.

**AVG-overweging gedocumenteerd.** Voor JSON-route: PDF gaat naar Claude (Anthropic, US/EU). Voor pdf.js-route: PDF blijft client-side. Peter heeft geïnformeerd akkoord gegeven voor zijn persoonlijk huishouden — voor schoolprojecten zou dit strikt verboden zijn.

---

## 2026-05-02 — v0.7b en v1.0

**v0.7b: routine bevestigd, JSON-route weggehaald.** Praktijktest in deze sessie maakte duidelijk dat de **Cowork-route** veruit het snelst is voor wekelijkse PDF-import: Peter dropt PDF in chat → ik parse + schrijf direct in Supabase via MCP → klaar in 2 minuten. De "Plak JSON"-tab in de Import-view is overbodig en weggehaald. Backup blijft pdf.js client-side (best-effort, met handmatige correctie). `lib/json-import.js` is verlaten code geworden — door Peter handmatig verwijderd.

**v1.0: deploy naar GitHub Pages.**

**Gedaan.**
- `ALLOWED_EMAILS` verplaatst van hardcoded array naar `VITE_ALLOWED_EMAILS` env-var (komma-gescheiden). Voorkomt e-mailadres-leak in publieke repo.
- `vite.config.js`: `base = '/ons-weekmenu/'` in production, `'/'` in dev.
- `.github/workflows/deploy.yml`: GitHub Actions workflow die bij push naar main `npm ci` + `npm run build` draait met env-vars uit Secrets en publisht via `actions/deploy-pages@v4`.
- `.gitignore` in repo-root: sluit `node_modules/`, `dist/`, `.env.local`, `*.pdf`, prototype-extract en sandbox-artefacten uit.
- README uitgebreid met deploy-stappen (5 manuele stappen voor Peter, 1 push start de eerste deploy) en eindafgevinkte AVG-tabel.

**Beslissingen.**

1. **Public repo + env-vars**, niet private + GitHub Pro. Code is goedkope informatie; secrets zitten in env-vars die via GitHub Secrets bij build worden geïnjecteerd. Niets in code dat schade kan doen bij inzage.

2. **GitHub Actions, niet `npm run deploy` lokaal.** Reproduceerbare deploys, geen lokale build nodig, automatische cache-invalidation. Trade-off: setup duurt eenmalig 5 min langer.

3. **Hash-router betekent geen 404-fallback nodig.** GitHub Pages serveert `index.html`, hash-route bepaalt zelf welke view er rendert. Refresh op `/dag#dag` blijft werken.

4. **Geen custom domain in v1.0.** Github.io-URL is genoeg voor familie-gebruik. Custom domain kan later toegevoegd worden zonder code-wijzigingen (alleen GitHub Pages settings + DNS).

5. **AVG-tabel afgevinkt.** Vier opmerkelijke punten:
   - Bijzondere persoonsgegevens worden opgeslagen in Supabase EU (Frankfurt), achter RLS, alleen toegankelijk voor de twee accounts. Voldoet aan dataminimalisatie.
   - LLM-aanroepen zijn **opt-in**: alleen bij vrijwillige Cowork-import gaat een PDF naar Anthropic. Gedocumenteerde keuze van eigenaar.
   - "Recht op vergetelheid"-knop staat op v1.1-roadmap (handmatig via Supabase-dashboard kan al).
   - Google Fonts blijft externe call. Eigen-hosten zit in v1.1-backlog.

**Wat Peter nog handmatig moet doen voor de eerste deploy:**
1. Repo aanmaken op github.com/<account>/ons-weekmenu (publiek)
2. Inhoud van `/ons weekmenu/` pushen naar main
3. Settings → Pages → Source = GitHub Actions
4. Settings → Secrets → drie keys toevoegen (URL, ANON_KEY, ALLOWED_EMAILS)
5. Supabase dashboard → Auth → URL Configuration → site-URL en redirect-URLs van Pages-domein toevoegen

Daarna: elke push deployt automatisch.

**Roadmap v1.1 (later, optioneel):**
- "Alles wissen"-knop in app voor recht op vergetelheid.
- Google Fonts lokaal hosten.
- Multi-week boodschappenlijst (week 19+20 samengevoegd).
- "Vul deze week automatisch"-functie in Maker.
- "Voorraad" (wat-heb-ik-in-huis) features uit prototype.

---

## 2026-05-02 — v1.2: diner-recepten in boodschappenlijst, geschaald op aantal eters

**Probleem.** Boodschappenlijst miste de ingrediënten van de avondrecepten. Recepten zijn voor 4 personen, terwijl Peter en Miranda meestal met z'n tweeën eten (soms drie).

**Beslissing.** Schema-uitbreiding (Option 1 "structureel netjes"):
- `meals.serves int` toegevoegd. Voor de 7 diner-recepten op 4 gezet, ingrediënten in `meals.ingredients` ingevuld op 4-persoons hoeveelheden.
- `week_meals.porties` herinterpretatie: voor diner = "aantal eters voor deze maaltijd" (default 2 voor nieuwe records; bestaande records ook op 2 gezet).

**Aggregator (lib/shopping.js).**
- Recipe-meals (`meal.serves > 0`): records van Peter en Miranda voor zelfde `(day, slot, meal_id)` worden gededupliceerd. Aggregator pakt MAX van hun porties (gedeelde pot, niet dubbel kopen).
- Solo-meals (serves null, bv. ontbijt): ieder eet zijn eigen portie → SUM porties (oude gedrag).
- Factor: `aggPorties / serves` per gededupliceerde entry.

**UI ('Eters per diner').**
- Paneel boven open items, rij per unieke diner-maaltijd (gededupliceerd), chips 1/2/3/4. Klik schrijft nieuwe waarde naar alle owner-records voor die maaltijd, herberekent boodschappen.
- "Alles op 2"-reset.
- Verborgen op print en als er geen diner-meals zijn.

**Validatie (node-test in /tmp/test_agg.mjs).**
- 2 personen Kip kerrie (recept voor 4): rijst 300g → 150g, broccoli 1000g → 500g ✓
- 3 personen: 225g + 750g (factor 0.75) ✓
- Solo-modus telt alleen die persoon ✓
- Ontbijt (kwark, geen serves): 2 personen × 300g = 600g ✓ (sum, niet dedup)

**Schema.sql bijgewerkt** met `recipe text` (was missing sinds v0.9) en `serves int`.

**Open punt.** Bij ongelijke porties tussen Peter en Miranda voor zelfde maaltijd (Peter=2, Miranda=3) gebruikt aggregator MAX. Nu schrijft de chip-klik altijd identiek naar beide records, dus mismatch komt in praktijk alleen voor als iemand handmatig aan één record komt buiten dit paneel om. Acceptabel.

---

## 2026-05-02 — v1.3: per-recept akkoord-flow + dag-kleur tracking

**Probleem.** v1.2 zette dineren automatisch in de boodschappenlijst, maar Peter wilde controle: per recept beslissen welke ingrediënten hij koopt (sommige heeft hij in huis), en zien welke ingrediënten bij welk recept horen.

**Beslissing (na A/B keuze).** Optie A gekozen: per-recept akkoord-flow vervangt automatische aggregatie voor recipe-meals (serves > 0). Solo-meals (ontbijt etc.) blijven automatisch via aggregator.

**Aggregator (lib/shopping.js).**
- `aggregateShopping` skipt records met `meal.serves > 0`.
- `source.qty` per ingredient wordt voortaan opgeslagen in basis-unit (g/ml/st), zodat helpers items schoon kunnen herberekenen bij toevoegen/verwijderen.
- Nieuwe pure helpers: `scaleRecipeIngredients(meal, porties)`, `mergeRecipeIntoItems(items, {...})`, `removeRecipeFromItems(items, recipeKey)`, `approvedRecipeKeys(items)`, `approvedIngredientNamesForRecipe(items, key)`, `recipeKeyOf(day, mealId)`.
- Items hebben nu `sources[]` met `recipeKey`, `qty` per bron. Item.qty = sum van source.qty.

**UI (views/shopping.js).**
- Recept-titel in 'Eters per diner'-paneel klikbaar, toggle expand. Open recept toont ingrediënten geschaald op huidige porties met checkboxes (default aan = naar lijst).
- Akkoord-knop merget items naar `shopping_list.items` met `source.recipeKey`. Knop heet "Bijwerken" zodra akkoord ooit gegeven (recipeKey staat in items).
- Verwijder-knop ontruimt items met die recipeKey.
- Akkoord-badge (groen vinkje) verschijnt naast titel zodra approved.
- Chip-wijziging na akkoord triggert auto re-akkoord met nieuwe porties — geen herhakkoord nodig.
- Excludes (uitgevinkte ingrediënten) worden bij heropening hydraat uit items: ontbrekende ingrediënten = eerder uitgevinkt. Lokaal in `vs.recipes[key].excluded` (Set), `_hydrated` voorkomt reset bij re-render.

**Boodschappenlijst-tracking.**
- Per item-rij links een verticaal stripje per herkomst-dag (oklch hue per dag: ma=280, di=145, wo=28, do=85, vr=350, za=50, zo=175).
- Bij open recept in paneel: items met `source.recipeKey == openKey` krijgen een border in dag-kleur (visueel oplichten).
- Day-stripes ook voor solo-meal-bronnen (ontbijt op dag 3 = groene stripe op rij Kwark).

**Validatie (node-test in /tmp/test_v13.mjs).**
- Aggregator skipt recipes ✓
- Scale schaalt correct (1 kg → 0.5 kg voor 2 personen) ✓
- Merge in lege lijst werkt ✓
- Re-merge zelfde recept met andere porties = vervangt (geen dubbel) ✓
- Twee recepten met gedeelde ingredient = sommatie qty + 2 sources ✓
- Remove ontruimt sources, drop items zonder sources ✓
- approvedRecipeKeys / approvedIngredientNamesForRecipe geven juiste sets ✓

**Header.**
- "// week 19 · huishouden Peter" → "// week 19 · v1.3" via nieuwe `app/src/version.js`. Eén plek voor versiebump.

**Open punten.**
- Recipe-flow werkt alleen voor diner-meals (waar serves is gezet). Solo-meals (ontbijt) blijven automatisch — geen akkoord-stap. Consistent met "akkoord = recept-keuze".
- Bij wisseling van modus (huishouden → peter) blijft items met andere modus' herkomst staan. In praktijk geen issue want recepten zijn meestal voor het hele huishouden.
- Visuele highlight van gelinkte items werkt alleen bij geopend recept. Geen permanente "uit dit recept"-indicator buiten de stripes (die zijn al genoeg).

---

## 2026-05-02 — v1.4: horizontale swipe-navigatie (mobile)

**Nieuw bestand `lib/swipe.js`.** Pure helper `installSwipeNavigation(element, { routes, getCurrent, setRoute })` met touchstart/end. Threshold 60px horizontaal, max 40px verticaal (anders is het scroll-poging). Skipt swipe als touch begint in input/button/.dp-chips/.notes-panel/.recipe-actions/[data-no-swipe]. Alleen actief op viewport ≤ 720px.

**In shell.js:** lazy-bind via `queueMicrotask(ensureSwipe)` na elke render, met installed-flag zodat we maar één keer registreren.

**Routes:** `['week', 'dag', 'lijst']`. Swipe-links = volgende, swipe-rechts = vorige.

---

## 2026-05-02 — v1.5: WeekView mobile fix + boodschappen layout-cleanup

**WeekView mobile.** Dagnaam wisselt naar DAGEN_KORT (Ma/Di) op viewport ≤ 720px via `.day-full`/`.day-short` spans + media-query CSS. Day-kolom van 70px naar 44px, slots-kolom krijgt `min-width: 0` zodat lange meal-namen netjes wrappen. Geen overflow meer onder smalle iPhones.

**Boodschappen-rij.** Dag-streepjes uit v1.3 verwijderd (oogden rommelig bij items met meerdere herkomsten — olijfolie kreeg 7 streepjes). P/M-cirkels verplaatst van na qty naar tussen naam en qty. Qty-knop kreeg vaste min-width 80px voor uitlijning aan rechterzijde.

**Highlight bij open recept.** Geen kleurborder meer. Vervangen door `bg-2`-achtergrond + kleine `▸` voor de naam in dag-kleur (subtiel maar zichtbaar).

**Versie-pill.** `app/src/version.js` als één plek voor versie-string. Pill rechts in topbar, ook zichtbaar op mobile (was eerst verborgen).

**v1.5b: classifier uitgebreid.** lib/categorie.js keywords toegevoegd voor: kefir, roerei, kookzuivel, kokossnippers, pecannoten, basmatirijst, kipfiletreepjes, bouillontablet, krulpeterselie, beleg + recept-specifieke ingrediënten van alle 7 dineren. Plus substring-fallback (alleen voor keywords ≥ 4 chars) zodat samengestelde namen ('basmatirijst' bevat 'rijst') matchen.

**v1.5c: ingrediënten weg uit meal-detail voor recipe-meals.** Voor diner met `serves > 0` toont meal-detail-modal alleen het recept (bereidingswijze), geen aparte ingrediëntenlijst. Solo-meals (ontbijt etc) houden hun ingrediëntenlijst.

**v1.5d: twee bugs.**
1. `mergeRecipeIntoItems` werkt category alleen voor nieuwe items. Bestaande items blijven 'overig' bij Bijwerken. Fix: bij bestaande items ook `item.category = classifyIngredient(nameKey)` zetten.
2. `generateOrRefresh` overschreef hele lijst met aggregator-output, wat alle akkoord-items wiste. Fix: filter items met `source.recipeKey` uit de oude lijst, mergeer ze met nieuwe aggregator-output op itemKey (sources optellen).
3. Eenmalige reclassify in `loadAll` zodat oude items in lijst direct in juiste categorie komen zonder per recept Bijwerken.

---

## 2026-05-02 — v1.6: winkelroutes per supermarkt

**Nieuw bestand `lib/winkelroutes.js`.** Per supermarkt (`ah`, `jumbo`, `lidl`) een array van categorie-IDs in loop-volgorde. Standaard = `null` (gebruik categoryOrder uit categorie.js).

- AH: groente → brood → zuivel → vlees → kruiden → houdbaar → drank → overig
- Jumbo: groente → vlees → zuivel → brood → kruiden → houdbaar → drank → overig
- Lidl: groente → brood → zuivel → vlees → houdbaar → kruiden → drank → overig

Generieke layouts (niet filiaal-specifiek). Iemand met meer info kan later finetunen.

**UI.** Chips boven categorie-cards. Keuze persistent in `localStorage.owm.routeStore`. Bij wissel sorteert de view de category-cards op de gekozen route.

**Vervangen.** Oude "store-filter-row" (met `// gegroepeerd per winkel` + winkel-chips) was nutteloos zonder per-ingredient store-veld. Vervangen door route-chips die wel praktisch zijn in de winkel.

---

## 2026-05-02 — v1.7: vijf concrete features in één release

**#1 Recept-incompleet waarschuwing.** Helper `isRecipeIncomplete(meal)` (verhuisd naar lib/recipe-helpers.js): true als `serves` ontbreekt of `ingredients` leeg is. Toont `⚠`-icoon naast titel in recepten-paneel + uitleg-tekst met link naar Maker in expand-paneel. Werkt voor alle scenarios (PDF-import, manueel, ...), niet alleen import-detection. Pragmatischer dan ImportView aanpassen.

**#2 'In huis'-toggle.** Nieuwe `inHouse: bool` op items in shopping_list. Per item-rij een huisje-knop (SVG) naast checkbox. Klik = `toggleInHouse(idx)` → schrijf naar DB + naar aparte sectie "In huis" tussen open en afgevinkt. Items blijven zichtbaar maar half doorgestreept met cursief. Werkt voor solo-meals én recipe-meals.

**#3 vs.recipes reset bij week/modus wissel.** In `setModus` en `changeWeek` wordt `vs.recipes = {}`. Voorkomt dat uitgeklapte recepten van vorige selectie zichtbaar blijven.

**#4 Lichte refactor: helpers naar lib/recipe-helpers.js.** Verhuisd: `DAY_HUE`, `dayColor`, `isRecipeIncomplete`, `houseIcon`. Render-functies en state-mutators blijven nog in views/shopping.js. Volledige split (renderDinerPortions etc.) is risico-vol genoeg voor een eigen v1.9-pass — bewust uitgesteld.

**#5 Skip-knop (chip "—").** In recepten-paneel een extra chip links van 1/2/3/4. Klik 0 → `setGroupPorties(group, 0)` → `setWeekMealsPorties` schrijft 0 naar DB + `unapproveRecipe` verwijdert items uit lijst. Visueel: `is-skip` class op rij + naam doorgestreept + label "uit eten". Klik 1-4 = re-akkoord met nieuwe porties.

---

## 2026-05-02 — v1.8: achterkant verstevigen (tests, backup, AVG, PWA)

**#A Unit tests.** Bestand `app/test/*.test.js` met node:test runner (geen npm install, geen vitest). 37 tests over: aggregator (skip recipes, sum porties, modus), scaleRecipeIngredients, mergeRecipeIntoItems (lege lijst, re-merge, gedeeld ingredient, category-update), removeRecipeFromItems, approvedRecipeKeys/IngredientNames, classifier (incl. v1.5b-toevoegingen), recipe-helpers (isRecipeIncomplete, dayColor, DAY_HUE), itemKey-stabiliteit. Run met `npm test` (script in package.json).

**#B Backup-export.** `exportAllData()` in data.js haalt alle 6 tabellen op (profiles, meals, weeks, week_meals, shopping_lists, shopping_notes), returnt `{ exportedAt, appVersion, ...tabellen }`. Knop in Bibliotheek (onderhoud-paneel onderaan): `↓ download backup (.json)` triggert Blob-download van `owm-backup-YYYY-MM-DD.json`.

**#C AVG-cleanup.** Twee functies in data.js. `deleteWeeksOlderThan(year, week)` zoekt te-verwijderen weken via `or(year.lt.X, and(year.eq.X,week_nr.lt.Y))`, wist hun PDFs uit storage-bucket, en delete weeks (cascade FK wist week_meals + shopping_lists). `wipeAllUserData()` verwijdert alle PDFs + alle profiles (cascade alles). UI in Bibliotheek met dubbele bevestiging op "wis al mijn data".

**#D PWA offline.** Nieuw `app/public/sw.js` (service worker) met stale-while-revalidate voor app-assets. Supabase API blijft network-only. Geregistreerd in main.js via `navigator.serviceWorker.register((BASE_URL || '/') + 'sw.js')`. Plus: `loadAll()` in shopping.js cached succesvolle lijst-load in `localStorage.owm.list.{modus}.{year}.{week}`. Bij netwerkfail leest hij uit cache en toont label "Offline — toon opgeslagen lijst van [tijdstip]". Afvinken offline werkt nog niet (synced niet door tot online) — geplande v1.9 als nodig.

**Race-condition fix die niet onder eigen versie viel.** `setWeekMealPorties` triggerde N notify's bij N owner-records, waardoor parallelle `loadAll` calls stale data inlazen en de Math.max-dedup foute waarden teruggaf (chip "1" sprong terug naar "2"). Opgelost met nieuwe `setWeekMealsPorties({ ids, weekIds, porties })` die in één DB-query alle records bijwerkt en één notify triggert.

**Schema-status.** `supabase/schema.sql` bijgewerkt voor `meals.recipe` (was missing sinds v0.9) en `meals.serves` (v1.2). Niet expliciet bijgewerkt voor v1.3+ items-format want JSONB-blob veranderingen vergen geen DDL.

---

## 2026-05-02 — v1.9: negeer-lijst, combineer-detectie, import-routine

**Negeer-lijst.** Nieuw bestand `lib/ignored.js` met load/save/add/remove + onIgnoredChange listener. Persistent in `localStorage.owm.ignored` (Set van genormaliseerde namen). Per item-rij in de boodschappenlijst een `×`-knop → confirm → naam in negeer-set → aggregator filtert ze voortaan in de view (`isIgnored(item)` na load + render). Beheer in Bibliotheek-onderhoud-paneel: lijst van genegeerde namen met "terug op lijst"-knop. Gebruikssituatie: water (kraan), zout, peper.

**Combineer-detectie.** In de view bouw ik een `nameCounts` Map (genormaliseerde naam → aantal items). Items waar count > 1 krijgen een `≈` icoon naast de naam met tooltip "lijkt op een ander item — pas de naam aan via Maker als je ze wilt samenvoegen". Geen auto-merge want unit-conversie (st ↔ g) is niet betrouwbaar te doen. Gebruikssituatie: "Kaas 1 st" en "Kaas naar keuze 120 g" — beide normaliseren naar 'kaas' maar units verschillen. Geraspte kaas blijft eigen rij omdat "Kaas, geraspt" naar 'kaas geraspt' normaliseert (komma stript naar spatie, niet weg).

**Import-routine — werkafspraak voor mij (Claude).**
Bij elke nieuwe weekly PDF-import via Cowork:
1. Verzamel alle nieuwe ingredient-namen (uit nieuwe meals plus toegevoegde aan bestaande meals).
2. Vergelijk met bestaande in `meals.ingredients` (alle non-deleted meals).
3. Bij gelijkenis (substring na normalizeName, of duidelijke synoniemen zoals "balletjes" ↔ "vleesballetjes"), maak een mini-rapport voor Peter: `Nieuw: "X"  ↔  bestaand: "Y" — samenvoegen?`
4. Voer pas de import uit als Peter expliciet keuzes heeft gemaakt: behoud apart, of normaliseer alle voorkomens naar één naam.
5. Na import: optioneel een "wis duplicaten" SQL-update als Peter dat goedkeurt.

Onderliggend principe: alleen de aggregator-flow ziet items uit verschillende meals. Als ingrediëntnamen niet exact matchen, krijg je dubbele rijen in de boodschappenlijst. Vooraf afstemmen scheelt herstelwerk achteraf.

---

## 2026-05-04 — v1.9b/c/d/e: meal-detail eters-chips + slot-iconen + recept-strip

**v1.9b: eters-chips in meal-detail.** Voor diner-recepten verschijnt boven het recept een chip-rij `1 eter / 2 eters / 3 eters / 4 eters` plus een geschaalde ingrediëntenlijst (uit `scaleRecipeIngredients`). Klik op chip → `setWeekMealsPorties` met dat record-id. Geen automatische sync naar shopping_list — Peter doet handmatig "Bijwerken" via recepten-paneel als hij wil dat boodschappen meegaan.

**v1.9c: slot-iconen weg.** `SlotIcon` retourneert nu altijd `null` — eerst alleen non-diner verborgen, daarna ook diner voor consistente uitlijning in week/day-view. Versie-pill rechts in topbar weggehaald (brand-pill links blijft).

**v1.9d: recept-strip Personen + Ingrediënten.** `renderRecipe()` in meal-detail strippt twee secties uit de markdown vóór render: `^Personen: ...` regel én alles vanaf `Ingrediënten`-kop. Die info komt nu via de eters-chips + geschaalde lijst bovenaan. Diff regex: `/^\s*\*?\*?Personen:[^\n]*\n?/im` en `/\n\s*\*?\*?Ingredi[ëe]nten[^\n]*[\s\S]*$/i`.

**v1.9e: laatste slot-icoon (diner) ook weg.** Visuele regressie waardoor diner-rijen anders uitlijnden dan andere slots.

**Deploy-glitch.** v1.9d's deploy faalde met GitHub Pages 502. Re-run loste het op. Geen code-issue. De Pages CDN cachet bovendien soms een oude versie kort na deploy — twee pull-to-refreshes in Safari tonen meestal de nieuwe.

---

## 2026-05-04 — v2.0: dag-filter in boodschappenlijst

**Nieuwe filter-rij** boven de open items: `Ma Di Wo Do Vr Za Zo` als toggle-knoppen plus `alles / vandaag / +morgen` snel-keuzes rechts. Default alle 7 dagen aan. Persistent in `localStorage.owm.selectedDays` (Set serialized als array).

**Filter-logica.** `itemHasDayInSelection(item)` filtert items zonder source in geselecteerde dagen weg. `itemQtyForSelection(item)` herrekent qty op basis van alleen geselecteerde source.day's. Werkt voor alle slots automatisch want elke source heeft `source.day` sinds v1.3.

**Bug die ik moest fixen.** Door dag-filter werd in de view-laag een NIEUW item-object gemaakt (`{...it, qty: ...}`) als de filtered qty afweek. `toggleChecked(idx)` gebruikte daarna de index in de gefilterde lijst om vs.items te muteren — totaal verkeerd item. Oplossing in v2.0a: `toggleChecked` en `commitEditQty` werken nu op `itemKey` ipv index.

**Categorisatie-bug.** Reclassify-pass in `loadAll` gebruikte `name.toLowerCase().trim()` zonder `normalizeName`. "Biefstuk, gebakken in roomboter" hield "biefstuk," (met komma) → geen match → substring-fallback won met "roomboter" → zuivel_eieren. Fix: `classifyIngredient(normalizeName(name))` gebruiken op alle reclassify-plekken (loadAll, generateOrRefresh recipe-only items, addNote).

**Clustering binnen categorie.** `groupByCategory` sorteert items binnen elke categorie nu op basisnaam (eerste woord van genormaliseerde naam) → "Kaas", "Kaas, geraspt" en "Kaas naar keuze" staan altijd onder elkaar.

**Route-keuze (AH/Jumbo/Lidl) verwijderd.** Op verzoek; `lib/winkelroutes.js` blijft staan voor mogelijk hergebruik.

**P/M-cirkels weg.** Op verzoek; `who[]` blijft in items voor toekomstig gebruik.

**Layout.** `name-col` krijgt `min-width: 0` + `overflow: hidden` + `word-break: normal` + `overflow-wrap: break-word` + `hyphens: auto` (samen met `<html lang="nl">` voor Nederlandse hyphenation). Lange compounds zoals "Kippenbouillontablet" breken nu op lettergrepen ipv mid-letter.

**Recept-markering.** Eerst stipjes per recept-dag (v2.0d) → toen Word-stijl highlighter met dag-kleur background (v2.0e) → uiteindelijk terug naar stipjes (v2.0g) op verzoek. `recipeDaysFor(item)` returnt unieke recipeKey-dagen; alleen items met source.recipeKey krijgen markering.

---

## 2026-05-04 — v2.1: CI tests + extra dekking

**CI runt nu `npm test`.** In `.github/workflows/deploy.yml` tussen install en build. Bij failing test: build stopt, geen deploy. Tot v2.1 ging een breaking change ongemerkt door naar productie.

**Nieuwe tests** in `app/test/helpers.test.js`. 29 extra tests dekken:
- Classifier substring-fallback voor compound names ("Biefstuk, gebakken in roomboter", etc.) — exact de regressie van v2.0b.
- `normalizeName` randgevallen (parens, bereiding, "naar keuze", slash).
- `itemHasDayInSelection` en `itemQtyForSelection` (de v2.0 dag-filter logic) — duplicate van de view-helpers, want pure functies zijn makkelijk los te testen.
- `recipeDaysFor` — alleen recipe-bronnen tellen, dedup per dag.
- `loadIgnored / saveIgnored / addIgnored / removeIgnored` (lib/ignored.js) met gemockte `localStorage`.

Totaal 66 tests groen.

**Pending v1.1d (drag-and-drop) geschrapt.** Verplaats/ruil-knoppen in meal-detail dekken het use-case voldoende.

---

## 2026-05-09 — v2.3: rating per diner + kwark-split + import week 20

**Aanleiding.** Peter leverde week 20 aan (Peter + Miranda PDFs + recepten-PDF). Twee nieuwe wensen erbij: magere en volle kwark moeten apart blijven in boodschappen (waren tot nu samengevoegd door normalizeName), en per diner moet een beoordeling komen. Bij een negatieve beoordeling verdwijnt het recept uit de bibliotheek.

**Schema.** `week_meals.rating smallint check (rating in (-1, 0, 1))`. Partial index op `rating is not null`. Geen breuk met bestaande data.

**Cleanup vooraf (kort uit memo).** DB had 14 actief-dubbele meals door v0.7-import zonder dedupe (Ei gekookt ×2, Kaas naar keuze ×3, Kefir ×2, Kwark met honing ×2, Noten naar keuze ×3, Omelet met avocado ×2, plus Kwark met bessen ×2). Per groep canonical = laagste id. week_meals omgehangen, niet-canonical meals soft-deleted. Twee groepen vereisten handmatige stap door JSONB-key-volgorde verschil (jsonb-equality is volgorde-gevoelig).

**Code-wijzigingen.**
- `lib/shopping.js`: `BEREIDING_RE` zonder vetgehalte-aanduidingen. Voortaan: `gebakken|gekookt|gefruit|gegrild|geroosterd|gestoomd|gepocheerd|rauwe?`. Zo komen "Kwark, volle" en "Kwark, magere" als aparte items op de boodschappenlijst.
- `lib/data.js`: `setWeekMealRating({ id, weekId, mealId, rating })`. Bij rating=-1: meal soft-delete. Bij rating in {0,1}: meal restore (deleted_at = null) als hij eerder via deze flow verborgen was. Update `getWeekMeals` en `setWeekMeal` om `rating` en `meal_id` mee te selecteren.
- `components/meal-detail.js`: rating-chips '👍 lekker · neutraal · 👎 niet weer' bovenaan body voor diner-cellen. Toggle via dezelfde-waarde-klik = rating wissen. Bij -1 een `confirm()` met uitleg ('verbergt het recept uit bibliotheek'). State `ui.rating` + `ui.savingRating`. Initialiseert uit `wm.rating`.
- `version.js`: v2.2d → v2.3.

**Bibliotheek-filter komt automatisch.** `listMeals({ includeDeleted: false })` is al de standaard (sinds v0.5). Negatief beoordeelde recepten worden zo automatisch verborgen in BuildView (Maker), terwijl `getWeekMeals` ze nog wel toont in oude weken (join op meal_id zonder deleted_at filter).

**Import week 20.**
- 7 nieuwe gedeelde dineren met `suitable_for=['beiden']`, `serves=4`, ingredients (4-persoons hoeveelheden) en recipe (uit receptenboek-PDF): Spicy chili con carne, Quesedilla's met schnitzels, Macaroni met balletjes, Andijviestamppot met een eitje, Cannelloni met tomaten & geitenkaas, Wraps met grilled chicken & avocado, Spaghetti met zalm & groene groenten.
- Solo-meals (ontbijt/lunch/snack_avond) per persoon: alle 28 + 28 cellen hergebruiken bestaande meals. De ingredient-hoeveelheden van de diëtist zijn week op week identiek voor de niet-diner cellen, dus geen nieuwe meal-rows. Bibliotheek blijft schoon.
- Twee weeks-rijen voor 2026 week 20 (Peter + Miranda), source='dietist', pdf_path leeg (we hebben de PDFs niet ge-upload — kan later via app als nodig). 56 week_meals geïnsert (28 per persoon × 4 slots × 7 dagen, snack_ochtend + snack_middag leeg conform PDF).
- Diner-week_meals krijgen porties=2 (consistent met v1.2 default voor het tweetal).

**Architectonisch interessant.** De diner-recepten staan met één meal_id voor zowel Peter als Miranda. Hun week_meals refereren beide naar dezelfde meal-row. De aggregator (lib/shopping.js) doet dedup voor recipe-meals per `(day, slot, meal_id)` met MAX(porties), dus geen dubbele boodschappen. Dit is het eerste week-import waarin we het 'beiden'-pad echt gebruiken — week 19 had `suitable_for=['peter']` voor alle dineren.

**Tests.** 4 nieuwe tests in `app/test/helpers.test.js`:
- `kwark volle` ≠ `kwark magere` na normalizeName
- `yoghurt volle` ≠ `yoghurt halfvolle`
- bereiding-keywords blijven gestript ('Ei, gebakken' → 'ei')
- 'Honing (rauwe)' → 'honing'

**Open punt.** De rating-flow heeft nog geen *visuele indicator* in de week- of dag-view (bv. een vinkje of duim-icoon naast een gerated diner). Voor nu zie je rating alleen wanneer je de meal-detail-modal opent. Toevoegen kan later, low priority — Peter heeft eerst zelf de flow nodig.

**Open punt 2.** Bij wijziging naar -1 wordt de meal soft-deleted. Maar als ditzelfde recept op een ANDERE dag in dezelfde week ook positief beoordeeld is, blijft de meal soft-deleted. Onbedoeld? Voor nu acceptabel: rating is per-meal niet per-week_meal in praktijk; bij conflict kan Peter handmatig terugzetten via 'lekker' op een andere week_meal. Bij volgende import wordt het nieuw geseed.

**Boodschappen-aggregatieregels (afspraken voor toekomstige imports).**
- Kaas + Kaas naar keuze → samenvoegen (één rij in boodschappen). NormalizeName lost dit al op via NAAR_KEUZE_RE → strip "naar keuze". Niet wijzigen.
- Kaas, geraspt / Geraspte kaas → blijft apart. Andere hoeveelheid, ander product. Werkt al door bestaande normalizeName.
- Water → hoort niet op de lijst (kraan). Bij volgende PDF-import: water-rijen weglaten uit `meals.ingredients` of laat Peter ze via × in de boodschappenlijst aan zijn ignore-set toevoegen (per-device localStorage). Mogelijke v2.4-feature: hardcoded BUILTIN_IGNORED in `lib/ignored.js` zodat water cross-device weg blijft.
- Magere vs volle kwark → apart, sinds v2.3 (BEREIDING_RE strip niet meer 'magere'/'volle'/'halfvolle').

---

## 2026-05-09 — v2.7a–c + v2.8: meal-editor uitleg, macro-layout fix, foto's

**v2.7a — bereidingswijze in meal-editor.** `mealToDraft` uitgebreid met `recipe`, `description`, `source_url`. Form in meal-picker kreeg drie nieuwe velden onder de Dieet-fieldset. Geen schema-wijziging — kolommen bestonden al sinds v2.3.

**v2.7b — volgorde + scrollbalk weg.** Ingrediënten-fieldset verplaatst naar BOVEN de bereidingswijze (logische input → proces). Bereidings-textarea krijgt CSS `field-sizing: content` (modern browsers) en JS-fallback (`requestAnimationFrame` + `scrollHeight` via lit-html `ref`-directive). Min-height 80px, geen scrollbalk meer.

**v2.7c — macro-cellen horizontaal.** `macros-row` van `flex-wrap: wrap` → `nowrap`, `.macro-cell` van `flex: 1 + min-width: 38px` → `flex: 1 1 0 + min-width: 0`. Plus mobile-fix: `.day-col .day-macros { grid-column: 1 / -1 }` zodat de macro-strook de hele dagkolom-breedte krijgt op mobiel (was beperkt tot slots-kolom).

**v2.8 — foto's bij gerechten.**
- Schema: `meals.image_url text` (nieuwe kolom).
- Re-scrape via Chrome MCP: alle 418 source-URLs nogmaals fetched, schema.org/Recipe.image-veld geparseerd.
- Bug-fix in image-picker: `["", "https://..."]` array (AH gebruikt dit format) — eerste lege string werd geretourneerd. Fix: skip lege strings, neem eerste niet-lege.
- Coverage: 418/464 (90%). Diëtist-recepten (46) hebben geen image want geen externe bron.
- Edge function `update-meal-images` (shared secret `owm-images-7f3a2b4c-temp-2026`) — kan later disabled.
- meal-card.js: `<img>` met `loading="lazy"` + `referrerpolicy="no-referrer"` + `@error`-fallback naar FoodPh placeholder. CSS `object-fit: cover` voor consistente kaart-grootte.

**AVG-overweging.** Image-URLs verwijzen naar externe sites. Browser laadt direct vanaf miljuschka.nl/static.ah.nl/24kitchen.nl bij elk renderen van Bibliotheek. `referrerpolicy="no-referrer"` voorkomt dat onze GitHub Pages-URL als referrer wordt meegestuurd. Geen tracking-pixels of cookies van bron-sites — gewone CDN-images. Acceptabel voor privé huishouden-app.

**Edge functions actief (alle met shared-secret):**
- `bulk-import-meals` (disabled stub na v2.3)
- `update-meal-macros` (v2.7)
- `list-source-urls` (v2.7)
- `update-meal-images` (v2.8)

Voor v2.9 of later: opruimen of consolideren tot één generieke `update-meal-fields` endpoint.

---

## 2026-05-09 — v2.7: ingredient-macros database voor macro-coverage 14% → 62%

**Aanleiding.** v2.6 had de UI maar 0%-data. Open Food Facts text-search was onbetrouwbaar (zoek 'kipfilet' → match 'Volkoren pasta'), Recipe.nutrition gaf alleen 64/464 (14%). Pivot naar een eigen ingredient-database met macros uit mijn voedingsmiddelen-kennis.

**Schema.**
- `public.ingredient_macros` (name_key PK, display_name, kcal/eiwit/koolh/vet_per_100g, default_unit, st_to_g, source).
- 343 entries handmatig aangelegd via SQL-INSERTs in 5 batches (oliën+zuivel, vlees+granen, brood+peulvruchten+noten, groenten, fruit+sauzen+kruiden).
- Synoniemen apart als rij (olijfolie / milde olijfolie / extra vierge olijfolie hebben dezelfde macros maar verschillende name_keys).
- Source = `claude_kb` (mijn algemene kennis); orde-van-grootte accuraat, niet wetenschappelijk gekalibreerd.

**Aggregator-functie `compute_meal_macros(force boolean)`.**
PL/pgSQL functie die voor elke meal:
1. Loopt door `meals.ingredients` (jsonb-array)
2. Normaliseert ingredient-naam (strip parens, bereiding-keywords, leestekens)
3. Lookup tegen `ingredient_macros` op name_key, fallback op first-word
4. Converteert qty → basis-eenheid (g/ml/st via st_to_g): el=15g, tl=5g, kg=1000g, l=1000ml, snufje=0.5g, scheut=5g
5. Sommeert kcal/eiwit/koolh/vet
6. Voor recipe-meals (serves > 0): deelt door serves zodat kcal staat per portie
7. Update `meals.kcal/eiwit_g/koolh_g/vet_g` als ≥50% van de ingredients gematcht zijn

**Resultaat.**
- 4673 ingredient-rijen totaal in DB; 2482 (53%) gematcht via exact name_key
- 286 van 464 meals (62%) volledige macros — een sprong van 14%

**Steekproeven (sanity-check OK).**
- Spicy chili con carne (4p): 639 kcal, 54g eiwit, 59g koolh, 23g vet ✓
- Kwark met fruit en honing: 142 kcal, 23g eiwit ✓
- Japanse souffle pancakes: 833 kcal/p — wat hoog voor pancakes, mogelijk overschat door bloem-portioning
- Caesar-eiersalade serves=12 — verdachte recipeYield-parse, te corrigeren

**Edge functions van eerdere sessies.** `update-meal-macros`, `list-source-urls`, `bulk-import-meals` zijn nog steeds actief. Geen risico (shared-secret), maar kan opgeruimd in v2.8.

**Volgende stap (v2.8).** Auto-genereer-week algoritme dat 7 dagen vult met meals zodat dagtotalen binnen ±10% van targets blijven. Greedy met retries. Vereist UI-knop in WeekView.

---

## 2026-05-09 — v2.6: macro-targets + favorieten + grid/lijst + rating-aggregaat

**Aanleiding.** Peter wil weekmenu-samenstelling op basis van macronutriënten. Realiteitscheck: macro-coverage was 0% na de bulk-import. Re-scrape via schema.org/Recipe.nutrition gaf 64/464 (14%). Te laag voor auto-genereer-week, maar wel genoeg om de UI-structuur te bouwen zodat handmatig invullen waarde heeft.

**Macro-coverage per bron na re-scrape:**
- Miljuschka 33/233 (14%) — alleen recente recepten met nutrition-block
- AH 31/132 (23%) — degelijke nutrition-data waar aanwezig
- 24kitchen 0/53 — geen nutrition op site
- Diëtist 0/46 — alleen kcal in PDFs, niet doorgekomen via JSON-import

**Schema (`v2_6_macro_targets_and_favoriet`).**
- `profiles.kcal_doel + eiwit_g_doel + koolh_g_doel + vet_g_doel` — nullable, doelwaarden per dag.
- `meals.favoriet boolean default false` — markering voor favorieten-filter.
- View `meal_ratings` (meal_id, rating_count, rating_avg) — aggregeert week_meals.rating per meal voor de Bibliotheek-sortering.
- Indexen op favoriet (partial where=true) en bestaande indexen behouden.

**Edge functions tijdelijk gedeployed.**
- `update-meal-macros` (POST `{updates: [{source_url, kcal, eiwit_g, koolh_g, vet_g}]}` met x-import-secret).
- `list-source-urls` (GET `?site=miljuschka.nl`) — service-role wrapper voor lijst-ophalen vanuit browser, was nodig omdat anon-key geen RLS-leesrecht heeft op meals.
Beide blijven actief tot we ze handmatig disablen of vervangen door betere oplossing.

**WeekView: per-dag macro-overzicht.**
Onder elke dag-kolom verschijnt een `.day-macros`-blok met 4 cellen: kcal, eiwit, koolh, vet. Toont totaal vs target per profiel; bij meerdere profielen ('beiden') 2 rijen. Kleur-coding: `low` (≤80% van target, geel), `ok` (80-110%, groen), `high` (>110%, rood). Fallback `—` als data ontbreekt. Schaalt op recipe-meals via `wm.porties / meal.serves`.

**Settings-modal (`components/settings.js`).**
Tandwiel-knop in topbar (naast avatar-uitloggen). Modal toont per profiel een fieldset met 4 number-inputs voor de doelwaarden. Save → updateProfileMacros voor elk gewijzigd profiel.

**Bibliotheek-uitbreidingen (`views/build.js`).**
- Favorieten-filter chip 'Alleen favorieten' direct onder zoek.
- Ster-icoon op `MealCard` (event.stopPropagation zodat click niet doorgaat naar editor). Optimistic UI op toggle.
- Grid/lijst toggle rechtsboven (icoon-buttons ⊞/≡). Lijst-modus = compacte rij met naam + cuisine + kooktijd + kcal + rating.
- Sortering 'Beoordeling' werkt nu via `vs.ratings`-cache uit `listMealRatings()` en `meal_ratings`-view.
- `loadAll()` doet `Promise.all([listMeals, listMealRatings])`.

**Nav-labels.**
'Stel zelf samen' werd al 'Bibliotheek' in v2.4 (op route 'maker'). De oude 'Bibliotheek'-label op route 'archief' is hernoemd naar 'Archief' om dubbele namen te voorkomen.

**Open punten voor v2.7.**
- Auto-genereer-week op macros — te complex bij 14% coverage.
- Macro-coverage opkrikken via NEVO/USDA ingredient-database (groot werk).
- Multi-select & bulk-acties in Bibliotheek (meerdere recepten in één keer naar week).
- 'Wat kan ik vandaag maken' — match op shopping-list checked-items.
- Favorieten-sortering ('favorites first').

---

## 2026-05-09 — v2.5: mobile vandaag-scroll + diëtist-bron + cuisine-detectie via ingrediënten

**Aanleiding.** Drie kleinere verbeteringen direct na v2.4: (1) mobiel weekmenu scrolt nu automatisch naar de huidige dag, (2) diëtist-recepten staan nu correct als bron 'diëtist' in de Bibliotheek-filter, (3) cuisine-coverage opgekrikt door ingrediënt-detectie.

**1. Mobile auto-scroll (week-view).**
Nieuwe state-flag `vs.scrolledToToday`. In `WeekView()` direct aan begin: `maybeScrollToToday(isCurrentWeek)`. Helper: alleen actief op viewport ≤ 720px en isCurrentWeek, eenmalig per week (reset bij `changeWeek` en `gotoWeek`). Gebruikt `queueMicrotask` na render om de `.day-col.today` element te vinden en `scrollIntoView({ behavior: 'smooth', block: 'center' })`. Werkt op iPhone en kleine Android-schermen waar de week-grid 1-koloms wordt.

**2. Diëtist-bron via JOIN.**
SQL-update: alle meals zonder `source_site` die ergens als `week_meals` zaten in een week met `source='dietist'` krijgen `source_site='dietist'`. Idempotent: alleen waar source_site nog null was. 46 recepten gemarkeerd. Alle 464 actieve meals hebben nu een herkenbare bron.

**3. Cuisine-detectie via ingrediënten.**
Voor de 286 recepten zonder cuisine na v2.4 (naam-detectie miste te veel): SQL-update met EXISTS-clausules over `jsonb_array_elements(ingredients)`. Per cuisine een keyword-set op ingredient-namen (mozzarella+ricotta+gnocchi → italiaans, sojasaus+gember+ketjap → aziatisch, harissa+couscous+tahin → mediterraan, etc.). Volgorde: meest specifieke eerst (italiaans, mexicaans, aziatisch, indiaas, frans, mediterraan, amerikaans, hollands).

Coverage: 38% → 67% (178 → 309 van 464). Resterende 155 zijn vooral algemene/Hollandse recepten zonder cultureel signaal in naam of ingrediënten (boterham met kaas, kwark met bessen). Acceptabel: filter werkt nog steeds en niet-getagde verschijnen onder 'alle'.

**Versiebump v2.4 → v2.5.** v2.4 was niet apart gecommit; alles in één v2.5-commit.

---

## 2026-05-09 — v2.4: Bibliotheek als database-view

**Aanleiding.** Na de bulk-import (418 recepten) was 'Stel zelf samen' onhandelbaar zonder filters. Peter wil filters voor type, keuken en kooktijd, plus extra dingen die ik kan voorstellen.

**Schema (`v2_4_meals_taxonomy_columns`).** Nieuwe kolommen op `meals`:
- `cuisine text` — single (italiaans/mexicaans/aziatisch/indiaas/frans/hollands/mediterraan/amerikaans/bbq)
- `kookwijze text[]` — multi (oven, airfryer, eenpans, traybake, wok, soep, salade, grill, pasta, stamppot, slowcooker, smoothie)
- `hoofdingredient text` — single (kip, rund, varken, lam, vis, vegetarisch, pasta, rijst, aardappel, brood, ei, zuivel)
- `dieet text[]` — multi (vegetarisch, vegan, glutenvrij, lactosevrij, koolhydraatarm)
- 4 indexen voor filter-performance.

**Auto-tagging.** Eenmalig SQL-script met regex-CASEs op `meals.name`. Coverage:
- cuisine: 178/464 (38%)
- kookwijze: 107/464 (23%)
- hoofdingredient: 312/464 (67%)
- dieet: 182/464 (39%)

Lage cuisine-coverage komt omdat namen niet altijd cultureel zijn (bv. 'Wraps met grilled chicken' kan mexicaans of amerikaans zijn). Verbetering voor v2.5: ingredient-detectie als naam geen signal geeft.

**Hernoemd.** Route blijft `'maker'` (deeplinks + shopping.js verwijzen naar `#maker`). Nav-label: 'Stel zelf samen' → **'Bibliotheek'**. Header binnen de view ook 'Bibliotheek'.

**UI in `views/build.js` (volledige herschrijving).**
- Filter-secties: zoek, slot (incl. tussendoortje als groep van snack_*), keuken, kooktijd-buckets (≤15/30/45/60/60+), hoofdingrediënt, kookwijze (multi), dieet (multi), bron (dietist/miljuschka/ah/24kitchen/eigen), max-kcal, seizoen, tag.
- Counts per chip via `applyFiltersExcept()` — counts respecteren alle ANDERE actieve filters zodat ze relevant blijven.
- Sorteer-dropdown rechtsboven: Naam / Kooktijd / Calorieën / #ingrediënten / Nieuwste / Beoordeling.
- '+ recept'-knop opent meal-creator met default-type 'diner' (was 'ontbijt').
- Bron 'Diëtist' is afgeleid: source_site IS NULL en niet handmatig aangemaakt → fallback 'eigen' voor nu. Echte detectie via weeks.source='dietist' is een v2.5-uitbreiding.

**Slot-filter met tussendoortjes-groep.** SLOT_FILTER groepeert snack_ochtend/middag/avond als één 'Tussendoor'-chip. Andere views (week, dag) blijven werken met de drie aparte slot-types.

**`components/meal-picker.js`.** Form-velden toegevoegd voor cuisine (dropdown), hoofdingredient (dropdown), kookwijze (checkboxes), dieet (checkboxes), bereidingstijd (number). 'Geschikt voor'-fieldset (peter/miranda/beiden) is verwijderd — past bij Peter's wens 'niet meer verdelen onder personen'. `suitable_for` blijft default `['beiden']` in DB voor backwards-compat.

**Beslissingen voor later.**
- Echte rating-aggregaat per meal (vs week_meals huidige flow) — sortering 'Beoordeling' is nu placeholder 0.
- Source-detectie 'dietist' via JOIN met weeks-tabel.
- Grid/lijst-toggle voor de results.
- Favorieten-veld op meals.
- Multi-select & bulk-toevoegen aan een week.
- Ingredient-gebaseerde cuisine-detectie voor de 286 niet-getagde recepten.

---

## 2026-05-09 — v2.3a: UI-cleanup in 'Stel zelf samen'

**Aanleiding.** Peter wil dat de Maker-tab (= 'Stel zelf samen') meer als een gedeelde recepten-pool aanvoelt en niet meer per persoon filtert. Plus: de winkel-keuze per ingrediënt is overbodig sinds v2.0 toen winkel-routes uit de boodschappenlijst gingen.

**Gedaan.**
- `views/build.js`: voor-wie-filter (chips iedereen/beiden/Peter/Miranda) volledig verwijderd. `vs.suitable` state weg, filter-toepassing weg, clearFilters/hasFilters bijgewerkt. Tag-filter blijft, kcal-slider blijft, seizoen blijft, slot-type blijft.
- `components/meal-picker.js`: winkel-`<select>` verwijderd uit de ingredient-rij. WINKELS-import weg. `emptyIngredient()` heeft geen `store`-veld meer. `ing-row` grid-template-columns aangepast naar 4 kolommen (was 5). Mobile media-query bijgewerkt.
- Bestaande store-data in DB blijft staan (`_origStore` houdt de waarde vast bij edit, schrijft 'm onveranderd terug). Geen verlies van historische info.
- `version.js`: v2.3 → v2.3a.

**Bewust niet gedaan.**
- `lib/winkels.js` en `lib/winkelroutes.js` blijven staan (geen UI-koppeling meer maar weghalen kost een ongerelateerde commit).
- `meals.suitable_for` array blijft in schema. Nieuwe meals krijgen default `['beiden']` via meal-picker. Boodschappenlijst-aggregator gebruikt het niet meer; de week-views gebruiken het indirect via persoon-toggle in header.

---

## 2026-05-09 — v2.3-import: bulk recipe-scrape (Miljuschka, AH, 24kitchen)

**Aanleiding.** Peter wil een gevulde bibliotheek voordat we filters bouwen. Doel: 100+ dineren, 100+ ontbijten, 100+ lunches.

**Resultaat (in ~2 uur autonoom werk).**
- diner: 220 actief (was 13). Miljuschka 96 + AH 62 + 24kitchen 49.
- ontbijt: 133 actief (was 13). Miljuschka 98 + AH 18 + 24kitchen 4.
- lunch: 104 actief (was 13). AH 52 + Miljuschka 39.
- snack_avond: 7 (ongewijzigd).
- **Totaal nieuwe recepten: 418.**

**Schema-wijzigingen.** Migratie `v2_3_meals_add_source_columns` voegt drie kolommen toe aan `meals`:
- `source_url text` — link naar oorsprong
- `source_site text` — domein (miljuschka.nl, ah.nl, 24kitchen.nl)
- `description text` — korte beschrijving uit schema.org/Recipe

**Architectuur van de import.**
1. Chrome MCP-extensie open op de bron-site (anders 403 op miljuschka door Cloudflare).
2. JS in tab fetcht overzichtspagina's (parallel, concurrency 8), regext recipe-URLs.
3. Per URL fetch + parse `<script type="application/ld+json">` voor schema.org/Recipe.
4. Lichte ingredient-parser (regex op qty + unit + name) met dedup van 'water' en strip van vetgehalte-aanduidingen volgens de aggregatieregels.
5. Bulk POST naar tijdelijke Supabase Edge Function `bulk-import-meals` met shared-secret header en SERVICE_ROLE-credentials in de function (RLS bypass).
6. Edge function dedupt case-insensitive op naam tegen bestaande active meals.

**Filter voor ontbijt + lunch.** Eerst probeerden we strikt 'zeer gemakkelijk' (≤15 min OF ≤7 ingredienten) maar dat liet veel te weinig over. Voor de eindronde alle gevonden recepten gepakt; 'gemakkelijk'-filter kan later in het programma als feature.

**Edge function uitschakeld.** `bulk-import-meals` is na de import vervangen door een 410-stub. Reactiveren = redeploy met de oude code uit deze sessie. Shared-secret was `owm-bulk-7f3a2b4c-temp-2026` (niet meer geldig).

**Beperkingen die we tegenkwamen.**
1. Jumbo: tab vastgelopen door tracking-scripts; geen recepten geïmporteerd. Strategie voor later: gebruik de Jumbo recepten-API als die te vinden is, of fetch meer rauwe HTML.
2. javascript_tool truncate ~1KB per response. Daarom: alle scrape+parse+post binnen één call, alleen telling teruggeven.
3. Cross-origin fetch werkt alleen als de tab op het juiste domein staat. Per bron eerst navigeren.
4. Recipe-tekst soms zwaar: 'recipe' veld in DB bevat numbered steps; lange recepten kunnen 5-10K chars zijn. Past prima in JSONB, maar speelt mee bij wat we via tool-output kunnen ophalen.

**Open punten voor v2.4.**
- Filters in BuildView (Maker): bereidingstijd-slider, max-ingredienten, type-filter, source-site-filter. De data is er nu.
- 'Open recept op site' knop in meal-detail, gebruikt `meals.source_url`.
- Hardcoded BUILTIN_IGNORED met 'water' in `lib/ignored.js`.
- Jumbo opnieuw proberen — andere strategie voor lazy-loaded SPA.
- Categorisering binnen diner: tags op basis van keywords (pasta, vegetarisch, vis, oven, traybake, snel) zodat de bibliotheek bruikbaar wordt.
- Auto-cleanup: detectie van duplicate recepten met andere naam-spelling.

---

## 2026-05-10 — v2.14: alias + soft-unit merge in boodschappenlijst

**Aanleiding.** Peter signaleerde dat "Kaas" en "Kaas naar keuze" als aparte regels op de boodschappenlijst stonden, idem "Ei" en "Roerei". Boodschappen werden zo onnodig dubbel gevraagd.

**Diagnose (twee verschillende oorzaken).**
1. *Kaas / kaas naar keuze.* `normalizeName('Kaas naar keuze')` gaf al 'kaas' (test bestond), maar de groepeer-key is `nameKey::unit::store`. "Kaas naar keuze" komt zonder qty en met lege/`naar_smaak` unit binnen — dus andere unit-key, twee groepen.
2. *Ei / roerei.* "Roerei" is geen bereidingswijze in `BEREIDING_RE` (zelfstandig woord), dus normalizeName liet 'roerei' staan. Aparte nameKey, aparte groep.

**Wijzigingen in `lib/shopping.js`.**
- `ALIAS_PAIRS` toegevoegd: regex-paren die in `normalizeName` toegepast worden ná de bereidings-/keuze-strip. Bevat `roerei` → `ei` en `roereieren` → `ei`.
- Post-merge pas in `aggregateShopping` ná de hoofdloop: groepen met soft-unit (`'' | 'naar_smaak'`) worden ingevouwen in de qty-houdende groep met dezelfde `nameKey + store`. Bij meerdere qty-doelen wint de groep met de hoogste `count` (meest dominante unit deze week). Snufje blijft expliciet *niet* soft (concrete kleine hoeveelheid).
- Sources, variants, who en qtyMissing-flag worden samengevoegd. `partial` valt automatisch op true via de bestaande `partial = qtyMissing && qty > 0`-logica.

**Tests.**
- `app/test/shopping.test.js`: 4 nieuwe tests — kaas+naar-keuze merge (qty=30, partial=true), ei+roerei merge (qty=5, naam "Ei"), regressie kwark magere/volle apart, regressie geraspte kaas apart.
- `app/test/helpers.test.js`: 2 normalizeName-tests voor 'Roerei' en 'Roereieren'.
- 75/75 tests groen lokaal.

**Bewust niet gedaan.**
- `chooseDisplayName` ongewijzigd. Als "Roerei" alleen voorkomt zonder een echte "Ei"-regel, toont de boodschappenlijst "Roerei" (omdat variants size=1). Acceptabel — Peter klaagde over dupliceren, niet over de display-naam wanneer er maar één variant is.
- "Snufje" niet als soft-unit. Een snufje peper is een concrete eenheid, geen wildcard.
- Generieke alias-tabel niet uitgebreid met andere paren — alleen gemelde concrete cases (roerei). Bij volgende klacht uitbreiden.

**Risico/observatie.**
- Soft-unit merge raakt ook andere "naar keuze"-items (Beleg naar keuze, Fruit naar keuze) als er ook concrete varianten zijn. Dat is bewust het beoogde gedrag. Bij vreemde merges: log via `sources` per item is intact, dus terug te traceren.

**Versie.** `v2.13` → `v2.14`. `version.js` bijgewerkt.

**Backup.** `outputs/shopping.v2.13.backup.js` bewaard tot deze release stabiel draait in productie.

---

## 2026-05-10 — v2.15: cross-unit naar-keuze merge

**Aanleiding.** Live data-check op week 20 (productie Supabase) liet zien dat de v2.14-fix wel ei/roerei oplost (alle ei-rijen op `unit=st`, mergen perfect tot één regel met qty=28 st), maar de gemelde "Kaas + Kaas naar keuze" niet. In de echte data heeft Peter "Kaas" 1 st (omelet ontbijt) en Miranda "Kaas naar keuze" 3× 40 g (snack-avond). Verschillende echte units, dus de v2.14 soft-unit merge raakt deze niet.

**Inzicht.** "Naar keuze" is in de regelteksten van de diëtist een semantische hint (huishouden-staple), los van of er een unit aan hangt. De juiste merge volgt de bedoeling, niet de unit.

**Wijzigingen in `lib/shopping.js`.**
- Per source een `optional`-vlag op basis van `\bnaar keuze\b` in de raw `originalName`.
- Per groep een `allOptional`-veld dat true blijft zolang elke source optional is.
- `isSoft(g)` in de post-merge wordt: unit ∈ ('' | 'naar_smaak') OF `allOptional === true`.
- Merge-stap onderscheidt twee gevallen:
  - Gelijke unit → qty optellen (zoals v2.14).
  - Verschillende unit (alleen mogelijk via allOptional-route) → qty NIET optellen, maar `qtyMissing=true` zetten zodat de regel partial wordt en de detail-view via `sources[]` beide bronnen kan tonen.

**Tests.**
- `shopping.test.js`: 2 nieuwe tests — kaas (st) + kaas naar keuze (g) mergen tot 1 regel met qty=1, unit=st, partial=true, 4 sources; honing el + honing g (zonder 'naar keuze') blijft 2 regels.
- 77/77 tests groen lokaal.

**Effect op week 20.** Eén "Kaas"-regel met qty=1 st (Peter's omelet) en partial-flag; Miranda's 120 g zit in de sources voor de detail-view. Het ei/roerei resultaat van v2.14 blijft ongewijzigd.

**Bewust niet gedaan.**
- Generieke cross-unit qty-mix met som-string ("1 st + 120 g") niet ingebouwd. Dat raakt UI-rendering en is een aparte release.
- Snufje blijft géén soft-unit.
- "Naar keuze" als enige variant zonder qty-doel: geen merge, blijft eigen regel (correct).

**Risico.** Een groep waarvan ALLE sources puur "naar keuze" zijn (geen concrete variant), gedraagt zich nu als allOptional. Maar zonder een non-soft target in dezelfde nameKey+store gebeurt er geen merge. Dus geen onbedoelde verdwijning.

**Versie.** `v2.14` → `v2.15`. `version.js` bijgewerkt.

---

## 2026-05-10 — v2.16: ingredient_aliases + canonical-mapping (lemma-laag)

**Aanleiding.** Peter wil een restjes-zoeker ("ik heb deze 3 ingrediënten nog in huis, welk recept past?"). Eerste meting op de bibliotheek: 220 actieve diners, 2650 ingredient-rijen, 1274 unieke `name_key`s. Long tail: 71% van die keys komt in slechts 1 recept voor. Ergst: ui-cluster (5 keys → 92 recepten), olijfolie-cluster (3 keys → 101), knoflook-cluster (2 keys → 88), ei (2), peper en zout volgordeverschil. Restjes-zoek faalt zonder lemma-laag: input "ui" matcht maar 28 van 92 ui-recepten.

**Keuze.** Geen pattern-based plural-strip (te brokkelig — "kruiden"→"kruid", "garnalen"→"garnaal" werken niet via simpele regex). Wel een expliciete alias-tabel in Supabase. Alleen handmatig gecureerd voor de tier 1+2 stam (≥5 recepten = 95 keys). Long tail blijft as-is — die keys komen in zo weinig recepten voor dat de impact op zoek-coverage klein is.

**Database.** Nieuwe tabel `public.ingredient_aliases (raw_key text PK, canonical_key text NULLable, source text, created_at)`. RLS: read voor authenticated, write via service-role (admin/import). `canonical_key=NULL` betekent: ingredient overslaan in zoek (parser-vuiltjes zoals 'keukenmachine'). Migratie + seed in `supabase/migrations/v2_16_ingredient_aliases.sql` en `supabase/seeds/ingredient_aliases_v2_16.sql`. ~95 entries.

**Bewuste keuzes in mapping.**
- "Rode ui" / "middelgrote uien" / "uien" → canonical `ui`. Voor inkoop blijven ze apart (de boodschappen-aggregator gebruikt deze tabel NIET, behoudt `normalizeName` uit `shopping.js`).
- "Milde olijfolie" / "extra vierge olijfolie" → canonical `olijfolie`. Functionele inwisselbaarheid voor restjes-zoek.
- "Kippenbouillon" / "groentebouillon" / "runderbouillon" → canonical `bouillon`. Smaak verschilt maar voor restjes-zoek pragmatisch samen.
- "Volle melk" → canonical `melk`. "Griekse yoghurt" → `yoghurt`.
- "Tomatenpuree" blijft eigen canonical (verwerkt product, niet ≡ tomaat).
- "Rode peper" (groente) blijft eigen canonical (≠ specerij `peper`).
- Parser-vuiltjes met qty/unit in de naam ('g boter', 'cm gember', 'stengels bleekselderij') gemapt naar het echte ingredient.
- 'keukenmachine' → NULL (skip, geen ingredient).

**Pantry-default voor de zoek-laag.** water, zout, peper, peper en zout, zout en peper, olijfolie, zonnebloemolie, neutrale olie, sesamolie, boter, bloem, suiker. Wordt expliciet gebruikt in v2.17 (restjes-zoek-algoritme). Niet aanpasbaar per huishouden in deze versie.

**JS-laag.** Nieuwe module `app/src/lib/ingredients.js` met:
- `setAliasMap(rows)` — vervangt de in-memory map.
- `canonicalKey(rawName)` — eerst `normalizeName` uit shopping.js, dan alias-lookup. Returnt string, of `null` (skip), of `''` (lege input).
- `canonicalKeysOfIngredients(ingredients)` — Set van canonical-keys voor een lijst, dedupliceert + skipt nulls.
- `getAliasMapSize()` — diagnostiek.

`lib/data.js` krijgt `loadIngredientAliases()` met cache. `clearCache()` reset deze ook.

**Tests.** 9 nieuwe tests in `app/test/ingredients.test.js`. Geen wijzigingen aan bestaande tests. 86/86 groen lokaal.

**Niet meegenomen in v2.16.**
- Restjes-zoek-algoritme/UI (= v2.17).
- Long-tail aliases (>1 recept): later, eventueel via LLM-pas op nieuwe import-batches.
- Pantry per huishouden in profile.

**Versie.** `v2.15` → `v2.16`. `version.js` bijgewerkt.

**Migratie + seed nog niet toegepast op productie.** Wacht op akkoord van Peter voor `apply_migration` op project `domorqjzpaytpitvloeg`.

**Update na akkoord (10 mei 2026):** migratie en seed toegepast. 95 alias-rijen in productie. Impactcheck: 1054 van 2650 ingredient-rijen (40%) loopt nu via canonical-mapping; 1274 unieke raw_keys → 1238 unieke canonicals (36 keys samengevouwen).

---

## 2026-05-10 — v2.17: restjes-zoeker MVP in BuildView

**Aanleiding.** Tweede helft van Peters wens uit deze sessie: aan het eind van de week blijven er regelmatig ingrediënten over en hij wil daar een diner bij vinden. v2.16 heeft de canonical-mapping gelegd; v2.17 is het feature dat erop draait.

**Architectuur.** Drie nieuwe lib-modules + UI-uitbreiding in `views/build.js`. Geen nieuwe view of routing.
- `lib/pantry.js` — exporteert hardcoded `PANTRY` Set en `isPantry()`. 12 keys: water, zout/peper-combos, oliesoorten, boter, bloem, suiker. v2.18+: aanpasbaar in profile.
- `lib/recipe-search.js` — pure `searchByIngredients(meals, inputKeys, opts)` en `recipeCanonicalSet(meal)`. Score = matched / required, waarbij required = canonical keys ∖ pantry. Sortering: score desc, dan |missing| asc, dan naam.
- `lib/ingredients.js` (uit v2.16) — `canonicalKey()` en `canonicalKeysOfIngredients()` worden hier gebruikt.

**UI-integratie in BuildView.**
- Toggle in de filter-rail "🍳 Restjes-modus" met counter zodra ingrediënten ingevoerd.
- Wanneer aan: chips-bar boven de results met de ingevoerde canonical-keys (klikbaar voor remove), input met `<datalist>` autocomplete uit `topCanonicals` (top-200 niet-pantry keys gesorteerd op aantal recepten waarin ze voorkomen — eenmalig berekend bij `loadAll()`).
- Bij ≥1 ingrediënt: de andere filters (slot, cuisine, kookwijze, etc.) worden eerst toegepast, daarna `searchByIngredients` op het resultaat. Alleen `slot='diner'` (de bibliotheek-pijn zit daar).
- Drempel-slider (0.3–1.0, default 0.5).
- Per match in lijst- of grid-view: pill met match-percentage en strip "nog nodig: X, Y" (of "alles in huis ✓").

**Bootstrap.** `main.js` roept `loadIngredientAliases()` aan bij `auth.status === 'ready'` en zet via `setAliasMap()` de map in `lib/ingredients.js`. RLS vereist `authenticated`, dus deze volgorde is verplicht.

**Niet meegenomen.**
- Geen score-cutoff per slot — alleen diner.
- Geen pantry-aanpassing in profile (komt later).
- Geen weging op hoofdingredient (alle ingrediënten tellen gelijk).
- Match-strip toont canonical-keys in lower-case zoals ze in de alias-map staan; geen mooi gepresenteerde labels (verbetering voor v2.18).

**Tests.** 9 nieuwe in `app/test/recipe-search.test.js` (lege input, score-berekening, slot-filter, deleted skip, skip-alias, sortering, limit cap). 95/95 totaal groen.

**Versie.** `v2.16` → `v2.17`. `version.js` bijgewerkt.

---

## 2026-05-10 — v2.17.1: hotfix algoritme restjes-zoeker

**Aanleiding.** Peter test op productie met input "komkommer" → 0 resultaten, terwijl 18 actieve diners komkommer bevatten. Probleem: default `minScore=0.5` was te streng. Gemiddeld diner heeft 9 niet-pantry ingrediënten; één input-ingredient geeft 1/9 ≈ 11% score, dat valt onder de drempel weg.

**Diagnose.** Het algoritme prefereerde "compleet kunnen koken" boven "vinden waar mijn ingredienten in voorkomen". Voor restjes-doel hoort het tweede primair te zijn.

**Wijzigingen.**
- `searchByIngredients`: default `minScore` van 0.5 → 0. Recepten waar de score onder de drempel valt komen alsnog door zolang er ≥1 match is. Toegevoegd: harde filter `matched.length === 0` → uitsluiten (anders zou letterlijk elk diner verschijnen bij willekeurige input).
- Sortering: primair `matched DESC` (aantal raken), secundair `missing ASC`, tertiair naam. Score blijft als info-pill in de UI maar bepaalt de volgorde niet meer.
- UI in BuildView: drempel-slider gaat nu 0–100% met default 0 ("uit"). Tekst veranderd van "X matches ≥50%" naar "X recepten met je ingrediënten". Empty-state-tekst: "Geen diner bevat één van deze ingrediënten" i.p.v. de score-cutoff-tekst.

**Tests.** Twee tests aangepast (de oude minScore-test gesplitst in 'default-uit' + 'opt-in-werkt'); sortering-test uitgebreid met 4 cases voor de nieuwe matched-DESC volgorde. 96/96 groen.

**Versie.** `v2.17` → `v2.17.1`.

---

## Backlog v2.18 — open punten

**1. Long-tail alias-meting na een week gebruik.**
- Doel: de keys uit de "1-4 recepten"-tier die in productie veel als zoekinput voorkomen alsnog naar canonical mappen.
- Hoe: query op `ingredient_aliases` (welke raw_keys hebben we al) en op `meals.ingredients` (welke raw-keys komen voor in 1-4 actieve diners). Daaruit top-100 ontbrekende kandidaten halen. Per cluster handmatig of via LLM voorstellen genereren, reviewen, in één seed-bestand toevoegen.
- Verwacht: ~80-150 nieuwe aliases. Coverage van 40% naar ~60-70%.
- Trigger: zodra Peter de restjes-zoeker een week gebruikt heeft en gevallen "ik typte X maar er kwam niets" rapporteert.

**2. Macro-aanvulling op de bibliotheek voor v2.4-uitbreiding.**
- Diner-macros zijn nu 51% gevuld. Bij het uitbreiden van de bibliotheek (richting 700) eerst de bestaande lege macros aanvullen via de `ingredient_macros`-pipeline (v2.7) zodat de filter "kcal-max" niet de helft uitsluit.
- Werkpaden: `lib/ingredient-macros.js` (bestaand), draait per recept een berekening op basis van ingredient-tabel.

**3. Pantry per profile.**
- Huidige PANTRY (`lib/pantry.js`) is hardcoded. Verplaats naar `profiles.pantry text[]` met de huidige set als default. UI: editor in profiel-pagina.

**4. Bibliotheek-uitbreiding.**
- Site-research voor diner-recepten zoals besproken. Voedingscentrum, Lekker en Simpel, Brenda Kookt, Leuke Recepten, OhMyFoodness. Pas na punten 1+2 starten zodat de nieuwe data direct schoon canonical+macro krijgt.

---
