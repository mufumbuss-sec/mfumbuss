-- A-Level examinations
-- 1) Allow Form V and Form VI in exam creation
-- 2) Attach A-Level subjects (a_level_subjects) to examinations

alter table public.exams
  drop constraint if exists exams_class_form_check,
  add constraint exams_class_form_check
  check (class_form in ('Form I','Form II','Form III','Form IV','Form V','Form VI'));

create table if not exists public.a_level_exam_subjects (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.a_level_subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(exam_id, subject_id)
);

create index if not exists a_level_exam_subjects_exam_id_idx
  on public.a_level_exam_subjects (exam_id);

alter table public.a_level_exam_subjects enable row level security;

drop policy if exists "A-level exam subjects are viewable by authenticated users" on public.a_level_exam_subjects;
drop policy if exists "A-level exam subjects can be managed by headmaster and academic" on public.a_level_exam_subjects;

create policy "A-level exam subjects are viewable by authenticated users"
  on public.a_level_exam_subjects for select
  using (auth.uid() is not null);

create policy "A-level exam subjects can be managed by headmaster and academic"
  on public.a_level_exam_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.a_level_exam_subjects to authenticated;
