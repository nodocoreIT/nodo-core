-- Grants for nodo_tienda (policies on shared already exist from nodo-inmo).
grant usage on schema nodo_tienda to authenticated;

alter default privileges in schema nodo_tienda
  grant select, insert, update, delete on tables to authenticated;
