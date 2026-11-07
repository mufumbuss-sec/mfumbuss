-- Security and data-integrity hardening
-- Apply after schema.sql, exam-management.sql, and the related feature migrations.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.teacher_has_form(target_form text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teaching_assignments
    where teacher_id = auth.uid()
      and class_name = target_form
  );
$$;

create or replace function public.teacher_has_exam_form(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exams e
    join public.teaching_assignments ta
      on ta.class_name = e.class_form
    where e.id = target_exam_id
      and ta.teacher_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_view_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    join public.teaching_assignments ta on ta.class_name = c.form
    where s.id = target_student_id
      and ta.teacher_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_access_mark(
  target_exam_id uuid,
  target_student_id uuid,
  target_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exams e
    join public.students s on s.id = target_student_id
    join public.classes c on c.id = s.class_id
    join public.subjects sub on sub.id = target_subject_id
    join public.teaching_assignments ta
      on ta.teacher_id = auth.uid()
      and ta.class_name = c.form
      and ta.subject_name = sub.name
    where e.id = target_exam_id
      and e.class_form = c.form
  );
$$;

create or replace function public.teacher_can_edit_mark(
  target_exam_id uuid,
  target_student_id uuid,
  target_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exams e
    where e.id = target_exam_id
      and e.status = 'Active'
  )
  and public.teacher_can_access_mark(
    target_exam_id,
    target_student_id,
    target_subject_id
  );
$$;

revoke all on function public.teacher_has_form(text) from public, anon;
revoke all on function public.teacher_has_exam_form(uuid) from public, anon;
revoke all on function public.teacher_can_view_student(uuid) from public, anon;
revoke all on function public.teacher_can_access_mark(uuid, uuid, uuid) from public, anon;
revoke all on function public.teacher_can_edit_mark(uuid, uuid, uuid) from public, anon;
grant execute on function public.teacher_has_form(text) to authenticated;
grant execute on function public.teacher_has_exam_form(uuid) to authenticated;
grant execute on function public.teacher_can_view_student(uuid) to authenticated;
grant execute on function public.teacher_can_access_mark(uuid, uuid, uuid) to authenticated;
grant execute on function public.teacher_can_edit_mark(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Role-scoped row level security
-- ---------------------------------------------------------------------------

drop policy if exists "Students are viewable by authenticated users" on public.students;
drop policy if exists "Students are viewable by admins or assigned teachers" on public.students;
create policy "Students are viewable by admins or assigned teachers"
on public.students
for select
using (
  public.can_manage_classes()
  or public.teacher_can_view_student(id)
);

drop policy if exists "Marks viewable by authenticated" on public.marks;
drop policy if exists "Marks viewable by admins or assigned teachers" on public.marks;
create policy "Marks viewable by admins or assigned teachers"
on public.marks
for select
using (
  public.can_manage_classes()
  or public.teacher_can_access_mark(exam_id, student_id, subject_id)
);

drop policy if exists "Marks editable by teachers for their assignments or academic" on public.marks;
drop policy if exists "Marks insertable by admins or assigned teachers" on public.marks;
create policy "Marks insertable by admins or assigned teachers"
on public.marks
for insert
with check (
  public.can_manage_classes()
  or public.teacher_can_edit_mark(exam_id, student_id, subject_id)
);

drop policy if exists "Marks updatable by teachers for their assignments or academic" on public.marks;
drop policy if exists "Marks updatable by admins or assigned teachers" on public.marks;
create policy "Marks updatable by admins or assigned teachers"
on public.marks
for update
using (
  public.can_manage_classes()
  or public.teacher_can_edit_mark(exam_id, student_id, subject_id)
)
with check (
  public.can_manage_classes()
  or public.teacher_can_edit_mark(exam_id, student_id, subject_id)
);

drop policy if exists "Exam results viewable by authenticated" on public.exam_results;
drop policy if exists "Exam results viewable by admins or assigned teachers" on public.exam_results;
create policy "Exam results viewable by admins or assigned teachers"
on public.exam_results
for select
using (
  public.can_manage_classes()
  or public.teacher_has_exam_form(exam_id)
);

drop policy if exists "Exams viewable by authenticated" on public.exams;
drop policy if exists "Exams viewable by admins or assigned teachers" on public.exams;
create policy "Exams viewable by admins or assigned teachers"
on public.exams
for select
using (
  public.can_manage_classes()
  or (
    status in ('Active'::public.exam_status, 'Processed'::public.exam_status)
    and public.teacher_has_form(class_form)
  )
);

-- ---------------------------------------------------------------------------
-- Protect historical records from cascading deletes
-- ---------------------------------------------------------------------------

alter table public.students
  drop constraint if exists students_class_id_fkey,
  add constraint students_class_id_fkey
    foreign key (class_id) references public.classes(id) on delete restrict;

alter table public.marks
  drop constraint if exists marks_student_id_fkey,
  add constraint marks_student_id_fkey
    foreign key (student_id) references public.students(id) on delete restrict;

alter table public.marks
  drop constraint if exists marks_subject_id_fkey,
  add constraint marks_subject_id_fkey
    foreign key (subject_id) references public.subjects(id) on delete restrict;

alter table public.exam_results
  drop constraint if exists exam_results_student_id_fkey,
  add constraint exam_results_student_id_fkey
    foreign key (student_id) references public.students(id) on delete restrict;

alter table public.exam_subjects
  drop constraint if exists exam_subjects_subject_id_fkey,
  add constraint exam_subjects_subject_id_fkey
    foreign key (subject_id) references public.subjects(id) on delete restrict;

alter table public.class_subject_assignments
  drop constraint if exists class_subject_assignments_subject_id_fkey,
  add constraint class_subject_assignments_subject_id_fkey
    foreign key (subject_id) references public.subjects(id) on delete restrict;

alter table public.student_subjects
  drop constraint if exists student_subjects_subject_id_fkey,
  add constraint student_subjects_subject_id_fkey
    foreign key (subject_id) references public.subjects(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Academic year range
-- ---------------------------------------------------------------------------

alter table public.academic_period_settings
  drop constraint if exists academic_period_settings_year_range,
  add constraint academic_period_settings_year_range
    check (
      academic_year ~ '^[0-9]{4}$'
      and academic_year::integer between 2000 and 2100
    );

-- ---------------------------------------------------------------------------
-- Query indexes
-- ---------------------------------------------------------------------------

create index if not exists teaching_assignments_teacher_lookup_idx
  on public.teaching_assignments (teacher_id, class_name, subject_name);

create index if not exists students_class_id_idx
  on public.students (class_id);

create index if not exists marks_exam_id_idx
  on public.marks (exam_id);

create index if not exists marks_student_id_idx
  on public.marks (student_id);

create index if not exists exam_results_exam_id_idx
  on public.exam_results (exam_id);

create index if not exists exam_results_student_id_idx
  on public.exam_results (student_id);

create index if not exists exam_subjects_exam_id_idx
  on public.exam_subjects (exam_id);

create index if not exists class_subject_assignments_form_idx
  on public.class_subject_assignments (form, subject_id);

create index if not exists student_subjects_student_id_idx
  on public.student_subjects (student_id, subject_id);

-- ---------------------------------------------------------------------------
-- Atomic result processing
-- ---------------------------------------------------------------------------

create or replace function public.finalize_exam_results(
  p_exam_id uuid,
  p_user_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.exam_status;
  v_count integer := 0;
  v_incomplete integer := 0;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'Result payload must be a JSON array.';
  end if;

  select status into v_status
  from public.exams
  where id = p_exam_id
  for update;

  if v_status is null then
    raise exception 'Examination not found.';
  end if;
  if v_status <> 'Active' then
    raise exception 'Only active examinations can be processed.';
  end if;

  delete from public.exam_results where exam_id = p_exam_id;

  insert into public.exam_results (
    exam_id,
    student_id,
    total_marks,
    average,
    grade,
    division,
    points,
    position,
    is_incomplete,
    subject_breakdown,
    computed_at
  )
  select
    p_exam_id,
    (row_data ->> 'student_id')::uuid,
    (row_data ->> 'total_marks')::numeric,
    (row_data ->> 'average')::numeric,
    row_data ->> 'grade',
    row_data ->> 'division',
    (row_data ->> 'points')::integer,
    (row_data ->> 'position')::integer,
    coalesce((row_data ->> 'is_incomplete')::boolean, false),
    row_data -> 'subject_breakdown',
    coalesce((row_data ->> 'computed_at')::timestamptz, now())
  from jsonb_array_elements(p_results) as result_row(row_data);

  get diagnostics v_count = row_count;

  select count(*) into v_incomplete
  from public.exam_results
  where exam_id = p_exam_id
    and (
      is_incomplete = true
      or division = 'INC'
      or division = 'Incomplete'
      or division = 'ABS'
    );

  update public.exams
  set
    status = 'Processed',
    processed_at = now(),
    processed_by = p_user_id,
    updated_at = now()
  where id = p_exam_id;

  insert into public.exam_audit_logs (exam_id, user_id, action, details)
  values (
    p_exam_id,
    p_user_id,
    'processed',
    jsonb_build_object(
      'results_count', v_count,
      'incomplete_count', v_incomplete
    )
  );

  return jsonb_build_object(
    'results_count', v_count,
    'incomplete_count', v_incomplete
  );
end;
$$;

create or replace function public.reopen_exam_results(
  p_exam_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.exam_status;
  v_count integer := 0;
begin
  select status into v_status
  from public.exams
  where id = p_exam_id
  for update;

  if v_status is null then
    raise exception 'Examination not found.';
  end if;
  if v_status <> 'Processed' then
    raise exception 'Only processed examinations can be reopened.';
  end if;

  delete from public.exam_results where exam_id = p_exam_id;
  get diagnostics v_count = row_count;

  update public.exams
  set
    status = 'Active',
    processed_at = null,
    processed_by = null,
    updated_at = now()
  where id = p_exam_id;

  insert into public.exam_audit_logs (exam_id, user_id, action, details)
  values (
    p_exam_id,
    p_user_id,
    'reopened',
    jsonb_build_object('results_removed', v_count)
  );

  return jsonb_build_object('results_removed', v_count);
end;
$$;

revoke all on function public.finalize_exam_results(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.reopen_exam_results(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_exam_results(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.reopen_exam_results(uuid, uuid)
  to service_role;
