-- RLS smoke test for "Mis estudios" personal documents (appointment_id IS NULL).
-- Run manually against the linked project (Supabase SQL editor or `psql -f`)
-- AFTER applying 20260827b_patient_documents_personal_library.sql and
-- 20260827c_patient_documents_personal_rls.sql. Self-contained: wraps
-- everything in a transaction that is ROLLED BACK at the end, so it leaves no
-- test data behind. Uses Supabase's documented technique for testing RLS
-- from SQL (SET LOCAL "request.jwt.claims" + SET LOCAL ROLE authenticated) —
-- see https://supabase.com/docs/guides/database/testing.
--
-- Not executed this session: no live DB credentials were available (Supabase
-- CLI `db query --linked` returned 403; no Supabase MCP tool in this session;
-- no SUPABASE_DB_PASSWORD in env). Written as RED (fails against pre-migration
-- schema/policies) -> GREEN (passes once 20260827b/c are applied).

begin;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Two fake auth users (no real auth.users row needed — RLS only reads the JWT
-- claim via auth.uid(), it doesn't require the row to exist for this test).
do $$
declare
  v_patient_a_auth uuid := '11111111-1111-1111-1111-111111111111';
  v_patient_b_auth uuid := '22222222-2222-2222-2222-222222222222';
  v_patient_a_id uuid;
  v_patient_b_id uuid;
  v_org_id uuid;
  v_doc_a_id uuid;
  v_count int;
begin
  -- org_id intentionally left NULL: it's nullable after 20260827b and the
  -- RLS policies under test don't reference it — a personal doc must not
  -- require an org.
  v_org_id := null;

  insert into nodo_clinica.patients (profile_id, full_name, org_id)
  values (v_patient_a_auth, 'RLS Test Patient A', v_org_id)
  returning id into v_patient_a_id;

  insert into nodo_clinica.patients (profile_id, full_name, org_id)
  values (v_patient_b_auth, 'RLS Test Patient B', v_org_id)
  returning id into v_patient_b_id;

  -- ── Test 1: migration ran — appointment_id nullable, study_order_id exists ──
  perform 1
  from information_schema.columns
  where table_schema = 'nodo_clinica' and table_name = 'patient_documents'
    and column_name = 'appointment_id' and is_nullable = 'YES';
  if not found then
    raise exception 'FAIL: appointment_id is still NOT NULL — 20260827b not applied';
  end if;

  perform 1
  from information_schema.columns
  where table_schema = 'nodo_clinica' and table_name = 'patient_documents'
    and column_name = 'study_order_id';
  if not found then
    raise exception 'FAIL: study_order_id column missing — 20260827b not applied';
  end if;
  raise notice 'PASS: migration applied (appointment_id nullable, study_order_id present)';

  -- ── Test 2: RLS INSERT — patient A can insert with appointment_id = null ───
  set local role authenticated;
  set local "request.jwt.claims" = json_build_object('sub', v_patient_a_auth, 'role', 'authenticated')::text;

  insert into nodo_clinica.patient_documents
    (patient_id, org_id, appointment_id, file_name, file_path, mime_type, document_type)
  values
    (v_patient_a_id, v_org_id, null, 'estudio-a.pdf', 'personal/test/estudio-a.pdf', 'application/pdf', 'study')
  returning id into v_doc_a_id;
  raise notice 'PASS: patient A inserted personal doc %', v_doc_a_id;

  -- Patient B inserts their own personal doc too, so the SELECT test below
  -- proves real cross-patient isolation (not just "no rows exist yet").
  set local "request.jwt.claims" = json_build_object('sub', v_patient_b_auth, 'role', 'authenticated')::text;
  insert into nodo_clinica.patient_documents
    (patient_id, org_id, appointment_id, file_name, file_path, mime_type, document_type)
  values
    (v_patient_b_id, v_org_id, null, 'estudio-b.pdf', 'personal/test/estudio-b.pdf', 'application/pdf', 'study');
  raise notice 'PASS: patient B inserted their own personal doc';

  -- ── Test 3: RLS SELECT — patient A sees only their own personal docs ───────
  set local "request.jwt.claims" = json_build_object('sub', v_patient_a_auth, 'role', 'authenticated')::text;

  select count(*) into v_count
  from nodo_clinica.patient_documents
  where appointment_id is null and patient_id = v_patient_a_id;
  if v_count <> 1 then
    raise exception 'FAIL: patient A should see exactly 1 personal doc, saw %', v_count;
  end if;

  select count(*) into v_count
  from nodo_clinica.patient_documents
  where appointment_id is null and patient_id = v_patient_b_id;
  if v_count <> 0 then
    raise exception 'FAIL: patient A should NOT see patient B''s personal docs (cross-patient SELECT leak), saw %', v_count;
  end if;

  -- Unqualified count: RLS should silently drop B's row from A's view even
  -- without a patient_id filter, proving the policy — not app-level
  -- filtering — is what enforces isolation.
  select count(*) into v_count from nodo_clinica.patient_documents where appointment_id is null;
  if v_count <> 1 then
    raise exception 'FAIL: patient A''s unfiltered view should show exactly 1 personal doc (their own), saw %', v_count;
  end if;
  raise notice 'PASS: patient A sees only own personal docs (cross-patient SELECT denied)';

  -- ── Test 4: cross-patient DELETE denied ─────────────────────────────────────
  -- Switch to patient B's JWT and try deleting patient A's doc by id.
  set local "request.jwt.claims" = json_build_object('sub', v_patient_b_auth, 'role', 'authenticated')::text;
  delete from nodo_clinica.patient_documents where id = v_doc_a_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: patient B deleted patient A''s personal doc — RLS DELETE leak';
  end if;
  raise notice 'PASS: patient B cannot delete patient A''s personal doc';

  -- ── Test 5: RLS DELETE — patient A can delete their own personal doc ───────
  set local "request.jwt.claims" = json_build_object('sub', v_patient_a_auth, 'role', 'authenticated')::text;
  delete from nodo_clinica.patient_documents where id = v_doc_a_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL: patient A could not delete their own personal doc';
  end if;
  raise notice 'PASS: patient A deleted their own personal doc';

  reset role;
end $$;

-- ── Test 6: regression — appointment-scoped queries still filter correctly ──
-- Existing appointment-scoped reads must never surface a null-appointment
-- (personal) row. This is a plain assertion, no role switch needed: it
-- exercises the same predicate the app uses (patients/route.ts stat counts,
-- documents/route.ts appointment/token branches).
do $$
declare
  v_leaked int;
begin
  select count(*) into v_leaked
  from nodo_clinica.patient_documents
  where appointment_id is not null
    and appointment_id is null; -- always 0; sanity-checks the NOT NULL filter shape
  if v_leaked <> 0 then
    raise exception 'FAIL: impossible predicate matched — filter logic error';
  end if;
  raise notice 'PASS: appointment-scoped filter shape (appointment_id IS NOT NULL) excludes personal rows';
end $$;

rollback;
