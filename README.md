# ons weekmenu

Webtool voor het huishouden van Peter en Miranda. Wekelijkse menu's van de dietist invoeren, bekijken per dag of per week, boodschappenlijst genereren, archief opbouwen, eigen menu's samenstellen met filters.

## Status

Huidige versie: **v2.34** (RLS-fix gedeeld account + AVG-leesrechten + rating-behoud bij ruilen/verplaatsen). Code-deel (rating) vereist deploy; de RLS/AVG-migraties draaien al server-side. Daarvoor: v2.32 (week 27 import). Diëtistweek 9 = kalenderweek 27 (29 juni t/m 5 juli 2026) geïmporteerd voor Peter en Miranda: 7 diners (serves 4, suitable_for beiden) met goedgekeurde receptfoto's, 34 solo-meals (17 per persoon, serves null, dedup binnen de week) en 56 week_meal-koppelingen over 4 slots (ontbijt/lunch/diner/snack_avond). Macro's berekend uit NEVO, overzicht in `outputs/week27_macros.xlsx`. Zondag-diner gevuld met AH-recept "Zuid-Amerikaanse maaltijdsoep met kip & bonen" (435 kcal); baked oats en tex-mex tosti als losse bibliotheek-recepten toegevoegd (WK27_LIB). Foto's: vrij-gelicentieerde Pexels-CDN (path-only/no-referrer) + AH-static voor de soep. Backup en rollback in `backups/pre_wk27_2026.json` (alle nieuwe meals dragen tag `WK27`).

Vorige: v2.31 (archief uitgebreid). De archief-kaarten tonen nu een mozaïek van de echte receptfoto's van die week (diners eerst, terugval op gekleurde vlakken als er geen foto's zijn), een favoriet-ster (nieuwe kolom `weeks.favoriet`) met filterknop "★ Favorieten", en een voortgangsbalkje. "Dupliceer" is "Kopieer naar…" geworden met keuze van doelpersoon (ook naar de ander). Extra: notitie per week (tonen + bewerken), een knop "Boodschappen" die direct de lijst voor die week opent, en per persoon een knop "+ week vooruit plannen" die een lege eigen week aanmaakt en opent.

Vorige: v2.30 (bredere recept-editor 1040px + ingesprongen genummerde bereidingslijst met bewerk-toggle), v2.29 (planner als dagkaarten in agenda-stijl met SVG lijn-iconen), v2.28 (recept-editor twee kolommen: plan-knop boven, ingrediënten + bereidingswijze naast elkaar, bron/foto-URL onderaan; conservatieve classificatie-aanvulling keuken/hoofd/kookwijze/dieet — backup `zz_meals_class_bak_v228`, overzicht `outputs/classificatie_aanvulling_v2.28.xlsx`), v2.27 (inplannen vanuit de Bibliotheek via kalender-knop + `meal-scheduler.js` weekraster), v2.26 (type-knoppen in de picker + terugdraaien bij auto-genereren; database-onderhoud 11 misgeclassificeerde ontbijt-meals), v2.25 (filterbalk in de maaltijd-picker: keuken, hoofdingrediënt, max kooktijd, dieet, kookwijze, favoriet, met resultaatteller en wis-knop; client-side), v2.24 (Week 25 automatische import, diëtist-week 7 = kalenderweek 25, ma 15 t/m zo 21 juni 2026; eerste testrun auto-import vanuit Gmail/Drive: 7 diners + 35 solo-meals + 56 week_meal-koppelingen, macros via NEVO in `outputs/week25_macros.xlsx`, 972 meals actief), v2.23 (week 23 import + image_url-backfill), v2.22 (week 22 import).

