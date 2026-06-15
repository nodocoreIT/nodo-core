-- ============================================================
-- Nodo Autos — Initial Schema
-- Schema: nodo_autos (isolated from other nodos on the same project)
-- ============================================================

-- ─── Create schema ───────────────────────────────────────────
create schema if not exists nodo_autos;

-- Grant PostgREST access (required for Supabase REST API)
grant usage on schema nodo_autos to anon, authenticated, service_role;
alter default privileges in schema nodo_autos
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema nodo_autos
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema nodo_autos
  grant all on functions to anon, authenticated, service_role;

-- ─── clientes (dealership tenants) ───────────────────────────
create table if not exists nodo_autos.clientes (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  identificador       text not null unique,
  logo_url            text,
  suscripcion_id      text,
  email_contacto      text,
  telefono            text not null,
  whatsapp_numero     text not null,
  direccion           text,
  sitio_web           text,
  instagram_url       text,
  facebook_url        text,
  tiktok_url          text,
  descripcion_publica text,
  horarios            text,
  ubicacion           jsonb,
  creado_en           timestamptz not null default now()
);

alter table nodo_autos.clientes enable row level security;

create policy "Authenticated users can read their own cliente"
  on nodo_autos.clientes for select
  using (
    id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

-- ─── users ───────────────────────────────────────────────────
create table if not exists nodo_autos.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  cliente_id        uuid not null references nodo_autos.clientes(id) on delete cascade,
  email             text not null,
  name              text not null,
  role              text not null check (role in ('administrador', 'vendedor', 'marketing')),
  whatsapp_numero   text,
  profile_photo_url text,
  is_activo         boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table nodo_autos.users enable row level security;

create policy "Users can read users in their cliente"
  on nodo_autos.users for select
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can update their own profile"
  on nodo_autos.users for update
  using (id = auth.uid());

-- ─── vehicles ────────────────────────────────────────────────
create table if not exists nodo_autos.vehicles (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references nodo_autos.clientes(id) on delete cascade,

  -- Identity
  brand                text not null,
  model                text not null,
  version              text,
  year                 integer not null,
  license_plate        text,
  vin                  text,
  fuel_type            text not null,
  transmission         text,
  doors                integer,
  engine               numeric,
  numero_motor         text,
  color                text,
  single_owner         boolean default false,

  -- Usage
  kilometers           integer not null default 0,
  condition            text not null check (condition in ('nuevo', 'usado')),
  status               text not null check (status in ('disponible', 'reservado', 'vendido', 'en_preparacion')),

  -- Price
  currency             text not null check (currency in ('ARS', 'USD')),
  list_price           numeric not null,
  cash_price           numeric,
  show_price           boolean not null default true,
  price_observations   text,

  -- Commercial
  entry_date           date not null,
  owner_type           text not null check (owner_type in ('own', 'consignment')),
  margin               numeric,
  expenses             numeric,

  -- Content
  description          text not null default '',
  features             text[],
  photos               text[],
  documents            jsonb,
  is_published         boolean not null default false,
  public_slug          text not null unique,
  internal_notes       text,
  responsible_user_id  uuid references nodo_autos.users(id),
  tags                 text[],

  -- Audit
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id),
  updated_by           uuid references auth.users(id)
);

alter table nodo_autos.vehicles enable row level security;

create policy "Users can read vehicles of their cliente"
  on nodo_autos.vehicles for select
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can insert vehicles into their cliente"
  on nodo_autos.vehicles for insert
  with check (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can update vehicles of their cliente"
  on nodo_autos.vehicles for update
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can delete vehicles of their cliente"
  on nodo_autos.vehicles for delete
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function nodo_autos.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vehicles_updated_at
  before update on nodo_autos.vehicles
  for each row execute function nodo_autos.set_updated_at();

-- ─── publications ─────────────────────────────────────────────
create table if not exists nodo_autos.publications (
  id                uuid primary key default gen_random_uuid(),
  vehicle_id        uuid not null references nodo_autos.vehicles(id) on delete cascade,
  channel           text not null check (channel in ('instagram', 'facebook', 'website', 'mercadolibre')),
  status            text not null check (status in ('borrador', 'pendiente', 'publicado', 'fallido')),
  post_link         text,
  post_text         text,
  hashtags          jsonb,
  last_published_at timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),

  unique (vehicle_id, channel)
);

alter table nodo_autos.publications enable row level security;

create policy "Users can read publications of their cliente vehicles"
  on nodo_autos.publications for select
  using (
    vehicle_id in (
      select id from nodo_autos.vehicles
      where cliente_id in (
        select cliente_id from nodo_autos.users where id = auth.uid()
      )
    )
  );

create policy "Users can insert publications for their cliente vehicles"
  on nodo_autos.publications for insert
  with check (
    vehicle_id in (
      select id from nodo_autos.vehicles
      where cliente_id in (
        select cliente_id from nodo_autos.users where id = auth.uid()
      )
    )
  );

create policy "Users can update publications for their cliente vehicles"
  on nodo_autos.publications for update
  using (
    vehicle_id in (
      select id from nodo_autos.vehicles
      where cliente_id in (
        select cliente_id from nodo_autos.users where id = auth.uid()
      )
    )
  );

-- ─── customers ───────────────────────────────────────────────
create table if not exists nodo_autos.customers (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references nodo_autos.clientes(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  address         text,
  city            text,
  state           text,
  document_type   text,
  document_number text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table nodo_autos.customers enable row level security;

create policy "Users can read customers of their cliente"
  on nodo_autos.customers for select
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can insert customers into their cliente"
  on nodo_autos.customers for insert
  with check (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can update customers of their cliente"
  on nodo_autos.customers for update
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can delete customers of their cliente"
  on nodo_autos.customers for delete
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create trigger customers_updated_at
  before update on nodo_autos.customers
  for each row execute function nodo_autos.set_updated_at();

-- ─── contracts ───────────────────────────────────────────────
create table if not exists nodo_autos.contracts (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references nodo_autos.clientes(id) on delete cascade,
  date              date not null,
  vehicle_id        uuid not null references nodo_autos.vehicles(id),
  seller_name       text,
  seller_document   text,
  buyer             jsonb not null,
  trade_in_vehicle  jsonb,
  agreed_sale_price numeric not null,
  currency          text not null check (currency in ('ARS', 'USD')),
  payments          jsonb not null default '[]',
  notes             text,
  created_at        timestamptz not null default now()
);

alter table nodo_autos.contracts enable row level security;

create policy "Users can read contracts of their cliente"
  on nodo_autos.contracts for select
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

create policy "Users can insert contracts into their cliente"
  on nodo_autos.contracts for insert
  with check (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );

-- ─── audit_logs ──────────────────────────────────────────────
create table if not exists nodo_autos.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references nodo_autos.clientes(id) on delete cascade,
  user_id     uuid references auth.users(id),
  user_name   text not null,
  entity_type text not null check (entity_type in ('vehicle', 'publication', 'user')),
  entity_id   text not null,
  action      text not null check (action in ('create', 'update', 'delete', 'archive')),
  changes     jsonb,
  timestamp   timestamptz not null default now()
);

alter table nodo_autos.audit_logs enable row level security;

create policy "Admins can read audit logs of their cliente"
  on nodo_autos.audit_logs for select
  using (
    cliente_id in (
      select cliente_id from nodo_autos.users
      where id = auth.uid() and role = 'administrador'
    )
  );

create policy "Users can insert audit logs for their cliente"
  on nodo_autos.audit_logs for insert
  with check (
    cliente_id in (
      select cliente_id from nodo_autos.users where id = auth.uid()
    )
  );
