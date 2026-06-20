-- nodo-tienda-store reads/writes via service_role PostgREST (server-side).
grant usage on schema nodo_tienda to service_role;

grant select, insert, update, delete on all tables in schema nodo_tienda to service_role;
grant usage, select on all sequences in schema nodo_tienda to service_role;

alter default privileges in schema nodo_tienda
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema nodo_tienda
  grant usage, select on sequences to service_role;
