-- Migración para agregar el estado 'negotiation' (En tratativa) y registrar quién realizó el cambio de estado

-- 1. Eliminar la restricción de check anterior si existe
alter table nodo_inmo.properties
  drop constraint if exists properties_status_check;

-- 2. Agregar la nueva restricción con 'negotiation'
alter table nodo_inmo.properties
  add constraint properties_status_check
  check (status in ('available', 'reserved', 'rented', 'sold', 'inactive', 'negotiation'));

-- 3. Agregar columna para guardar el usuario que cambió el estado
alter table nodo_inmo.properties
  add column if not exists status_changed_by uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'properties_status_changed_by_fkey'
      and table_schema = 'nodo_inmo'
  ) then
    alter table nodo_inmo.properties
      add constraint properties_status_changed_by_fkey foreign key (status_changed_by) references shared.user_profiles(id) on delete set null;
  end if;
end $$;

-- 4. Crear la función del trigger para setear el usuario automáticamente
create or replace function nodo_inmo.handle_property_status_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT') then
    if new.status != 'available' then
      if auth.uid() is not null then
        new.status_changed_by := auth.uid();
      end if;
    else
      new.status_changed_by := null;
    end if;
  elsif (TG_OP = 'UPDATE') then
    if new.status is distinct from old.status then
      if new.status = 'available' then
        new.status_changed_by := null;
      else
        if auth.uid() is not null then
          new.status_changed_by := auth.uid();
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 5. Vincular el trigger a la tabla
drop trigger if exists handle_property_status_change on nodo_inmo.properties;

create trigger handle_property_status_change
  before insert or update on nodo_inmo.properties
  for each row
  execute function nodo_inmo.handle_property_status_change();
