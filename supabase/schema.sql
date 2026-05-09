-- ons weekmenu — Supabase schema v0.2
-- Voer uit in Supabase SQL editor van een leeg project (EU-regio).
-- Vereist auth-extensie (standaard aanwezig).

-- ============================================================
-- 1. profiles  (twee rijen: peter, miranda)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  slug        text unique not null check (slug in ('peter', 'miranda')),
  naam        text not null,
  kleur_hue   int  not null default 260,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. meals  (gedeelde pool van recepten)
-- ============================================================
create table if not exists public.meals (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null check (type in ('ontbijt','snack_ochtend','lunch','snack_middag','diner','snack_avond')),
  kcal            int,
  eiwit_g         numeric(5,1),
  koolh_g         numeric(5,1),
  vet_g           numeric(5,1),
  bereidingstijd  int,                       -- minuten
  ingredients     jsonb not null default '[]',  -- [{name, qty, unit, store?}]
  tags            text[] not null default '{}', -- 'snel','vegetarisch','warm', etc.
  suitable_for    text[] not null default '{beiden}', -- {'peter'}, {'miranda'}, {'beiden'} of meerdere
  seizoen         text[] not null default '{}', -- 'lente','zomer','herfst','winter'
  recipe          text,                       -- v0.9: bereidingsinstructie / receptbijlage
  serves          int,                        -- v1.2: voor hoeveel personen het recept bedoeld is (null = solo-meal)
  source_url      text,                       -- v2.3: URL waar het recept oorspronkelijk vandaan komt (Miljuschka, AH, 24kitchen)
  source_site     text,                       -- v2.3: domeinnaam (miljuschka.nl, ah.nl, 24kitchen.nl)
  description     text,                       -- v2.3: korte omschrijving uit schema.org/Recipe
  cuisine         text,                       -- v2.4: italiaans/mexicaans/aziatisch/indiaas/frans/hollands/mediterraan/amerikaans/bbq
  kookwijze       text[] not null default '{}', -- v2.4: oven/airfryer/eenpans/traybake/wok/soep/salade/grill/pasta/stamppot/slowcooker/smoothie
  hoofdingredient text,                       -- v2.4: kip/rund/varken/lam/vis/vegetarisch/pasta/rijst/aardappel/brood/ei/zuivel
  dieet           text[] not null default '{}', -- v2.4: vegetarisch/vegan/glutenvrij/lactosevrij/koolhydraatarm
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz null   -- soft-delete: blijft in oude weken zichtbaar, weg uit bibliotheek
);

create index if not exists meals_type_idx         on public.meals (type);
create index if not exists meals_suitable_for_idx on public.meals using gin (suitable_for);
create index if not exists meals_tags_idx         on public.meals using gin (tags);
create index if not exists meals_created_by_idx   on public.meals (created_by);
create index if not exists meals_deleted_at_idx   on public.meals (deleted_at);
create index if not exists meals_source_site_idx  on public.meals (source_site) where source_site is not null;
create index if not exists meals_cuisine_idx         on public.meals (cuisine) where cuisine is not null;
create index if not exists meals_kookwijze_idx       on public.meals using gin (kookwijze);
create index if not exists meals_hoofdingredient_idx on public.meals (hoofdingredient) where hoofdingredient is not null;
create index if not exists meals_dieet_idx           on public.meals using gin (dieet);

-- ============================================================
-- 3. weeks  (één per persoon per week)
-- ============================================================
create table if not exists public.weeks (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references public.profiles(id) on delete cascade,
  year          int  not null,
  week_nr       int  not null check (week_nr between 1 and 53),
  source        text not null check (source in ('dietist','eigen')),
  pdf_path      text,                          -- pad in storage bucket 'dietist-pdfs'
  notitie       text,
  created_at    timestamptz not null default now(),
  unique (owner, year, week_nr)
);

create index if not exists weeks_owner_idx on public.weeks (owner, year, week_nr);

-- ============================================================
-- 4. week_meals  (welke maaltijd op welke dag/slot in welke week)
-- ============================================================
create table if not exists public.week_meals (
  id        uuid primary key default gen_random_uuid(),
  week_id   uuid not null references public.weeks(id) on delete cascade,
  day       int  not null check (day between 1 and 7), -- 1 = maandag
  slot      text not null check (slot in ('ontbijt','snack_ochtend','lunch','snack_middag','diner','snack_avond')),
  meal_id   uuid not null references public.meals(id) on delete restrict,
  porties   numeric(3,1) not null default 1.0,
  rating    smallint check (rating in (-1, 0, 1)),  -- v2.3: -1 niet weer, 0 neutraal, 1 lekker, null geen oordeel
  unique (week_id, day, slot)
);

