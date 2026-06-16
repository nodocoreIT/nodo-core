-- Add theme_settings to profiles (per-doctor branding)
alter table public.profiles
  add column if not exists theme_settings jsonb default null;

-- Allow authenticated users to update their own profile
create policy "profiles: update own"
  on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
