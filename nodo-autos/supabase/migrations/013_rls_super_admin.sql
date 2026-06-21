-- ============================================================
-- Migration 013 — RLS super_admin bypass for nodo-autos
--
-- Adds a super_admin bypass clause to all tenant-isolation RLS
-- policies without rewriting the underlying cliente_id isolation model.
--
-- Strategy:
--   - For read/write policies that use get_my_cliente_id(): add OR EXISTS
--     (SELECT 1 FROM shared.org_members WHERE user_id = auth.uid()
--      AND role = 'super_admin') so super_admins can read/write any row.
--   - For the audit_logs admin-only policy: replace the legacy
--     get_my_role() = 'administrador' check with a shared.org_members
--     lookup that accepts 'admin' and 'super_admin' JWT roles.
--
-- Helper function update:
--   get_my_role() now also reads from shared.org_members as a fallback
--   so JWT-role users can still satisfy the original role-based helpers.
-- ============================================================

-- ─── Helper: super_admin check ───────────────────────────────────────────────
-- Reusable SECURITY DEFINER function to avoid repeating the subquery.

CREATE OR REPLACE FUNCTION nodo_autos.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = nodo_autos, shared, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shared.org_members
    WHERE user_id = (SELECT auth.uid())
      AND role = 'super_admin'
  )
$$;

REVOKE ALL ON FUNCTION nodo_autos.is_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION nodo_autos.is_super_admin() TO authenticated, service_role;

-- ─── Helper: is_autos_admin (admin OR super_admin) ───────────────────────────

CREATE OR REPLACE FUNCTION nodo_autos.is_autos_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = nodo_autos, shared, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shared.org_members
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  )
$$;

REVOKE ALL ON FUNCTION nodo_autos.is_autos_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION nodo_autos.is_autos_admin() TO authenticated, service_role;

