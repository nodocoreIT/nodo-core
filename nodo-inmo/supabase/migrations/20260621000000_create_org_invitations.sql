-- Table: shared.org_invitations
create table shared.org_invitations (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references shared.organizations(id) on delete cascade,
  invitee_email       text        not null,
  invitee_user_id     uuid        references auth.users(id) on delete set null,
  invited_by_user_id  uuid        not null references auth.users(id) on delete cascade,
  role                text        not null check (role in ('admin','agent','owner','tenant')),
  status              text        not null default 'pending' check (status in ('pending','accepted','rejected','expired')),
  token               uuid        not null unique default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  accepted_at         timestamptz
);

-- Indexes
create index org_invitations_org_idx     on shared.org_invitations (org_id);
create index org_invitations_invitee_idx on shared.org_invitations (invitee_user_id);
create index org_invitations_email_idx   on shared.org_invitations (invitee_email);
create unique index org_invitations_pending_unique
  on shared.org_invitations (org_id, invitee_email)
  where status = 'pending';

-- RLS
alter table shared.org_invitations enable row level security;

grant select, insert, update, delete on shared.org_invitations to authenticated;

-- Org admins: full access to their org's invitations (org-scoped)
create policy "invitations_admin_all" on shared.org_invitations
  for all to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- Invitees: read their own invitations (NO org scope — they may not have org_id yet)
create policy "invitations_invitee_read" on shared.org_invitations
  for select to authenticated
  using (invitee_user_id = (select auth.uid()));

-- Invitees: update their own invitations (accept/reject)
create policy "invitations_invitee_update" on shared.org_invitations
  for update to authenticated
  using (invitee_user_id = (select auth.uid()))
  with check (invitee_user_id = (select auth.uid()));