Versies in volgorde:
- v0.1 fundament en design tokens — klaar
- v0.2 Supabase + magic-link auth + onboarding — klaar
- v0.3 handmatige invoer + week- en dagweergave + maaltijd-picker — klaar
- v0.4 boodschappenlijst (aggregatie + 3 modi + afvinken + print) — klaar
- v0.5 archief (weken openen + dupliceren) + maker (bibliotheek met filters + edit/soft-delete) — klaar
- v0.6 polish-pass: alle 5 views naar visuele taal van prototype — klaar
- v0.7 PDF-import (Cowork-route primair, pdf.js client-side als fallback) — klaar
- v0.8 boodschappenlijst: naam-normalisatie + categorie-groepering + handmatige qty — klaar
- v0.9 recepten in maaltijden + detail-modal voor gevulde cells — klaar
- v1.0 GitHub Pages deploy + final AVG-check — klaar
- v1.0a–h notities-paneel, mobiele UX, wachtwoord-login, gedeeld auth-account, afgevinkt-sectie — klaar
- v1.1 'naar keuze'-items, toppings-bijlage, verplaats+ruil binnen slot — klaar
- v1.2 boodschappenlijst rekent diner-recepten mee, geschaald op aantal eters per maaltijd — klaar
- v1.3 per-recept akkoord-flow met checkboxes voor in-huis-items, dag-kleur tracking in lijst — klaar
- v1.4 mobiel: horizontale swipe-navigatie tussen Week / Vandaag / Boodschappen — klaar
- v1.5–v1.9 mobile fixes, classifier uitbreiding, recept-incompleet waarschuwing, in-huis-toggle, achterkant verstevigen (tests/backup/AVG/PWA), negeer-lijst — klaar
- v2.0 dag-filter in boodschappenlijst — klaar
- v2.1 CI tests gate — klaar
- v2.2a–d UI-polish, edge-cases — klaar
- v2.3 rating per diner (👍/neutraal/👎 met auto soft-delete bij negatief), kwark-split in boodschappen (volle ≠ magere), import week 20, cleanup van 14 duplicate meals — klaar
- v2.3-import bulk recipe-scrape: 220 dineren + 133 ontbijten + 104 lunches uit Miljuschka, AH Allerhande, 24kitchen — klaar
- v2.3a UI-cleanup in 'Stel zelf samen': geen voor-wie-filter meer, geen winkel-dropdown in ingredient-editor — klaar
- v2.4 Bibliotheek (hernaamd uit Stel zelf samen): database-view met keuken-, kooktijd-, hoofdingrediënt-, kookwijze-, dieet-, bron-filter, sorteer-dropdown en counts per chip — klaar
- v2.5 Mobile auto-scroll naar 'vandaag' in weekmenu, diëtist-bron via JOIN gemarkeerd, cuisine-coverage 38%→67% via ingrediënt-detectie — klaar
- v2.6 Macro-targets + daily-overzicht in weekmenu, favorieten + grid/lijst toggle in Bibliotheek, rating-aggregaat per meal voor sortering, settings-modal — klaar
- v2.7 Ingredient-macros database (343 entries) + aggregator-functie compute_meal_macros(); macro-coverage opgekrikt van 14% naar 62% — klaar
- v2.7a–c Bereidingswijze + beschrijving + bron-URL in meal-editor; ingrediënten boven bereiding; auto-growing textarea zonder scrollbalk; macro-cellen horizontaal in 1 rij — klaar
- v2.8 meals.image_url + re-scrape Recipe.image (418/464 dekking); meal-card toont foto met lazy-load en no-referrer — klaar
- v2.22 Week 22 import (25-31 mei): 7 nieuwe diners + 34 solo-meals + 56 week_meal-koppelingen. Macros voor het eerst zelf berekend uit NEVO-database in plaats van compute_meal_macros() — xlsx-rapport met formules voor narekenen — klaar
- v2.25 Filterbalk in de maaltijd-picker (kies-modus): keuken, hoofdingrediënt, max kooktijd, dieet, kookwijze, favoriet + resultaatteller + wis-knop; inklapbaar, mobielvriendelijk, logica gespiegeld aan Bibliotheek — klaar
- v2.26 Type-knoppen in de picker (Ontbijt/Lunch/Diner/Tussendoor, omzetbaar, default = categorie van de cel) + terugdraaien bij auto-genereren (snapshot vóór genereren, herstel-knop in resultaatscherm) + correctie 11 misgeclassificeerde ontbijt-meals — klaar
- v2.27 Inplannen vanuit de Bibliotheek: 📅-knop op kaart en lijst-rij opent meal-scheduler.js (weekraster met bestaande planning, persoon + beiden-vinkje, week-navigatie, cel aanklikken plaatst gerecht, week wordt zo nodig als eigen week aangemaakt) — klaar
- v2.28 Recept-editor opnieuw ingedeeld (plan-knop boven, ingrediënten + bereidingswijze in twee kolommen, bron/foto-URL onderaan) + conservatieve classificatie-aanvulling van keuken/hoofdingrediënt/kookwijze/dieet op lege velden — klaar
- v2.29 Inplan-planner omgebouwd naar dagkaarten (agenda-stijl) met strakke SVG lijn-iconen i.p.v. emoji; rustiger en mobielvriendelijker — klaar
- v2.30 Recept-editor verbreed naar 1040px (ingrediënt-rijen passend, eenheid breed genoeg) + bereidingswijze als ingesprongen genummerde lijst met bewerk-toggle (parseSteps) — klaar
- v2.31 Archief uitgebreid: foto-mozaïek (meal image_url, fallback hues) + favorieten (kolom weeks.favoriet + filter) + Kopieer-naar-week met doelpersoon + notitie per week + Boodschappen-knop per kaart + week-vooruit-plannen-knop — klaar
- v2.32 Week 27 import (diëtistweek 9, 29 juni–5 juli 2026): 7 diners + 2 bibliotheek-recepten + 34 solo-meals + 56 week_meal-koppelingen voor Peter en Miranda. Zondagsoep aangevuld uit AH Allerhande, diner-foto's uit vrije Pexels-bron, macro's uit NEVO (`outputs/week27_macros.xlsx`). Rollback via tag `WK27`. — klaar
- v2.33 RLS-fix gedeeld auth-account: ruilen en verwijderen werkten alleen voor Peter, niet voor Miranda. Oorzaak: `weeks.owner` = `profiles.id`, maar de schrijf-policies eisten `owner = auth.uid()`. Peters `profile_id` is gelijk aan het auth-account, Miranda's niet, dus al haar wijzigingen werden stil geblokkeerd (lezen mocht wel). Schrijf-policies (insert/update/delete) op `weeks`, `week_meals`, `shopping_lists` en `shopping_notes` herschreven naar `profiles.user_id = auth.uid()`. Server-side migratie, geen redeploy nodig. Migratie + rollback in `supabase/migrations/v2_33_rls_gedeeld_account.sql`. — klaar
- v2.34 Twee nablijvers van de RLS-fix. (1) AVG: leesrechten op `weeks`, `week_meals`, `shopping_lists`, `shopping_notes` en `profiles` ingeperkt van "iedere ingelogde gebruiker leest alles" naar het eigen huishouden (`profiles.user_id = auth.uid()`); beiden-weergave en archief blijven werken want Peter en Miranda delen het account. Server-side migratie + rollback in `supabase/migrations/v2_34_rls_read_household.sql`. (2) App-fix in `data.js`: bij ruilen en verplaatsen reist de beoordeling (👍/👎) nu mee met het gerecht in plaats van verloren te gaan. Vereist deploy. — klaar

