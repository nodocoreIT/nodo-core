-- nodo_tienda order number generation
--
-- generate_order_number(p_org_id) — computes the next sequential number
-- for a given org and returns it in 'TDA-NNNNNN' format.
--
-- set_order_number() — BEFORE INSERT trigger that calls generate_order_number
-- only when order_number is null or empty, so callers can still supply an
-- explicit order number if needed (e.g. data migrations).
--
-- Both functions are SECURITY DEFINER with an empty search_path to prevent
-- search-path injection.  generate_order_number is not exposed as an RPC;
-- it is called only from the trigger.

-- ---------------------------------------------------------------------------
-- 1. Counter function
-- ---------------------------------------------------------------------------
create or replace function nodo_tienda.generate_order_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from nodo_tienda.orders
  where org_id = p_org_id;

  return 'TDA-' || lpad((v_count + 1)::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger function
-- ---------------------------------------------------------------------------
create or replace function nodo_tienda.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_number is null or trim(new.order_number) = '' then
    new.order_number := nodo_tienda.generate_order_number(new.org_id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger on orders
-- ---------------------------------------------------------------------------
create trigger set_order_number_trigger
  before insert on nodo_tienda.orders
  for each row
  execute function nodo_tienda.set_order_number();
