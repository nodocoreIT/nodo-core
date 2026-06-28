-- Expand org_invitations role check to support roles from all nodos
-- (autos: seller/guest, finanzas: member, shared: super_admin)
ALTER TABLE shared.org_invitations
  DROP CONSTRAINT org_invitations_role_check;

ALTER TABLE shared.org_invitations
  ADD CONSTRAINT org_invitations_role_check
  CHECK (role IN ('admin','super_admin','agent','owner','tenant','seller','guest','member'));
