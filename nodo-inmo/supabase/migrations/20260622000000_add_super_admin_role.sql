-- Add super_admin role to org_members
-- super_admin is the org creator/owner who can manage all invited members.

ALTER TABLE shared.org_members
  DROP CONSTRAINT org_members_role_check,
  ADD CONSTRAINT org_members_role_check
    CHECK (role IN ('admin', 'agent', 'owner', 'tenant', 'super_admin'));

-- Promote the earliest admin in each org to super_admin (org creator heuristic).
-- Each org gets exactly one super_admin: the member with the lowest created_at among admins.
UPDATE shared.org_members om
SET role = 'super_admin'
WHERE role = 'admin'
  AND om.created_at = (
    SELECT MIN(sub.created_at)
    FROM shared.org_members sub
    WHERE sub.org_id = om.org_id
      AND sub.role = 'admin'
  );
