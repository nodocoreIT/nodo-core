-- Align nodo-autos with nodo-inmo: module tables under schema nodo_autos (not public).
-- App code uses supabase.schema('nodo_autos').from(...)

-- ─── clientes: settings / branding columns ───────────────────────────────────
alter table nodo_autos.clientes
  add column if not exists theme_settings jsonb,
  add column if not exists legal_name text,
  add column if not exists cuit text,
  add column if not exists logo_path text,
  add column if not exists pdf_logo_path text,
  add column if not exists alert_settings jsonb default '{"contractExpirationMonths":2,"rentAdjustmentMonths":1}'::jsonb;

-- ─── publications / vehicles social fields ───────────────────────────────────
alter table nodo_autos.publications
  add column if not exists external_id text;

alter table nodo_autos.vehicles
  add column if not exists social_title text,
  add column if not exists social_description text;

-- ─── agenda + caja ───────────────────────────────────────────────────────────
create table if not exists nodo_autos.tasks (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references nodo_autos.clientes(id) on delete cascade,
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
  vehicle_id   uuid references nodo_autos.vehicles(id) on delete set null,
  customer_id  uuid references nodo_autos.customers(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_cliente_id_idx on nodo_autos.tasks (cliente_id);
create index if not exists tasks_due_date_idx on nodo_autos.tasks (cliente_id, due_date);

create table if not exists nodo_autos.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references nodo_autos.clientes(id) on delete cascade,
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

create index if not exists cash_movements_cliente_id_idx on nodo_autos.cash_movements (cliente_id);
create index if not exists cash_movements_date_idx on nodo_autos.cash_movements (date);

create table if not exists nodo_autos.conceptos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references nodo_autos.clientes(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (cliente_id, name)
);

create table if not exists nodo_autos.cash_accounts (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references nodo_autos.clientes(id) on delete cascade,
  label            text not null,
  currency         text not null default 'ARS' check (currency in ('ARS', 'USD')),
  kind             text not null default 'BANCO' check (kind in ('BANCO', 'EFECTIVO')),
  bank_name        text,
  alias            text,
  cbu              text,
  initial_balance  numeric(15, 2) not null default 0,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (cliente_id, label)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table nodo_autos.tasks enable row level security;
alter table nodo_autos.cash_movements enable row level security;
alter table nodo_autos.conceptos enable row level security;
alter table nodo_autos.cash_accounts enable row level security;

-- tasks
drop policy if exists "tasks: read" on nodo_autos.tasks;
create policy "tasks: read" on nodo_autos.tasks for select
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "tasks: insert" on nodo_autos.tasks;
create policy "tasks: insert" on nodo_autos.tasks for insert
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "tasks: update" on nodo_autos.tasks;
create policy "tasks: update" on nodo_autos.tasks for update
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "tasks: delete" on nodo_autos.tasks;
create policy "tasks: delete" on nodo_autos.tasks for delete
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

-- cash_movements
drop policy if exists "cash_movements: read" on nodo_autos.cash_movements;
create policy "cash_movements: read" on nodo_autos.cash_movements for select
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_movements: insert" on nodo_autos.cash_movements;
create policy "cash_movements: insert" on nodo_autos.cash_movements for insert
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_movements: update" on nodo_autos.cash_movements;
create policy "cash_movements: update" on nodo_autos.cash_movements for update
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_movements: delete" on nodo_autos.cash_movements;
create policy "cash_movements: delete" on nodo_autos.cash_movements for delete
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

-- conceptos
drop policy if exists "conceptos: read" on nodo_autos.conceptos;
create policy "conceptos: read" on nodo_autos.conceptos for select
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "conceptos: insert" on nodo_autos.conceptos;
create policy "conceptos: insert" on nodo_autos.conceptos for insert
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

-- cash_accounts
drop policy if exists "cash_accounts: read" on nodo_autos.cash_accounts;
create policy "cash_accounts: read" on nodo_autos.cash_accounts for select
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_accounts: insert" on nodo_autos.cash_accounts;
create policy "cash_accounts: insert" on nodo_autos.cash_accounts for insert
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_accounts: update" on nodo_autos.cash_accounts;
create policy "cash_accounts: update" on nodo_autos.cash_accounts for update
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()))
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));
drop policy if exists "cash_accounts: delete" on nodo_autos.cash_accounts;
create policy "cash_accounts: delete" on nodo_autos.cash_accounts for delete
  using (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

-- users: admin can update roles in same cliente
drop policy if exists "users: admin update same cliente" on nodo_autos.users;
create policy "users: admin update same cliente" on nodo_autos.users for update
  using (
    cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid())
    and exists (
      select 1 from nodo_autos.users u
      where u.id = auth.uid() and u.role = 'administrador'
    )
  )
  with check (cliente_id in (select cliente_id from nodo_autos.users where id = auth.uid()));

-- branding storage bucket (global storage.objects — not schema-bound)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cliente-branding',
  'cliente-branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "cliente_branding_select" on storage.objects;
create policy "cliente_branding_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from nodo_autos.users where id = auth.uid()
    )
  );

drop policy if exists "cliente_branding_insert" on storage.objects;
create policy "cliente_branding_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from nodo_autos.users where id = auth.uid()
    )
  );

drop policy if exists "cliente_branding_update" on storage.objects;
create policy "cliente_branding_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from nodo_autos.users where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from nodo_autos.users where id = auth.uid()
    )
  );

drop policy if exists "cliente_branding_delete" on storage.objects;
create policy "cliente_branding_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'cliente-branding'
    and (storage.foldername(name))[1] in (
      select cliente_id::text from nodo_autos.users where id = auth.uid()
    )
  );
