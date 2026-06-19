-- Feature groups + per-plan inclusions (configurable from panel / unidades).

create table if not exists nodo_core.plan_feature_groups (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_feature_groups_unit_idx
  on nodo_core.plan_feature_groups (unit_code, sort_order);

create table if not exists nodo_core.plan_features (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references nodo_core.plan_feature_groups (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_features_group_idx
  on nodo_core.plan_features (group_id, sort_order);

create table if not exists nodo_core.plan_feature_inclusions (
  feature_id uuid not null references nodo_core.plan_features (id) on delete cascade,
  plan_id uuid not null references nodo_core.planes (id) on delete cascade,
  primary key (feature_id, plan_id)
);

create index if not exists plan_feature_inclusions_plan_idx
  on nodo_core.plan_feature_inclusions (plan_id);

alter table nodo_core.plan_feature_groups enable row level security;
alter table nodo_core.plan_features enable row level security;
alter table nodo_core.plan_feature_inclusions enable row level security;

drop policy if exists plan_feature_groups_team on nodo_core.plan_feature_groups;
create policy plan_feature_groups_team on nodo_core.plan_feature_groups
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists plan_features_team on nodo_core.plan_features;
create policy plan_features_team on nodo_core.plan_features
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists plan_feature_inclusions_team on nodo_core.plan_feature_inclusions;
create policy plan_feature_inclusions_team on nodo_core.plan_feature_inclusions
  for all to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

-- Seed Nodo Inmo feature matrix (idempotent: skip if groups already exist).
do $$
declare
  p_starter uuid;
  p_pro uuid;
  g_id uuid;
  f_id uuid;
begin
  if exists (select 1 from nodo_core.plan_feature_groups where unit_code = 'Inmo') then
    return;
  end if;

  select id into p_starter from nodo_core.planes where unit_code = 'Inmo' and code = 'starter';
  select id into p_pro from nodo_core.planes where unit_code = 'Inmo' and code = 'pro';
  if p_starter is null or p_pro is null then
    return;
  end if;

  -- Propiedades
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Propiedades', 1) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Alta y ficha completa de cada propiedad', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Fotos y documentos adjuntos', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Estados: disponible, alquilada o vendida', 3) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Búsqueda y filtros avanzados', 4) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Web interna con visualización y opción de compartir detalle', 5) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);

  -- Contratos de alquiler
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Contratos de alquiler', 2) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Cálculo automático de aumentos (ICL/IPC)', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Alertas de vencimiento de contrato', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Generación automática de contratos desde carga de datos', 3) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);

  -- Caja y cobros
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Caja y cobros', 3) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Cobros de alquiler y expensas (efectivo y transferencia)', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Cuentas bancarias', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Caja interna: ingresos/egresos de caja chica', 3) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Historial de pagos e informe de morosidad', 4) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Integración con Mercado Pago', 5) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);

  -- Ventas
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Ventas', 4) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Pipeline: interesado, reserva', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Estadísticas de ventas por empleado (productividad)', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);

  -- Usuarios
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Usuarios', 5) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Roles Admin y Agentes de la inmobiliaria', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Acceso web y móvil, sin instalación', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_starter), (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Portal Propietario con Rol Propietario', 3) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Portal Inquilinos: contrato, pagos e historial', 4) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Elevación de reclamos y seguimiento desde el portal', 5) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);

  -- Automatizaciones
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Automatizaciones', 6) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Avisos de vencimiento, aumentos y mora por WhatsApp', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Administración automática de redes sociales', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);

  -- Integraciones
  insert into nodo_core.plan_feature_groups (unit_code, label, sort_order) values ('Inmo', 'Integraciones', 7) returning id into g_id;
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'Gmail y Google Sheets', 1) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);
  insert into nodo_core.plan_features (group_id, label, sort_order) values (g_id, 'NODO ID: llave de conexión con el ecosistema', 2) returning id into f_id;
  insert into nodo_core.plan_feature_inclusions (feature_id, plan_id) values (f_id, p_pro);
end $$;
