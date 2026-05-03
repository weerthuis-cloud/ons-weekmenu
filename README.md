# ons weekmenu

Webtool voor het huishouden van Peter en Miranda. Wekelijkse menu's van de dietist invoeren, bekijken per dag of per week, boodschappenlijst genereren, archief opbouwen, eigen menu's samenstellen met filters.

## Status

Huidige versie: **v1.4** (per-recept akkoord-flow + dag-kleurstreepjes; mobiel met swipe-navigatie tussen Week, Vandaag en Boodschappen).

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

## Wekelijkse routine (PDF-import)

1. Open Cowork met dit project.
2. Sleep de PDF van de diëtist in de chat.
3. Typ "importeer".
4. Bevestig persoon en weeknummer.
5. Claude schrijft alles direct in Supabase via MCP.
6. Open de app op telefoon of laptop → de week is gevuld.

Tijd: ongeveer 2 minuten. Geen kopieer-en-plak, geen handmatige typen.

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
