-- A-Level marks entry
-- 1) Unganisha alama za A-Level na mtihani (exam_id) na uongeze alama za theory/practical
-- 2) Ruhusu walimu kuona/kuandika alama za masomo waliyopangiwa tu

alter table public.a_level_marks
  add column if not exists exam_id uuid references public.exams(id) on delete cascade,
  add column if not exists theory_score numeric(5,2),
  add column if not exists practical_score numeric(5,2),
  add column if not exists total_score numeric(5,2),
  add column if not exists is_absent boolean not null default false,
  add column if not exists entered_by uuid references public.profiles(id),
  add column if not exists entered_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.a_level_marks alter column exam_id set not null;

alter table public.a_level_marks
  drop constraint if exists a_level_marks_exam_student_subject_key;
alter table public.a_level_marks
  add constraint a_level_marks_exam_student_subject_key
  unique (exam_id, student_id, subject_id);

create index if not exists a_level_marks_exam_id_idx
  on public.a_level_marks (exam_id);

alter table public.a_level_marks
  drop constraint if exists a_level_marks_theory_score_range;
alter table public.a_level_marks
  add constraint a_level_marks_theory_score_range
  check (theory_score is null or theory_score between 0 and 100);

alter table public.a_level_marks
  drop constraint if exists a_level_marks_practical_score_range;
alter table public.a_level_marks
  add constraint a_level_marks_practical_score_range
  check (practical_score is null or practical_score between 0 and 50);

-- Mwalimu ni wa somo hili tu ikiwa amepangiwa form na jina la somo linalolingana
create or replace function public.is_assigned_a_level_teacher(
  p_student_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students student
    join public.classes school_class on school_class.id = student.class_id
    join public.a_level_subjects a_subject on a_subject.id = p_subject_id
    join public.teaching_assignments assignment
      on assignment.teacher_id = auth.uid()
     and assignment.class_name = school_class.form
     and lower(trim(assignment.subject_name)) = lower(trim(a_subject.name))
    where student.id = p_student_id
  );
$$;

grant execute on function public.is_assigned_a_level_teacher(uuid, uuid) to authenticated;

alter table public.a_level_marks enable row level security;

drop policy if exists "A-level marks are viewable by authenticated users" on public.a_level_marks;
drop policy if exists "A-level marks can be managed by headmaster and academic" on public.a_level_marks;
drop policy if exists "A-level marks can be read by managers and assigned teachers" on public.a_level_marks;
drop policy if exists "A-level marks can be written by managers and assigned teachers" on public.a_level_marks;

create policy "A-level marks can be read by managers and assigned teachers"
  on public.a_level_marks for select
  using (
    public.can_manage_classes()
    or public.is_assigned_a_level_teacher(student_id, subject_id)
  );

create policy "A-level marks can be written by managers and assigned teachers"
  on public.a_level_marks for all
  using (
    public.can_manage_classes()
    or public.is_assigned_a_level_teacher(student_id, subject_id)
  )
  with check (
    public.can_manage_classes()
    or public.is_assigned_a_level_teacher(student_id, subject_id)
  );

grant select, insert, update, delete on public.a_level_marks to authenticated;
