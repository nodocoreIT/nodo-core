-- Purge operational data for a tenant org (keeps organization + admin membership + auth users).
-- Callable only via service role (Nodo Core dashboard).

create or replace function nodo_inmo.purge_org_operational_data(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
begin
  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  if not exists (select 1 from shared.organizations where id = p_org_id) then
    raise exception 'organization not found';
  end if;

  delete from nodo_inmo.cash_movements where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cash_movements', v_n);

  delete from nodo_inmo.property_expenses where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('property_expenses', v_n);

  delete from nodo_inmo.owner_settlements where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('owner_settlements', v_n);

  delete from nodo_inmo.payments where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('payments', v_n);

  delete from nodo_inmo.contract_guarantors where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('contract_guarantors', v_n);

  delete from nodo_inmo.documents where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('documents', v_n);

  delete from nodo_inmo.reclamos where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('reclamos', v_n);

  delete from nodo_inmo.tasks where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tasks', v_n);

  delete from nodo_inmo.contracts where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('contracts', v_n);

  delete from nodo_inmo.properties where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('properties', v_n);

  delete from nodo_inmo.contacts where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('contacts', v_n);

  delete from nodo_inmo.cash_accounts where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cash_accounts', v_n);

  delete from nodo_inmo.conceptos where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('conceptos', v_n);

  delete from nodo_inmo.org_profiles where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('org_profiles', v_n);

  delete from shared.feedback where org_id = p_org_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('feedback', v_n);

  delete from shared.org_members where org_id = p_org_id and role <> 'admin';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('org_members_non_admin', v_n);

  return v_counts;
end;
$$;

revoke all on function nodo_inmo.purge_org_operational_data(uuid) from public;
grant execute on function nodo_inmo.purge_org_operational_data(uuid) to service_role;

-- Finanzas: purge all rows scoped to a user (personal finance node).
-- Skipped on fresh Inmo-only local DB until finanzas migrations are applied.

do $outer$
begin
  if to_regclass('nodo_finanzas_personales.tarjetas_consumos') is null then
    raise notice 'purge_user_data: nodo_finanzas_personales not provisioned — skipping';
    return;
  end if;

  execute $fn$
create or replace function nodo_finanzas_personales.purge_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  delete from nodo_finanzas_personales.tarjetas_consumos where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tarjetas_consumos', v_n);

  delete from nodo_finanzas_personales.cuotas_programadas where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cuotas_programadas', v_n);

  delete from nodo_finanzas_personales.cuotas_planes_ahorro where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cuotas_planes_ahorro', v_n);

  delete from nodo_finanzas_personales.movimientos_cuenta where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('movimientos_cuenta', v_n);

  delete from nodo_finanzas_personales.gastos_diarios where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('gastos_diarios', v_n);

  delete from nodo_finanzas_personales.gastos_fijos where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('gastos_fijos', v_n);

  delete from nodo_finanzas_personales.prestamos where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('prestamos', v_n);

  delete from nodo_finanzas_personales.planes_ahorro where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('planes_ahorro', v_n);

  delete from nodo_finanzas_personales.tarjetas where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tarjetas', v_n);

  delete from nodo_finanzas_personales.subcategorias where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('subcategorias', v_n);

  delete from nodo_finanzas_personales.categorias where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('categorias', v_n);

  delete from nodo_finanzas_personales.cuentas_bancarias where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cuentas_bancarias', v_n);

  delete from nodo_finanzas_personales.cuentas where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cuentas', v_n);

  delete from nodo_finanzas_personales.sueldos where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('sueldos', v_n);

  delete from nodo_finanzas_personales.rubros where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('rubros', v_n);

  delete from nodo_finanzas_personales.configuracion_usuario where user_id = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('configuracion_usuario', v_n);

  return v_counts;
end;
$body$;
$fn$;

  execute 'revoke all on function nodo_finanzas_personales.purge_user_data(uuid) from public';
  execute 'grant execute on function nodo_finanzas_personales.purge_user_data(uuid) to service_role';
end $outer$;
