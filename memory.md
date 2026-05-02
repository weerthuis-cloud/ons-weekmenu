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
