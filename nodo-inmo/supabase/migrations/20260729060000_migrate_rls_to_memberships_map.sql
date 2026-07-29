-- Fase 2, Parte B: migrate every Inmo RLS policy that reads the flat
-- app_metadata.org_id/role to read app_metadata.memberships.inmo instead.
-- Built from the LIVE policy definitions (pg_policies), not the migration
-- history, since this schema has drifted from tracked migrations before.
-- Only ALTER POLICY (no DROP/CREATE) so grants/ownership are untouched.
--
-- Explicitly OUT of scope for this migration (flagged, not touched):
--   - 12 nodo_clinica.* policies (different product, its own memberships slot).
--   - storage.objects patient-documents policies (mixed clinica/org_id use —
--     needs its own decision on which memberships slot applies).

-- ── nodo_inmo.cash_accounts ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.cash_accounts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.cash_accounts
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.cash_accounts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.cash_accounts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.cash_movements ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.cash_movements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.cash_movements
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.cash_movements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.cash_movements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.conceptos ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.conceptos
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.conceptos
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.conceptos
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.conceptos
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.contacts ─────────────────────────────────────────────
alter policy "org_delete" on nodo_inmo.contacts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.contacts
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.contacts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "staff_select" on nodo_inmo.contacts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));

-- ── nodo_inmo.contract_guarantors ─────────────────────────────────────────────
alter policy "org_select" on nodo_inmo.contract_guarantors
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.contract_guarantors
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.contract_guarantors
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_delete" on nodo_inmo.contract_guarantors
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);

-- ── nodo_inmo.contracts ─────────────────────────────────────────────
alter policy "org_delete" on nodo_inmo.contracts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.contracts
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.contracts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "staff_select" on nodo_inmo.contracts
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));

-- ── nodo_inmo.documents ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.documents
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.documents
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.documents
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.documents
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.org_profiles ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.org_profiles
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.org_profiles
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.org_profiles
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.org_profiles
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "agent_select" on nodo_inmo.org_profiles
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = 'agent');

-- ── nodo_inmo.owner_settlements ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.owner_settlements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.owner_settlements
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.owner_settlements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.owner_settlements
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.payments ─────────────────────────────────────────────
alter policy "org_delete" on nodo_inmo.payments
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.payments
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.payments
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "staff_select" on nodo_inmo.payments
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));

-- ── nodo_inmo.properties ─────────────────────────────────────────────
alter policy "org_delete" on nodo_inmo.properties
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.properties
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.properties
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "staff_select" on nodo_inmo.properties
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));

-- ── nodo_inmo.property_expenses ─────────────────────────────────────────────
alter policy "admin_select" on nodo_inmo.property_expenses
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_insert" on nodo_inmo.property_expenses
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_update" on nodo_inmo.property_expenses
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "admin_delete" on nodo_inmo.property_expenses
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── nodo_inmo.reclamos ─────────────────────────────────────────────
alter policy "staff_select" on nodo_inmo.reclamos
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));
alter policy "staff_insert" on nodo_inmo.reclamos
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));
alter policy "staff_update" on nodo_inmo.reclamos
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','agent','super_admin']));

-- ── nodo_inmo.tasks ─────────────────────────────────────────────
alter policy "org_select" on nodo_inmo.tasks
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_insert" on nodo_inmo.tasks
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update" on nodo_inmo.tasks
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_delete" on nodo_inmo.tasks
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);

-- ── shared.nodo_id ─────────────────────────────────────────────
alter policy "nodo_id_read_own" on shared.nodo_id
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "nodo_id_update_own" on shared.nodo_id
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);

-- ── shared.org_invitations ─────────────────────────────────────────────
alter policy "invitations_admin_all" on shared.org_invitations
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── shared.org_members ─────────────────────────────────────────────
-- (the "role <> all [admin, super_admin]" clause checks the TARGET ROW's own
-- role column, not the caller's JWT — left untouched.)
alter policy "members_read_same_org" on shared.org_members
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "members_admin_insert" on shared.org_members
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin'])
    and role <> all (array['admin','super_admin']));
alter policy "members_admin_update" on shared.org_members
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin'])
    and role <> all (array['admin','super_admin']))
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin'])
    and role <> all (array['admin','super_admin']));
alter policy "members_admin_delete" on shared.org_members
  using (org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin'])
    and role <> all (array['admin','super_admin']));

-- ── shared.organizations ─────────────────────────────────────────────
alter policy "org_read_own" on shared.organizations
  using (id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);
alter policy "org_update_own" on shared.organizations
  using (id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid)
  with check (id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid);

-- ── storage.objects: org-branding ─────────────────────────────────────────────
alter policy "branding_admin_select" on storage.objects
  using (bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "branding_admin_insert" on storage.objects
  with check (bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "branding_admin_update" on storage.objects
  using (bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "branding_admin_delete" on storage.objects
  using (bucket_id = 'org-branding'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── storage.objects: org-documents ─────────────────────────────────────────────
alter policy "documents_admin_select" on storage.objects
  using (bucket_id = 'org-documents'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "documents_admin_insert" on storage.objects
  with check (bucket_id = 'org-documents'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "documents_admin_update" on storage.objects
  using (bucket_id = 'org-documents'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (bucket_id = 'org-documents'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "documents_admin_delete" on storage.objects
  using (bucket_id = 'org-documents'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));

-- ── storage.objects: property-expense-receipts ─────────────────────────────────────────────
alter policy "receipts_admin_select" on storage.objects
  using (bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "receipts_admin_insert" on storage.objects
  with check (bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "receipts_admin_update" on storage.objects
  using (bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']))
  with check (bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
alter policy "receipts_admin_delete" on storage.objects
  using (bucket_id = 'property-expense-receipts'
    and (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' = any (array['admin','super_admin']));