## Architectuur

- **Frontend**: Vite + vanilla JS + lit-html. Hash-router voor GitHub Pages.
- **Backend**: Supabase (EU-regio), magic-link auth, RLS per profiel.
- **Hosting**: GitHub Pages.
- **PDF-parse**: pdf.js, client-side. PDF blijft op het apparaat tijdens parsen.

## Mappen

```
ons weekmenu/
├── README.md                     dit bestand
├── memory.md                     projectlogboek (beslissingen, lessons learned)
├── .gitignore                    sluit secrets, builds, PDF's uit van git
├── Weekmenu Prototype _standalone_.html   originele design-blauwdruk (niet aanraken)
├── .github/
│   └── workflows/
│       └── deploy.yml            CI/CD: bouwt + deployt naar GitHub Pages bij push naar main
├── app/                          de werkende app
│   ├── package.json
│   ├── vite.config.js            base = '/ons-weekmenu/' in production
│   ├── index.html
│   ├── .env.example              sjabloon voor env-vars
│   ├── .env.local                lokale Supabase-keys + allowlist (NIET in git)
│   └── src/
│       ├── main.js               entry, state, auth-routing, render
│       ├── router.js             hash-router
│       ├── shell.js              header + nav (alleen na login)
│       ├── styles/               tokens.css, base.css
│       ├── views/                week, dag, lijst, archief, maker, import, login, onboarding
│       ├── components/           food-ph, meal-card, meal-picker, checkbox, sparkline, logo, slot-icon
│       └── lib/                  supabase, auth, data, datums, slots, units, winkels, shopping, cat, pdf-extract, pdf-parse-soft
└── supabase/
    └── schema.sql                tabellen + RLS (uit te voeren in Supabase SQL editor)
```

