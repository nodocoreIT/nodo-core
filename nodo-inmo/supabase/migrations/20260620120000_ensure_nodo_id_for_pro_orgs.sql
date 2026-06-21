-- Ensure every Pro organization has a Nodo ID row (local + prod backfill).
-- Clients can only SELECT; rows are inserted here via migration/service role.

insert into shared.nodo_id (org_id, product)
select o.id, coalesce(nullif(trim(o.product), ''), 'inmo')
from shared.organizations o
where o.tier = 'pro'
  and not exists (
    select 1
    from shared.nodo_id n
    where n.org_id = o.id
      and n.product = coalesce(nullif(trim(o.product), ''), 'inmo')
  );