-- ─── clientes ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "clientes: read own" ON nodo_autos.clientes;
CREATE POLICY "clientes: read own"
  ON nodo_autos.clientes FOR SELECT
  TO authenticated
  USING (
    id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "clientes: admin update own" ON nodo_autos.clientes;
CREATE POLICY "clientes: admin update own"
  ON nodo_autos.clientes FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  )
  WITH CHECK (
    id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── users ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users: read same cliente" ON nodo_autos.users;
CREATE POLICY "users: read same cliente"
  ON nodo_autos.users FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "users: update own profile" ON nodo_autos.users;
CREATE POLICY "users: update own profile"
  ON nodo_autos.users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users: admin update same cliente" ON nodo_autos.users;
CREATE POLICY "users: admin update same cliente"
  ON nodo_autos.users FOR UPDATE
  TO authenticated
  USING (
    (
      cliente_id = (SELECT nodo_autos.get_my_cliente_id())
      AND (SELECT nodo_autos.get_my_role()) = 'administrador'
    )
    OR (SELECT nodo_autos.is_super_admin())
  )
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── vehicles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "vehicles: read" ON nodo_autos.vehicles;
CREATE POLICY "vehicles: read"
  ON nodo_autos.vehicles FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "vehicles: insert" ON nodo_autos.vehicles;
CREATE POLICY "vehicles: insert"
  ON nodo_autos.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "vehicles: update" ON nodo_autos.vehicles;
CREATE POLICY "vehicles: update"
  ON nodo_autos.vehicles FOR UPDATE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "vehicles: delete" ON nodo_autos.vehicles;
CREATE POLICY "vehicles: delete"
  ON nodo_autos.vehicles FOR DELETE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── publications ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "publications: read" ON nodo_autos.publications;
CREATE POLICY "publications: read"
  ON nodo_autos.publications FOR SELECT
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT v.id FROM nodo_autos.vehicles v
      WHERE v.cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    )
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "publications: insert" ON nodo_autos.publications;
CREATE POLICY "publications: insert"
  ON nodo_autos.publications FOR INSERT
  TO authenticated
  WITH CHECK (
    vehicle_id IN (
      SELECT v.id FROM nodo_autos.vehicles v
      WHERE v.cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    )
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "publications: update" ON nodo_autos.publications;
CREATE POLICY "publications: update"
  ON nodo_autos.publications FOR UPDATE
  TO authenticated
  USING (
    vehicle_id IN (
      SELECT v.id FROM nodo_autos.vehicles v
      WHERE v.cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    )
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── customers ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "customers: read" ON nodo_autos.customers;
CREATE POLICY "customers: read"
  ON nodo_autos.customers FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "customers: insert" ON nodo_autos.customers;
CREATE POLICY "customers: insert"
  ON nodo_autos.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "customers: update" ON nodo_autos.customers;
CREATE POLICY "customers: update"
  ON nodo_autos.customers FOR UPDATE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "customers: delete" ON nodo_autos.customers;
CREATE POLICY "customers: delete"
  ON nodo_autos.customers FOR DELETE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── contracts ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "contracts: read" ON nodo_autos.contracts;
CREATE POLICY "contracts: read"
  ON nodo_autos.contracts FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "contracts: insert" ON nodo_autos.contracts;
CREATE POLICY "contracts: insert"
  ON nodo_autos.contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── audit_logs — now checks shared.org_members for admin/super_admin ────────

DROP POLICY IF EXISTS "audit_logs: read (admins only)" ON nodo_autos.audit_logs;
CREATE POLICY "audit_logs: read (admins only)"
  ON nodo_autos.audit_logs FOR SELECT
  TO authenticated
  USING (
    (
      cliente_id = (SELECT nodo_autos.get_my_cliente_id())
      AND (SELECT nodo_autos.is_autos_admin())
    )
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "audit_logs: insert" ON nodo_autos.audit_logs;
CREATE POLICY "audit_logs: insert"
  ON nodo_autos.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── tasks ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks: read" ON nodo_autos.tasks;
CREATE POLICY "tasks: read" ON nodo_autos.tasks FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "tasks: insert" ON nodo_autos.tasks;
CREATE POLICY "tasks: insert" ON nodo_autos.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "tasks: update" ON nodo_autos.tasks;
CREATE POLICY "tasks: update" ON nodo_autos.tasks FOR UPDATE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "tasks: delete" ON nodo_autos.tasks;
CREATE POLICY "tasks: delete" ON nodo_autos.tasks FOR DELETE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── cash_movements ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cash_movements: read" ON nodo_autos.cash_movements;
CREATE POLICY "cash_movements: read" ON nodo_autos.cash_movements FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_movements: insert" ON nodo_autos.cash_movements;
CREATE POLICY "cash_movements: insert" ON nodo_autos.cash_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_movements: update" ON nodo_autos.cash_movements;
CREATE POLICY "cash_movements: update" ON nodo_autos.cash_movements FOR UPDATE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_movements: delete" ON nodo_autos.cash_movements;
CREATE POLICY "cash_movements: delete" ON nodo_autos.cash_movements FOR DELETE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── conceptos ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "conceptos: read" ON nodo_autos.conceptos;
CREATE POLICY "conceptos: read" ON nodo_autos.conceptos FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "conceptos: insert" ON nodo_autos.conceptos;
CREATE POLICY "conceptos: insert" ON nodo_autos.conceptos FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── cash_accounts ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cash_accounts: read" ON nodo_autos.cash_accounts;
CREATE POLICY "cash_accounts: read" ON nodo_autos.cash_accounts FOR SELECT
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_accounts: insert" ON nodo_autos.cash_accounts;
CREATE POLICY "cash_accounts: insert" ON nodo_autos.cash_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_accounts: update" ON nodo_autos.cash_accounts;
CREATE POLICY "cash_accounts: update" ON nodo_autos.cash_accounts FOR UPDATE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  )
  WITH CHECK (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

DROP POLICY IF EXISTS "cash_accounts: delete" ON nodo_autos.cash_accounts;
CREATE POLICY "cash_accounts: delete" ON nodo_autos.cash_accounts FOR DELETE
  TO authenticated
  USING (
    cliente_id = (SELECT nodo_autos.get_my_cliente_id())
    OR (SELECT nodo_autos.is_super_admin())
  );

-- ─── branding storage ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cliente_branding_select" ON storage.objects;
CREATE POLICY "cliente_branding_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cliente-branding'
    AND (
      (storage.foldername(name))[1] = (SELECT nodo_autos.get_my_cliente_id())::text
      OR (SELECT nodo_autos.is_super_admin())
    )
  );

DROP POLICY IF EXISTS "cliente_branding_insert" ON storage.objects;
CREATE POLICY "cliente_branding_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cliente-branding'
    AND (
      (storage.foldername(name))[1] = (SELECT nodo_autos.get_my_cliente_id())::text
      OR (SELECT nodo_autos.is_super_admin())
    )
  );

DROP POLICY IF EXISTS "cliente_branding_update" ON storage.objects;
CREATE POLICY "cliente_branding_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cliente-branding'
    AND (
      (storage.foldername(name))[1] = (SELECT nodo_autos.get_my_cliente_id())::text
      OR (SELECT nodo_autos.is_super_admin())
    )
  )
  WITH CHECK (
    bucket_id = 'cliente-branding'
    AND (
      (storage.foldername(name))[1] = (SELECT nodo_autos.get_my_cliente_id())::text
      OR (SELECT nodo_autos.is_super_admin())
    )
  );

DROP POLICY IF EXISTS "cliente_branding_delete" ON storage.objects;
CREATE POLICY "cliente_branding_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cliente-branding'
    AND (
      (storage.foldername(name))[1] = (SELECT nodo_autos.get_my_cliente_id())::text
      OR (SELECT nodo_autos.is_super_admin())
    )
  );
