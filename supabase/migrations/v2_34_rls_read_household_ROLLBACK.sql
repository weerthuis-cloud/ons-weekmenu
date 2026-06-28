-- ROLLBACK voor v2.34 (leesrechten huishouden)
-- Herstelt de ruime read/update-policies zoals vóór v2_34_rls_read_household.sql.
-- Vastgelegd op 2026-06-28.

begin;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using ((select auth.uid()) is not null);

drop policy if exists "weeks read" on public.weeks;
create policy "weeks read" on public.weeks
  for select using ((select auth.uid()) is not null);

drop policy if exists "week_meals read" on public.week_meals;
create policy "week_meals read" on public.week_meals
  for select using (
    (exists (select 1 from public.weeks w
      where w.id = week_meals.week_id and w.owner = (select auth.uid())))
    or ((select auth.uid()) is not null)
  );

drop policy if exists "shopping read" on public.shopping_lists;
create policy "shopping read" on public.shopping_lists
  for select using ((select auth.uid()) is not null);

drop policy if exists "shopping update" on public.shopping_lists;
create policy "shopping update" on public.shopping_lists
  for update using ((select auth.uid()) is not null);

drop policy if exists "shopping notes read" on public.shopping_notes;
create policy "shopping notes read" on public.shopping_notes
  for select using ((select auth.uid()) is not null);

drop policy if exists "shopping notes update" on public.shopping_notes;
create policy "shopping notes update" on public.shopping_notes
  for update using ((select auth.uid()) is not null);

commit;
