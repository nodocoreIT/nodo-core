-- EMERGENCY: several nodo_core tables had "authenticated" RLS policies with
-- using(true)/with_check(true) — i.e. no team-membership check at all. Since
-- every Nodo product shares one Supabase auth project, ANY logged-in customer
-- of ANY product (Inmo, Clinica, Finanzas, Autos, Ecommerce) could read/write
-- these tables directly via the public anon key + their own valid session,
-- bypassing the panel UI entirely. Several policies are literally named
-- "*_team" implying the check was intended but never written.
--
-- Fix: gate all of them on nodo_core.is_team_member(), matching the pattern
-- already correctly used by client_unit_subscriptions/fx_rates/planes/etc.
-- Verified server-side registration/billing/onboarding flows all use the
-- service_role admin client (bypasses RLS) for these tables — only the panel
-- UI reads them via the browser RLS-bound client, so this does not affect
-- any customer-facing flow.

-- clients
drop policy if exists "admins clients" on nodo_core.clients;
create policy "admins clients" on nodo_core.clients
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- client_units
drop policy if exists client_units_select on nodo_core.client_units;
create policy client_units_select on nodo_core.client_units
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists client_units_update on nodo_core.client_units;
create policy client_units_update on nodo_core.client_units
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists client_units_delete on nodo_core.client_units;
create policy client_units_delete on nodo_core.client_units
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists client_units_insert on nodo_core.client_units;
create policy client_units_insert on nodo_core.client_units
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

-- contact_leads: only tighten the team-read policy; keep the public anon
-- insert policy for the contact form untouched.
drop policy if exists "admins read leads" on nodo_core.contact_leads;
create policy "admins read leads" on nodo_core.contact_leads
  for select to authenticated
  using ((select nodo_core.is_team_member()));

-- expense_splits
drop policy if exists expense_splits_select on nodo_core.expense_splits;
create policy expense_splits_select on nodo_core.expense_splits
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists expense_splits_update on nodo_core.expense_splits;
create policy expense_splits_update on nodo_core.expense_splits
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists expense_splits_delete on nodo_core.expense_splits;
create policy expense_splits_delete on nodo_core.expense_splits
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists expense_splits_insert on nodo_core.expense_splits;
create policy expense_splits_insert on nodo_core.expense_splits
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

-- expenses
drop policy if exists expenses_select on nodo_core.expenses;
create policy expenses_select on nodo_core.expenses
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists expenses_update on nodo_core.expenses;
create policy expenses_update on nodo_core.expenses
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists expenses_delete on nodo_core.expenses;
create policy expenses_delete on nodo_core.expenses
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists expenses_insert on nodo_core.expenses;
create policy expenses_insert on nodo_core.expenses
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

-- ideas
drop policy if exists ideas_select on nodo_core.ideas;
create policy ideas_select on nodo_core.ideas
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists ideas_update on nodo_core.ideas;
create policy ideas_update on nodo_core.ideas
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists ideas_delete on nodo_core.ideas;
create policy ideas_delete on nodo_core.ideas
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists ideas_insert on nodo_core.ideas;
create policy ideas_insert on nodo_core.ideas
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

-- identity_verification_checks
drop policy if exists identity_verification_checks_team on nodo_core.identity_verification_checks;
create policy identity_verification_checks_team on nodo_core.identity_verification_checks
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- node_email_access
drop policy if exists node_email_access_team on nodo_core.node_email_access;
create policy node_email_access_team on nodo_core.node_email_access
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- onboarding_profiles
drop policy if exists onboarding_profiles_team on nodo_core.onboarding_profiles;
create policy onboarding_profiles_team on nodo_core.onboarding_profiles
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- registration_verification_docs
drop policy if exists registration_verification_docs_team on nodo_core.registration_verification_docs;
create policy registration_verification_docs_team on nodo_core.registration_verification_docs
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- tasks
drop policy if exists "admins tasks" on nodo_core.tasks;
create policy "admins tasks" on nodo_core.tasks
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- vault_entries
drop policy if exists "admins vault" on nodo_core.vault_entries;
create policy "admins vault" on nodo_core.vault_entries
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));
