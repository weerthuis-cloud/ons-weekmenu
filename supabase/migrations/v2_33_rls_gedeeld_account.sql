-- v2.33 — RLS-fix voor gedeeld auth-account (Peter + Miranda)
-- Datum: 2026-06-28
--
-- Probleem: Peter en Miranda delen één auth-account, maar elke week wordt aan een
-- persoon gekoppeld via weeks.owner = profiles.id. Peters profile_id is toevallig
-- gelijk aan het auth-account (auth.uid()); Miranda's profile_id niet. De oude
-- schrijf-policies eisten owner = auth.uid(), waardoor alle wijzigingen op Miranda's
-- weken stil werden geblokkeerd: ruilen (= delete + insert), verwijderen en het
-- aanmaken van boodschappenlijsten/notities.
--
-- Fix: schrijf-policies controleren nu of de owner een profiel is dat tot het
-- ingelogde account behoort (profiles.user_id = auth.uid()). Datamodel en app-code
-- blijven ongewijzigd. Leesregels blijven ook ongewijzigd.

begin;

-- ===== weeks =====
drop policy if exists "weeks insert" on public.weeks;
create policy "weeks insert" on public.weeks
  for insert with check (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "weeks update" on public.weeks;
create policy "weeks update" on public.weeks
  for update using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "weeks delete" on public.weeks;
create policy "weeks delete" on public.weeks
  for delete using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- ===== week_meals (owner via weeks) =====
drop policy if exists "week_meals insert" on public.week_meals;
create policy "week_meals insert" on public.week_meals
  for insert with check (exists (
    select 1 from public.weeks w
    join public.profiles pr on pr.id = w.owner
    where w.id = week_meals.week_id and pr.user_id = (select auth.uid())
  ));

drop policy if exists "week_meals update" on public.week_meals;
create policy "week_meals update" on public.week_meals
  for update using (exists (
    select 1 from public.weeks w
    join public.profiles pr on pr.id = w.owner
    where w.id = week_meals.week_id and pr.user_id = (select auth.uid())
  ));

drop policy if exists "week_meals delete" on public.week_meals;
create policy "week_meals delete" on public.week_meals
  for delete using (exists (
    select 1 from public.weeks w
    join public.profiles pr on pr.id = w.owner
    where w.id = week_meals.week_id and pr.user_id = (select auth.uid())
  ));

-- ===== shopping_lists =====
drop policy if exists "shopping insert" on public.shopping_lists;
create policy "shopping insert" on public.shopping_lists
  for insert with check (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "shopping delete" on public.shopping_lists;
create policy "shopping delete" on public.shopping_lists
  for delete using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- ===== shopping_notes =====
drop policy if exists "shopping notes insert" on public.shopping_notes;
create policy "shopping notes insert" on public.shopping_notes
  for insert with check (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "shopping notes delete" on public.shopping_notes;
create policy "shopping notes delete" on public.shopping_notes
  for delete using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

commit;
