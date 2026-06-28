-- ROLLBACK voor v2.33 (RLS-fix gedeeld account)
-- Herstelt de policies zoals ze waren vóór de migratie v2_33_rls_gedeeld_account.sql
-- Vastgelegd op 2026-06-28. Draai dit alleen als de nieuwe policies teruggedraaid moeten worden.
--
-- Context: vóór v2.33 stond schrijven (insert/update/delete) alleen toe als
-- owner = auth.uid(). Omdat Peter en Miranda één auth-account delen maar Miranda's
-- weken op haar eigen profile_id staan, blokkeerde dit alle wijzigingen op Miranda's
-- weken (ruilen, verwijderen, boodschappenlijst toevoegen). Deze rollback zet dat terug.

begin;

-- ===== weeks =====
drop policy if exists "weeks insert" on public.weeks;
create policy "weeks insert" on public.weeks
  for insert with check ((select auth.uid()) = owner);

drop policy if exists "weeks update" on public.weeks;
create policy "weeks update" on public.weeks
  for update using ((select auth.uid()) = owner);

drop policy if exists "weeks delete" on public.weeks;
create policy "weeks delete" on public.weeks
  for delete using ((select auth.uid()) = owner);

-- ===== week_meals =====
drop policy if exists "week_meals insert" on public.week_meals;
create policy "week_meals insert" on public.week_meals
  for insert with check (exists (
    select 1 from public.weeks w
    where w.id = week_meals.week_id and w.owner = (select auth.uid())
  ));

drop policy if exists "week_meals update" on public.week_meals;
create policy "week_meals update" on public.week_meals
  for update using (exists (
    select 1 from public.weeks w
    where w.id = week_meals.week_id and w.owner = (select auth.uid())
  ));

drop policy if exists "week_meals delete" on public.week_meals;
create policy "week_meals delete" on public.week_meals
  for delete using (exists (
    select 1 from public.weeks w
    where w.id = week_meals.week_id and w.owner = (select auth.uid())
  ));

-- ===== shopping_lists =====
drop policy if exists "shopping insert" on public.shopping_lists;
create policy "shopping insert" on public.shopping_lists
  for insert with check ((select auth.uid()) = owner);

drop policy if exists "shopping delete" on public.shopping_lists;
create policy "shopping delete" on public.shopping_lists
  for delete using ((select auth.uid()) = owner);

-- ===== shopping_notes =====
drop policy if exists "shopping notes insert" on public.shopping_notes;
create policy "shopping notes insert" on public.shopping_notes
  for insert with check ((select auth.uid()) = owner);

drop policy if exists "shopping notes delete" on public.shopping_notes;
create policy "shopping notes delete" on public.shopping_notes
  for delete using ((select auth.uid()) = owner);

commit;
