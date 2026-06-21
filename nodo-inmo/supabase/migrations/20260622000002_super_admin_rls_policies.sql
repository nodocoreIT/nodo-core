-- Update ALL RLS policies to accept super_admin alongside admin.
-- This migration covers every table and storage bucket that gates on role = 'admin'.

-- =========================================================================
-- 1. shared.org_members (from s1_security_baseline)
-- =========================================================================
DROP POLICY IF EXISTS "members_admin_insert" ON shared.org_members;
CREATE POLICY "members_admin_insert" ON shared.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    AND role NOT IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "members_admin_update" ON shared.org_members;
CREATE POLICY "members_admin_update" ON shared.org_members
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    AND role NOT IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    AND role NOT IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "members_admin_delete" ON shared.org_members;
CREATE POLICY "members_admin_delete" ON shared.org_members
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    AND role NOT IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 2. shared.org_invitations
-- =========================================================================
DROP POLICY IF EXISTS "invitations_admin_all" ON shared.org_invitations;
CREATE POLICY "invitations_admin_all" ON shared.org_invitations
  FOR ALL TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 3. nodo_inmo.org_profiles
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.org_profiles;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.org_profiles;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.org_profiles;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.org_profiles;

CREATE POLICY "admin_select" ON nodo_inmo.org_profiles
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.org_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.org_profiles
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.org_profiles
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 4. nodo_inmo.owner_settlements
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.owner_settlements;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.owner_settlements;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.owner_settlements;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.owner_settlements;

CREATE POLICY "admin_select" ON nodo_inmo.owner_settlements
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.owner_settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.owner_settlements
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.owner_settlements
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 5. nodo_inmo.cash_movements
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.cash_movements;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.cash_movements;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.cash_movements;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.cash_movements;

CREATE POLICY "admin_select" ON nodo_inmo.cash_movements
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.cash_movements
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.cash_movements
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 6. nodo_inmo.documents
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.documents;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.documents;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.documents;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.documents;

CREATE POLICY "admin_select" ON nodo_inmo.documents
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.documents
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.documents
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 7. nodo_inmo.property_expenses
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.property_expenses;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.property_expenses;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.property_expenses;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.property_expenses;

CREATE POLICY "admin_select" ON nodo_inmo.property_expenses
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.property_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.property_expenses
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.property_expenses
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 8. nodo_inmo.conceptos
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.conceptos;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.conceptos;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.conceptos;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.conceptos;

CREATE POLICY "admin_select" ON nodo_inmo.conceptos
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.conceptos
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.conceptos
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.conceptos
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 9. nodo_inmo.cash_accounts
-- =========================================================================
DROP POLICY IF EXISTS "admin_select" ON nodo_inmo.cash_accounts;
DROP POLICY IF EXISTS "admin_insert" ON nodo_inmo.cash_accounts;
DROP POLICY IF EXISTS "admin_update" ON nodo_inmo.cash_accounts;
DROP POLICY IF EXISTS "admin_delete" ON nodo_inmo.cash_accounts;

CREATE POLICY "admin_select" ON nodo_inmo.cash_accounts
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_insert" ON nodo_inmo.cash_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_update" ON nodo_inmo.cash_accounts
  FOR UPDATE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "admin_delete" ON nodo_inmo.cash_accounts
  FOR DELETE TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 10. storage.objects — org-branding bucket
-- =========================================================================
DROP POLICY IF EXISTS "branding_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;

CREATE POLICY "branding_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "branding_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-branding'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'org-branding'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 11. storage.objects — org-documents bucket
-- =========================================================================
DROP POLICY IF EXISTS "documents_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_admin_delete" ON storage.objects;

CREATE POLICY "documents_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "documents_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "documents_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "documents_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );

-- =========================================================================
-- 12. storage.objects — property-expense-receipts bucket
-- =========================================================================
DROP POLICY IF EXISTS "receipts_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_admin_delete" ON storage.objects;

CREATE POLICY "receipts_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-expense-receipts'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "receipts_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-expense-receipts'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "receipts_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-expense-receipts'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'property-expense-receipts'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
CREATE POLICY "receipts_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-expense-receipts'
    AND (storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
  );
