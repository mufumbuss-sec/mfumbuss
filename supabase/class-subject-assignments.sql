-- Assign subjects to a form, not to an individual stream.
create table if not exists public.class_subject_assignments (
  id uuid primary key default uuid_generate_v4(),
  form text not null check (form in ('Form I', 'Form II', 'Form III', 'Form IV')),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  is_compulsory boolean not null default false,
  created_at timestamptz not null default now(),
  constraint class_subject_assignments_form_subject_key unique (form, subject_id)
);

alter table public.class_subject_assignments
  add column if not exists is_compulsory boolean not null default false;

alter table public.class_subject_assignments enable row level security;

drop policy if exists "Class subject assignments are viewable by authenticated users"
  on public.class_subject_assignments;
drop policy if exists "Class subject assignments can be managed by headmaster and academic"
  on public.class_subject_assignments;

create policy "Class subject assignments are viewable by authenticated users"
  on public.class_subject_assignments for select
  using (auth.uid() is not null);

create policy "Class subject assignments can be managed by headmaster and academic"
  on public.class_subject_assignments for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.class_subject_assignments to authenticated;

create table if not exists public.student_subjects (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  enrollment_type text not null check (enrollment_type in ('compulsory', 'optional')),
  created_at timestamptz not null default now(),
  constraint student_subjects_student_subject_key unique (student_id, subject_id)
);

alter table public.student_subjects enable row level security;

drop policy if exists "Student subject enrollments are viewable by authenticated users"
  on public.student_subjects;
drop policy if exists "Student subject enrollments can be managed by headmaster and academic"
  on public.student_subjects;

create policy "Student subject enrollments are viewable by authenticated users"
  on public.student_subjects for select
  using (auth.uid() is not null);

create policy "Student subject enrollments can be managed by headmaster and academic"
  on public.student_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.student_subjects to authenticated;

create or replace function public.sync_compulsory_subject_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_compulsory then
      delete from public.student_subjects enrollment
      using public.students student, public.classes school_class
      where enrollment.student_id = student.id
        and student.class_id = school_class.id
        and school_class.form = old.form
        and enrollment.subject_id = old.subject_id
        and enrollment.enrollment_type = 'compulsory';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.is_compulsory then
    delete from public.student_subjects enrollment
    using public.students student, public.classes school_class
    where enrollment.student_id = student.id
      and student.class_id = school_class.id
      and school_class.form = old.form
      and enrollment.subject_id = old.subject_id
      and enrollment.enrollment_type = 'compulsory';
  end if;

  if new.is_compulsory then
    insert into public.student_subjects (student_id, subject_id, enrollment_type)
    select student.id, new.subject_id, 'compulsory'
    from public.students student
    join public.classes school_class on school_class.id = student.class_id
    where school_class.form = new.form
    on conflict (student_id, subject_id)
    do update set enrollment_type = 'compulsory';
  end if;

  return new;
end;
$$;

drop trigger if exists class_subject_assignment_enrollment_sync
  on public.class_subject_assignments;
create trigger class_subject_assignment_enrollment_sync
after insert or update or delete on public.class_subject_assignments
for each row execute function public.sync_compulsory_subject_enrollments();

create or replace function public.sync_student_compulsory_subjects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_form text;
begin
  select school_class.form into student_form
  from public.classes school_class
  where school_class.id = new.class_id;

  if tg_op = 'UPDATE' then
    delete from public.student_subjects enrollment
    where enrollment.student_id = new.id
      and enrollment.enrollment_type = 'compulsory'
      and not exists (
        select 1
        from public.class_subject_assignments assignment
        where assignment.form = student_form
          and assignment.subject_id = enrollment.subject_id
          and assignment.is_compulsory
      );
  end if;

  insert into public.student_subjects (student_id, subject_id, enrollment_type)
  select new.id, assignment.subject_id, 'compulsory'
  from public.class_subject_assignments assignment
  where assignment.form = student_form
    and assignment.is_compulsory
  on conflict (student_id, subject_id)
  do update set enrollment_type = 'compulsory';

  return new;
end;
$$;

drop trigger if exists student_compulsory_subject_sync on public.students;
drop trigger if exists student_compulsory_subject_insert_sync on public.students;
drop trigger if exists student_compulsory_subject_class_update_sync on public.students;
create trigger student_compulsory_subject_insert_sync
after insert on public.students
for each row execute function public.sync_student_compulsory_subjects();
create trigger student_compulsory_subject_class_update_sync
after update of class_id on public.students
for each row execute function public.sync_student_compulsory_subjects();

insert into public.student_subjects (student_id, subject_id, enrollment_type)
select student.id, assignment.subject_id, 'compulsory'
from public.students student
join public.classes school_class on school_class.id = student.class_id
join public.class_subject_assignments assignment
  on assignment.form = school_class.form
 and assignment.is_compulsory
on conflict (student_id, subject_id)
do update set enrollment_type = 'compulsory';

-- Normalize existing teacher assignments such as "Form I A" to "Form I".
update public.teaching_assignments
set class_name = case upper((regexp_match(class_name, '^Form[[:space:]]+(IV|III|II|I)([[:space:]]|$)', 'i'))[1])
  when 'I' then 'Form I'
  when 'II' then 'Form II'
  when 'III' then 'Form III'
  when 'IV' then 'Form IV'
end
where class_name ~* '^Form[[:space:]]+(IV|III|II|I)([[:space:]]|$)';

update public.teaching_assignments
set class_name = case (regexp_match(class_name, '^Form[[:space:]]+([1-4])([[:space:]]|$)', 'i'))[1]
  when '1' then 'Form I'
  when '2' then 'Form II'
  when '3' then 'Form III'
  when '4' then 'Form IV'
end
where class_name ~* '^Form[[:space:]]+[1-4]([[:space:]]|$)';

delete from public.teaching_assignments older
using public.teaching_assignments newer
where older.teacher_id = newer.teacher_id
  and older.class_name = newer.class_name
  and older.subject_name = newer.subject_name
  and older.ctid < newer.ctid;

create unique index if not exists teaching_assignments_teacher_class_subject_key
  on public.teaching_assignments (teacher_id, class_name, subject_name);
