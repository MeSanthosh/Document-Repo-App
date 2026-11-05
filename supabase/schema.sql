-- Project Document Register: database + file storage setup.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

-- ---------- tables ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  description text not null default '',
  folders     text[] not null default array['Requirements','Design','Development','Testing','Release','Meetings'],
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete restrict,
  folder         text not null,
  code           text not null unique,
  title          text not null,
  note           text not null default '',
  kind           text not null check (kind in ('file','link')),
  storage_path   text,
  url            text,
  file_name      text,
  content_type   text,
  size_bytes     bigint,
  added_by       uuid default auth.uid(),
  added_by_email text default (auth.jwt() ->> 'email'),
  added_at       timestamptz not null default now()
);

create index if not exists documents_project_idx on public.documents(project_id);

-- ---------- access: only signed-in users (people you add in Supabase) ----------
alter table public.projects  enable row level security;
alter table public.documents enable row level security;

drop policy if exists "signed-in read projects"   on public.projects;
drop policy if exists "signed-in write projects"  on public.projects;
drop policy if exists "signed-in read documents"  on public.documents;
drop policy if exists "signed-in write documents" on public.documents;

create policy "signed-in read projects"   on public.projects  for select to authenticated using (true);
create policy "signed-in write projects"  on public.projects  for all    to authenticated using (true) with check (true);
create policy "signed-in read documents"  on public.documents for select to authenticated using (true);
create policy "signed-in write documents" on public.documents for all    to authenticated using (true) with check (true);

-- ---------- file storage: a private bucket ----------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "signed-in read files"   on storage.objects;
drop policy if exists "signed-in upload files" on storage.objects;
drop policy if exists "signed-in delete files" on storage.objects;

create policy "signed-in read files"   on storage.objects for select to authenticated using (bucket_id = 'documents');
create policy "signed-in upload files" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
create policy "signed-in delete files" on storage.objects for delete to authenticated using (bucket_id = 'documents');
