-- Caja (team expenses) setup.
-- Run this in the Supabase SQL Editor.
--
-- Access model: the caja is a SHARED team resource. Every authenticated team
-- member may read and write all rows. That is why the policies use
-- `to authenticated using (true)` rather than a per-user ownership predicate —
-- here that is the real access model, not an oversight. Tighten to admin-only
-- deletes later if needed.

-- An expense paid by one team member.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null,
  paid_by uuid not null references public.profiles (id) on delete restrict,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Each member's share of an expense. settled = that member reimbursed their part.
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (expense_id, profile_id)
);

create index if not exists expenses_paid_by_idx on public.expenses (paid_by);
create index if not exists expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index if not exists expense_splits_profile_id_idx on public.expense_splits (profile_id);

alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

-- expenses policies
create policy "expenses_select" on public.expenses
  for select to authenticated using (true);
create policy "expenses_insert" on public.expenses
  for insert to authenticated with check (true);
create policy "expenses_update" on public.expenses
  for update to authenticated using (true) with check (true);
create policy "expenses_delete" on public.expenses
  for delete to authenticated using (true);

-- expense_splits policies
create policy "expense_splits_select" on public.expense_splits
  for select to authenticated using (true);
create policy "expense_splits_insert" on public.expense_splits
  for insert to authenticated with check (true);
create policy "expense_splits_update" on public.expense_splits
  for update to authenticated using (true) with check (true);
create policy "expense_splits_delete" on public.expense_splits
  for delete to authenticated using (true);
