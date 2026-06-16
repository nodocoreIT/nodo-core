-- Fix: the nodo-inmo admin user was incorrectly assigned role 'medico'
-- (a nodo-clinica role) in shared.org_members.
-- Correct it to 'admin' for the nodo-inmo org.
UPDATE shared.org_members
SET role = 'admin'
WHERE user_id = '5e6a0f8d-a4a5-424c-85ab-5a94043b5e26'
  AND org_id  = '6473d7c6-4e75-486b-8841-92974c03e6a5'
  AND role    = 'medico';
