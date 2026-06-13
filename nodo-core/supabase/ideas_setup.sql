-- Ideas (brainstorming backlog) setup.
-- Run this in the Supabase SQL Editor.
--
-- Access model: shared team resource — every authenticated member can read and
-- write all ideas (to authenticated using (true)), same model as expenses/clients.

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- desarrollo | marketing | negocio | operaciones | otro
  area text not null default 'desarrollo',
  -- nueva | debate | aprobada | descartada
  status text not null default 'nueva',
  created_by uuid references public.profiles (id) on delete set null,
  -- set when the idea is promoted into the tasks board
  promoted_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ideas_status_idx on public.ideas (status);
create index if not exists ideas_area_idx on public.ideas (area);

alter table public.ideas enable row level security;

create policy "ideas_select" on public.ideas
  for select to authenticated using (true);
create policy "ideas_insert" on public.ideas
  for insert to authenticated with check (true);
create policy "ideas_update" on public.ideas
  for update to authenticated using (true) with check (true);
create policy "ideas_delete" on public.ideas
  for delete to authenticated using (true);