## Lokaal draaien

Vereist: Node 18+ en npm. Een `.env.local` met Supabase-keys (zie hieronder).

```bash
cd app
npm install
npm run dev
```

Dev-server draait op `http://localhost:5173`.

### Supabase-configuratie (eenmalig)

Het Supabase-project staat al in eu-central-1 (Frankfurt) en het schema is toegepast.

Project-ID: `domorqjzpaytpitvloeg`
URL:        `https://domorqjzpaytpitvloeg.supabase.co`
Dashboard:  https://supabase.com/dashboard/project/domorqjzpaytpitvloeg

`app/.env.local` bevat de URL en publishable key. Niet committen (staat in `.gitignore`). Bij verlies opnieuw ophalen via Project Settings → API.

### Eerste keer inloggen (Peter en Miranda)

1. Start de dev-server.
2. Open `http://localhost:5173`. Je ziet het login-scherm.
3. Vul je e-mailadres in (alleen adressen op de allowlist in `src/lib/supabase.js` werken). Klik "Stuur magic link".
4. Open de mail in dezelfde browser, klik op de link. Je komt terug in de app.
5. Eerste keer: kies "Peter" of "Miranda" in het onboarding-scherm. Daarna val je in de gewone app.
6. Herhaal voor de tweede persoon (in een andere browser of incognito).

### Allowlist en signups dichtzetten

Soft check: e-mailadressen staan in `VITE_ALLOWED_EMAILS` (env-var, komma-gescheiden). Lokaal in `app/.env.local`, in productie als GitHub Secret. Niet hardcoded → veilig voor publieke repo.

Strikte check (na onboarding): zet in het Supabase-dashboard onder **Authentication → Sign In / Up → Email** de optie "Allow new users to sign up" uit. Vanaf dat moment kunnen alleen bestaande `auth.users` nog inloggen.

## Wekelijkse routine (automatische import)

De diëtist (Choose Your Diet, `voedingsschema@chooseyourdiet.nl`) mailt elke vrijdag rond 06:00 twee schema's naar `devlindegoede@gmail.com`, één voor Peter en één voor Miranda, elk met een schema-PDF en een receptenboek-PDF.

Automatische keten (binnen Google, AVG-bewust):

