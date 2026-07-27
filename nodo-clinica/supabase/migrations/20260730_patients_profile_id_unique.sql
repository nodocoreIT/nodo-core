-- Dedupe nodo_clinica.patients rows that share the same profile_id (caused by
-- a race in the PUT /api/clinic/patients auto-create path — concurrent
-- "save photo" + "save profile" requests on a brand-new profile could both
-- see "no row yet" and both insert), then enforce uniqueness going forward.
--
-- For every duplicate group: keep the earliest-created row, repoint every FK
-- across the database that references patients(id) from the losing row(s) to
-- the keeper, merge any non-null fields the keeper is missing, then drop the
-- losing row(s). FK targets are discovered dynamically via pg_constraint so
-- this doesn't need to hand-enumerate every referencing table (appointments,
-- patient_documents, clinical_records, patient_health_profiles, ...).

do $$
declare
  dup record;
  keeper_id uuid;
  loser_id uuid;
  fk record;
begin
  for dup in
    select profile_id
    from nodo_clinica.patients
    where profile_id is not null
    group by profile_id
    having count(*) > 1
  loop
    select id into keeper_id
    from nodo_clinica.patients
    where profile_id = dup.profile_id
    order by created_at asc, id asc
    limit 1;

    for loser_id in
      select id from nodo_clinica.patients
      where profile_id = dup.profile_id and id <> keeper_id
    loop
      for fk in
        select
          n.nspname as schema_name,
          c.relname as table_name,
          a.attname as column_name
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        join unnest(con.conkey) as k(attnum) on true
        join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
        where con.contype = 'f'
          and con.confrelid = 'nodo_clinica.patients'::regclass
      loop
        begin
          execute format(
            'update %I.%I set %I = $1 where %I = $2',
            fk.schema_name, fk.table_name, fk.column_name, fk.column_name
          ) using keeper_id, loser_id;
        exception when unique_violation then
          -- 1:1 table (e.g. patient_health_profiles, FK column is also its PK):
          -- keeper already has a row here, so just drop the loser's.
          execute format(
            'delete from %I.%I where %I = $1',
            fk.schema_name, fk.table_name, fk.column_name
          ) using loser_id;
        end;
      end loop;

      update nodo_clinica.patients k
      set
        first_name = coalesce(k.first_name, l.first_name),
        last_name = coalesce(k.last_name, l.last_name),
        full_name = coalesce(nullif(k.full_name, ''), l.full_name),
        phone = coalesce(nullif(k.phone, ''), l.phone),
        dni = coalesce(k.dni, l.dni),
        address = coalesce(k.address, l.address),
        profile_photo_url = coalesce(k.profile_photo_url, l.profile_photo_url)
      from nodo_clinica.patients l
      where k.id = keeper_id and l.id = loser_id;

      delete from nodo_clinica.patients where id = loser_id;
    end loop;
  end loop;
end $$;

-- Multiple NULLs stay allowed (patients created by a doctor with no linked
-- auth account never get a profile_id).
create unique index if not exists patients_profile_id_key
  on nodo_clinica.patients (profile_id)
  where profile_id is not null;
