-- Agenda (tasks) + Caja (cash ledger) for nodo-autos — public schema
-- Nota: producción usa public, no nodo_autos.

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  title        text not null,
  description  text,
  category     text not null default 'general'
               check (category in ('visita', 'entrega', 'tramite', 'publicacion', 'seguimiento', 'mantenimiento', 'general')),
  priority     text not null default 'media'
               check (priority in ('alta', 'media', 'baja')),
  status       text not null default 'pendiente'
               check (status in ('pendiente', 'en_progreso', 'completada', 'cancelada')),
  due_date     date not null default current_date,
  assigned_to  text,
  vehicle_id   uuid references public.vehicles(id) on delete set null,
  customer_id  uuid references public.customers(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_cliente_id_idx on public.tasks (cliente_id);
create index if not exists tasks_due_date_idx on public.tasks (cliente_id, due_date);
create index if not exists tasks_vehicle_id_idx on public.tasks (vehicle_id);
create index if not exists tasks_customer_id_idx on public.tasks (customer_id);

create table if not exists public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(15,2) not null check (amount >= 0),
  currency    text not null default 'ARS' check (currency in ('ARS', 'USD')),
  date        date not null default current_date,
  concept     text not null,
  category    text,
  source      text not null default 'manual' check (source in ('manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cash_movements_cliente_id_idx on public.cash_movements (cliente_id);
create index if not exists cash_movements_date_idx on public.cash_movements (date);

create table if not exists public.conceptos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (cliente_id, name)
);

create table if not exists public.cash_accounts (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  label       text not null,
  currency    text not null default 'ARS' check (currency in ('ARS', 'USD')),
  created_at  timestamptz not null default now(),
  unique (cliente_id, label)
);

alter table public.tasks enable row level security;
alter table public.cash_movements enable row level security;
alter table public.conceptos enable row level security;
alter table public.cash_accounts enable row level security;

-- tasks
create policy "tasks: read" on public.tasks for select
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "tasks: insert" on public.tasks for insert
  with check (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "tasks: update" on public.tasks for update
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "tasks: delete" on public.tasks for delete
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));

-- cash_movements
create policy "cash_movements: read" on public.cash_movements for select
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "cash_movements: insert" on public.cash_movements for insert
  with check (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "cash_movements: update" on public.cash_movements for update
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "cash_movements: delete" on public.cash_movements for delete
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));

-- conceptos
create policy "conceptos: read" on public.conceptos for select
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "conceptos: insert" on public.conceptos for insert
  with check (cliente_id in (select cliente_id from public.users where id = auth.uid()));

-- cash_accounts
create policy "cash_accounts: read" on public.cash_accounts for select
  using (cliente_id in (select cliente_id from public.users where id = auth.uid()));
create policy "cash_accounts: insert" on public.cash_accounts for insert
  with check (cliente_id in (select cliente_id from public.users where id = auth.uid()));
