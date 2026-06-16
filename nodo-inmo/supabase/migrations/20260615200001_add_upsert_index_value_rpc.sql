create or replace function shared.upsert_index_value(
  p_kind   text,
  p_period date,
  p_value  numeric,
  p_source text default 'manual'
)
returns shared.indices
language plpgsql
security definer
set search_path = shared
as $$
declare v_row shared.indices;
begin
  insert into shared.indices (kind, period, value, source)
  values (p_kind, p_period, p_value, p_source)
  on conflict (kind, period) do update
    set value  = excluded.value,
        source = excluded.source
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function shared.upsert_index_value(text, date, numeric, text) to authenticated;