1. Apps Script `automation/gmail-to-drive.gs` zet de PDF's wekelijks in de Drive-map "Weekmenu PDFs" (zie `automation/SETUP-gmail-to-drive.md`).
2. De Drive-koppeling en Gmail-koppeling in Cowork staan op hetzelfde account (`devlindegoede@gmail.com`), zodat de import de PDF's als tekst kan lezen.
3. De wekelijkse Cowork-taak leest de PDF's, mapt diëtist-week N naar de kalenderweek uit de PDF, berekent macro's via NEVO, kiest foto's, en schrijft weeks + week_meals naar Supabase.
4. Voor elke schrijfbeurt eerst een backup in `backups/`, daarna versie-bump en een macro-rapport in `outputs/`. Afsluitend de 4-veld-smoketest (0 cellen zonder ingrediënten/foto/kcal).

Diners zijn voor Peter en Miranda identiek (`suitable_for ['beiden']`); ontbijt, lunch en tussendoor verschillen per persoon. Nieuwe maaltijden krijgen een tag `WK<nr>_LOOKUP_*` (diner) of `WK<nr>_SOLO_*` (solo) zodat een week terug te rollen is.

Backup-route (als Cowork niet beschikbaar is): in de Import-tab van de app kun je zelf een PDF uploaden. Pdf.js parseert client-side. Best-effort, vereist handmatige correctie.

## Deploy naar GitHub Pages

Eenmalige setup (~10 min):

1. Maak een **publieke** GitHub-repo aan: `ons-weekmenu`.
2. Push de hele inhoud van `/ons weekmenu/` (dus inclusief `app/`, `supabase/`, `.github/`) naar `main`.
3. In GitHub repo: Settings → **Pages** → Source: **GitHub Actions**.
4. In GitHub repo: Settings → Secrets and variables → **Actions** → New repository secret:
   - `VITE_SUPABASE_URL` = `https://domorqjzpaytpitvloeg.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (kopiëer uit `app/.env.local`)
   - `VITE_ALLOWED_EMAILS` = `weerthuis@gmail.com,<miranda's-email>`
5. In Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://<jouwaccount>.github.io/ons-weekmenu/`
   - Redirect URLs: `https://<jouwaccount>.github.io/ons-weekmenu/**`
6. Push een lege commit → GitHub Actions bouwt en deployt → app staat op `https://<jouwaccount>.github.io/ons-weekmenu/`.

Vanaf dan: elke `git push` naar `main` triggert automatisch een nieuwe deploy.

## AVG-check (v1.0 — eindafvinking)

| Aspect | Stand | Notitie |
|---|---|---|
| Persoonsgegevens | naam, e-mail (auth), voedingsschema | minimum noodzakelijk |
| Bijzondere persoonsgegevens | gezondheidsdata (kcal, dieetschema) | binnen Supabase EU + RLS |
| Opslaglocatie | Supabase **eu-central-1** (Frankfurt) | strikt EU |
| Toegang | RLS op alle tabellen, allowlist in env-var | signups uit in dashboard na onboarding van Miranda |
| Externe diensten | Supabase EU, GitHub Pages, Google Fonts | fonts lokaal hosten = v1.1 |
| Trackers/analytics | geen | bewust |
| LLM-aanroepen | **opt-in** via Cowork-route | PDF gaat naar Anthropic bij wekelijkse import; gedocumenteerde keuze van eigenaar |
| Recht op vergetelheid | via Supabase dashboard handmatig | "alles wissen"-knop in app = v1.1 |
| Repo-zichtbaarheid | publiek | code zichtbaar; geen secrets in code (env-vars + Secrets) |

## Skills (toolset)

- Vite, lit-html, JS modules
- Supabase (Postgres + RLS + Auth + Storage)
- pdf.js voor client-side PDF-parsing
- GitHub Pages voor deploy

## Beslissingen die vast staan

- Twee aparte accounts (peter, miranda) met gedeelde leesrechten op elkaars data.
- Eén gedeelde maaltijdpool met tags `suitable_for[]` voor 'peter' / 'miranda' / 'beiden'.
- Hash-router (geen server-rewrites nodig op GitHub Pages).
- Persoon-toggle in header is altijd zichtbaar; standaardweergave 'beiden'.

Zie `memory.md` voor de redenering achter elke beslissing en latere updates.
