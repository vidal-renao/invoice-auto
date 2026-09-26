-- Policy hygiene on the tables this repository owns.
--
-- Three problems, all found by reading the live catalogue rather than the
-- migrations:
--
-- 1. `invoices` carries five hand-made policies that this repository never
--    wrote: "Users can view own invoices" and "Users can view their own
--    invoices" are the same SELECT rule twice, and the same duplication
--    exists for INSERT. Migration 002 declares the intended set under clean
--    names, and those names are not in production. Duplicated permissive
--    policies are not just noise: tighten one and the other still lets the
--    row through.
--
-- 2. Every policy targets `public`, which includes `anon`. It happens to be
--    harmless — `auth.uid()` is null for an anonymous request, so the
--    comparison is null and no row matches — but the safety is incidental
--    rather than declared. `to authenticated` states the intent.
--
-- 3. `auth.uid()` is called unwrapped, so Postgres re-evaluates it for every
--    row scanned instead of once per statement. Wrapping it in a scalar
--    subquery is the documented fix and changes no behaviour. The payments
--    tables in 009 already follow this pattern; these predate it.
--
-- `vendors` and `profiles` only need points 2 and 3, so they are altered in
-- place: no instant passes in which the table has no policy. `invoices` has
-- policies that must genuinely disappear, so it is rebuilt — inside the
-- single transaction this migration runs in.

-- 1. invoices: drop the hand-made drift, including both duplicate pairs.
drop policy if exists "Users can view own invoices"         on public.invoices;
drop policy if exists "Users can view their own invoices"   on public.invoices;
drop policy if exists "Users can insert own invoices"       on public.invoices;
drop policy if exists "Users can insert their own invoices" on public.invoices;
drop policy if exists "Users can update their own invoices" on public.invoices;
drop policy if exists "Users can delete their own invoices" on public.invoices;

drop policy if exists "invoices: owner select" on public.invoices;
create policy "invoices: owner select"
  on public.invoices for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "invoices: owner insert" on public.invoices;
create policy "invoices: owner insert"
  on public.invoices for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "invoices: owner update" on public.invoices;
create policy "invoices: owner update"
  on public.invoices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Kept under the name 008 created and reconcile.test.ts asserts on.
drop policy if exists "invoices: owner delete" on public.invoices;
create policy "invoices: owner delete"
  on public.invoices for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 2. vendors: same rules, altered in place.
alter policy "vendors: owner can select" on public.vendors
  to authenticated using ((select auth.uid()) = user_id);
alter policy "vendors: owner can insert" on public.vendors
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "vendors: owner can update" on public.vendors
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "vendors: owner can delete" on public.vendors
  to authenticated using ((select auth.uid()) = user_id);

-- 3. profiles: same.
alter policy "profiles: owner can select" on public.profiles
  to authenticated using ((select auth.uid()) = id);
alter policy "profiles: owner can update" on public.profiles
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
