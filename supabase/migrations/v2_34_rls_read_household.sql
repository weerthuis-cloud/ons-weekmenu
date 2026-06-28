-- v2.34 — AVG: leesrechten inperken tot het eigen huishouden
-- Datum: 2026-06-28
--
-- Vóór deze migratie mocht iedere ingelogde gebruiker ALLE weken, maaltijden,
-- boodschappenlijsten, notities en profielen lezen (read-policy = auth.uid() IS NOT NULL).
-- Met één gedeeld account is dat in de praktijk privé, maar het schaalt onveilig zodra
-- er ooit losse accounts bijkomen. Deze migratie scoopt lezen (en de nog losse
-- shopping-update-policies) naar rijen die bij een profiel van het ingelogde account
-- horen (profiles.user_id = auth.uid()). Peter en Miranda delen één account, dus beide
-- profielen blijven voor elkaar zichtbaar (beiden-weergave + archief blijven werken).
-- Gedeelde bibliotheek (meals/recipes/ingredients) wordt NIET aangeraakt.

begin;

-- ===== profiles =====
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (user_id = (select auth.uid()));

-- ===== weeks =====
drop policy if exists "weeks read" on public.weeks;
create policy "weeks read" on public.weeks
  for select using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- ===== week_meals =====
drop policy if exists "week_meals read" on public.week_meals;
create policy "week_meals read" on public.week_meals
  for select using (exists (
    select 1 from public.weeks w
    join public.profiles pr on pr.id = w.owner
    where w.id = week_meals.week_id and pr.user_id = (select auth.uid())
  ));

-- ===== shopping_lists =====
drop policy if exists "shopping read" on public.shopping_lists;
create policy "shopping read" on public.shopping_lists
  for select using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "shopping update" on public.shopping_lists;
create policy "shopping update" on public.shopping_lists
  for update using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- ===== shopping_notes =====
drop policy if exists "shopping notes read" on public.shopping_notes;
create policy "shopping notes read" on public.shopping_notes
  for select using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "shopping notes update" on public.shopping_notes;
create policy "shopping notes update" on public.shopping_notes
  for update using (
    owner in (select id from public.profiles where user_id = (select auth.uid()))
  );

commit;
