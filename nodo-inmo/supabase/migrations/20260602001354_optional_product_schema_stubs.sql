-- ponytail: minimal stubs so shared migrations (get_my_orgs, etc.) run on inmo-only local DB.
-- Full schemas are provisioned by each product's own Supabase migrations in prod.

create schema if not exists nodo_clinica;
create table if not exists nodo_clinica.professionals (
  user_id uuid primary key,
  full_name text
);
create table if not exists nodo_clinica.patients (
  profile_id uuid primary key,
  full_name text
);

create schema if not exists nodo_autos;
create table if not exists nodo_autos.users (
  id uuid primary key,
  cliente_id uuid
);
create table if not exists nodo_autos.clientes (
  id uuid primary key,
  legal_name text,
  nombre text
);

create schema if not exists nodo_core;
create table if not exists nodo_core.clients (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text
);
