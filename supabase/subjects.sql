-- Migration: Masomo (Subjects)
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  subject_code text,
  has_practical boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.subjects
  add column if not exists subject_code text;

update public.subjects
set subject_code =
  upper(coalesce(nullif(left(regexp_replace(name, '[^A-Za-z0-9]+', '', 'g'), 8), ''), 'SUB'))
  || '-' || upper(left(replace(id::text, '-', ''), 6))
where subject_code is null or btrim(subject_code) = '';

alter table public.subjects
  alter column subject_code set not null;

create unique index if not exists subjects_subject_code_key
  on public.subjects (upper(subject_code));

alter table public.subjects enable row level security;

drop policy if exists "Subjects are viewable by authenticated users" on public.subjects;
drop policy if exists "Subjects can be managed by headmaster and academic" on public.subjects;

create policy "Subjects are viewable by authenticated users"
  on public.subjects for select
  using (auth.uid() is not null);

create policy "Subjects can be managed by headmaster and academic"
  on public.subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.subjects to authenticated;
