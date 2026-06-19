-- Extend cash_accounts for bank account settings (same shape as nodo-inmo)

alter table public.cash_accounts
  add column if not exists kind text not null default 'BANCO'
    check (kind in ('BANCO', 'EFECTIVO')),
  add column if not exists bank_name text,
  add column if not exists alias text,
  add column if not exists cbu text,
  add column if not exists initial_balance numeric(15, 2) not null default 0,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists nodo_autos.cash_accounts
  add column if not exists kind text not null default 'BANCO'
    check (kind in ('BANCO', 'EFECTIVO')),
  add column if not exists bank_name text,
  add column if not exists alias text,
  add column if not exists cbu text,
  add column if not exists initial_balance numeric(15, 2) not null default 0,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill bank_name from label for existing rows
update public.cash_accounts
set bank_name = label
where bank_name is null;

update nodo_autos.cash_accounts
set bank_name = label
where bank_name is null;

drop policy if exists "cash_accounts: update" on public.cash_accounts;
create policy "cash_accounts: update" on public.cash_accounts for update
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()))
  with check (cliente_id in (select cliente_id from public.users where id = auth.uid()));

drop policy if exists "cash_accounts: delete" on public.cash_accounts;
create policy "cash_accounts: delete" on public.cash_accounts for delete
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));

drop policy if exists "cash_accounts: update" on nodo_autos.cash_accounts;
create policy "cash_accounts: update" on nodo_autos.cash_accounts for update
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()))
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

drop policy if exists "cash_accounts: delete" on nodo_autos.cash_accounts;
create policy "cash_accounts: delete" on nodo_autos.cash_accounts for delete
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