create index if not exists week_meals_week_idx    on public.week_meals (week_id);
create index if not exists week_meals_meal_id_idx on public.week_meals (meal_id);
create index if not exists week_meals_rating_idx  on public.week_meals (rating) where rating is not null;

-- ============================================================
-- 5. shopping_lists  (één per gegenereerde lijst, met afvinkstatus)
-- ============================================================
create table if not exists public.shopping_lists (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade,
  week_ids    uuid[] not null,                 -- één of meer weken samengevoegd
  items       jsonb  not null default '[]',    -- [{name, qty, unit, store, checked, who}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shopping_lists_owner_idx on public.shopping_lists (owner);

-- ============================================================
-- 5b. shopping_notes  (snelle noties door de week, beslissen of ze op de lijst komen)
-- ============================================================
create table if not exists public.shopping_notes (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  qty              numeric(7,2),
  unit             text,
  status           text not null default 'open' check (status in ('open','added','dismissed')),
  added_to_list_id uuid references public.shopping_lists(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists shopping_notes_status_idx on public.shopping_notes (status, created_at desc);
create index if not exists shopping_notes_owner_idx  on public.shopping_notes (owner);

-- ============================================================
-- 6. RLS — Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.meals          enable row level security;
alter table public.weeks          enable row level security;
alter table public.week_meals     enable row level security;
alter table public.shopping_lists enable row level security;

-- Auth-functies in (select ...) wrapper: eenmaal evalueren per query i.p.v. per rij.

-- profiles
create policy "profiles read"        on public.profiles for select using ((select auth.uid()) is not null);
create policy "profiles self insert" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "profiles write"       on public.profiles for update using ((select auth.uid()) = id);

-- meals: ingelogde users mogen lezen + insert + update; delete alleen door created_by
create policy "meals read"   on public.meals for select using ((select auth.uid()) is not null);
create policy "meals insert" on public.meals for insert with check ((select auth.uid()) is not null);
create policy "meals update" on public.meals for update using ((select auth.uid()) is not null);
create policy "meals delete" on public.meals for delete using ((select auth.uid()) = created_by);

-- weeks: beide profielen mogen lezen, alleen owner mag schrijven
create policy "weeks read"   on public.weeks for select using ((select auth.uid()) is not null);
create policy "weeks insert" on public.weeks for insert with check ((select auth.uid()) = owner);
create policy "weeks update" on public.weeks for update using ((select auth.uid()) = owner);
create policy "weeks delete" on public.weeks for delete using ((select auth.uid()) = owner);

-- week_meals: per actie (geen FOR ALL, voorkomt overlap met SELECT)
create policy "week_meals read" on public.week_meals
  for select using (
    exists (select 1 from public.weeks w where w.id = week_id and w.owner = (select auth.uid()))
    or (select auth.uid()) is not null
  );
create policy "week_meals insert" on public.week_meals
  for insert with check (exists (select 1 from public.weeks w where w.id = week_id and w.owner = (select auth.uid())));
create policy "week_meals update" on public.week_meals
  for update using (exists (select 1 from public.weeks w where w.id = week_id and w.owner = (select auth.uid())));
create policy "week_meals delete" on public.week_meals
  for delete using (exists (select 1 from public.weeks w where w.id = week_id and w.owner = (select auth.uid())));

-- shopping_lists: gedeeld in het huishouden — alle ingelogde users lezen + updaten.
-- insert/delete blijft eigendom van de aanmaker (owner-track).
create policy "shopping read"   on public.shopping_lists for select using ((select auth.uid()) is not null);
create policy "shopping insert" on public.shopping_lists for insert with check ((select auth.uid()) = owner);
create policy "shopping update" on public.shopping_lists for update using ((select auth.uid()) is not null);
create policy "shopping delete" on public.shopping_lists for delete using ((select auth.uid()) = owner);

-- ============================================================
-- 7. Storage bucket voor dietist-PDF's (private)
-- ============================================================
-- Voer dit uit in de Supabase dashboard onder Storage, of via de API:
-- insert into storage.buckets (id, name, public) values ('dietist-pdfs', 'dietist-pdfs', false);
-- Storage policies: alleen ingelogde users mogen lezen/schrijven in eigen folder.

-- ============================================================
-- 8. Initiele profielen (na auth-signup uitvoeren)
-- ============================================================
-- Vul dit handmatig in nadat Peter en Miranda eenmaal zijn ingelogd via magic link:
--   insert into public.profiles (id, slug, naam) values
--     ('<peter-auth-uuid>',   'peter',   'Peter'),
--     ('<miranda-auth-uuid>', 'miranda', 'Miranda');
