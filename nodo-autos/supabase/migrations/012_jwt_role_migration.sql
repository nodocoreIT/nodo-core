-- ============================================================
-- Migration 012 — JWT Role Migration for nodo-autos
--
-- 1. Extends shared.org_members role constraint to include
--    seller, guest, and member (multi-nodo roles).
-- 2. Backfills shared.org_members from nodo_autos.users so
--    existing users can be authenticated via JWT claims instead
--    of DB role queries.
--
-- Role mapping:
--   administrador → admin
--   vendedor      → seller
--   marketing     → seller   (marketing role is retired)
--
-- Org resolution: attempts to match by product='nodo-autos' and
-- name matching the cliente.nombre. If no org row exists, inserts one.
--
-- The nodo_autos.users table is NOT dropped — it still holds
-- whatsapp_numero, profile_photo_url, and is_activo.
-- ============================================================

-- ─── Step 1: Extend role constraint to cover multi-nodo roles ────────────────

ALTER TABLE shared.org_members
  DROP CONSTRAINT IF EXISTS org_members_role_check;

ALTER TABLE shared.org_members
  ADD CONSTRAINT org_members_role_check
    CHECK (role IN ('admin', 'agent', 'owner', 'tenant', 'super_admin', 'seller', 'guest', 'member'));

-- ─── Step 2: Add external_id column to shared.organizations if absent ────────
-- Used to link a shared.organizations row to a nodo_autos.clientes row.

ALTER TABLE shared.organizations
  ADD COLUMN IF NOT EXISTS external_id text;

-- ─── Step 3: Backfill shared.org_members ─────────────────────────────────────

DO $$
DECLARE
  v_user       RECORD;
  v_org_id     uuid;
  v_db_role    text;
BEGIN
  FOR v_user IN
    SELECT
      u.id          AS user_id,
      u.cliente_id,
      u.role        AS legacy_role,
      c.nombre      AS cliente_nombre
    FROM nodo_autos.users u
    JOIN nodo_autos.clientes c ON c.id = u.cliente_id
  LOOP
    -- Try to find an existing org row for this cliente by external_id first.
    SELECT id INTO v_org_id
    FROM shared.organizations
    WHERE product = 'nodo-autos'
      AND external_id = v_user.cliente_id::text
    LIMIT 1;

    -- Fallback: match by name.
    IF v_org_id IS NULL THEN
      SELECT id INTO v_org_id
      FROM shared.organizations
      WHERE product = 'nodo-autos'
        AND name = v_user.cliente_nombre
      LIMIT 1;

      -- If found by name, backfill external_id for future lookups.
      IF v_org_id IS NOT NULL THEN
        UPDATE shared.organizations
        SET external_id = v_user.cliente_id::text
        WHERE id = v_org_id;
      END IF;
    END IF;

    -- If still not found, create a new org row.
    IF v_org_id IS NULL THEN
      INSERT INTO shared.organizations (name, product, external_id)
      VALUES (v_user.cliente_nombre, 'nodo-autos', v_user.cliente_id::text)
      RETURNING id INTO v_org_id;
    END IF;

    -- Map legacy DB role to JWT role.
    v_db_role := CASE v_user.legacy_role
      WHEN 'administrador' THEN 'admin'
      WHEN 'vendedor'      THEN 'seller'
      WHEN 'marketing'     THEN 'seller'   -- marketing retired; map to seller
      ELSE                      'guest'    -- unknown roles default to guest
    END;

    -- Insert into shared.org_members; skip if already present.
    INSERT INTO shared.org_members (org_id, user_id, role, created_at)
    VALUES (v_org_id, v_user.user_id, v_db_role, now())
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;
END $$;


-- ─── DOWN (manual rollback instructions) ─────────────────────────────────────
-- To revert this migration:
--
-- 1. Remove the backfilled org_members rows:
--    DELETE FROM shared.org_members
--    WHERE org_id IN (
--      SELECT id FROM shared.organizations WHERE product = 'nodo-autos'
--    );
--
-- 2. Remove the org rows created by this migration:
--    DELETE FROM shared.organizations
--    WHERE product = 'nodo-autos';
--
-- 3. Restore the original role constraint:
--    ALTER TABLE shared.org_members
--      DROP CONSTRAINT IF EXISTS org_members_role_check;
--    ALTER TABLE shared.org_members
--      ADD CONSTRAINT org_members_role_check
--        CHECK (role IN ('admin', 'agent', 'owner', 'tenant', 'super_admin'));
--
-- 4. Drop the external_id column (if desired):
--    ALTER TABLE shared.organizations DROP COLUMN IF EXISTS external_id;
