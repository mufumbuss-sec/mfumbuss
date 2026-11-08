-- Schema ya mfumo wa shule (Supabase/Postgres)
-- Tumia kwenye SQL Editor ya Supabase

create extension if not exists "uuid-ossp";

create type user_role as enum ('headmaster','academic','teacher');
create type user_sex as enum ('M','F');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  full_name text generated always as (trim(coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,''))) stored,
  sex user_sex not null,
  phone text,
  email text,
  role user_role not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.teaching_assignments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_name text not null,
  subject_name text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.teaching_assignments enable row level security;

-- Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can view their own assignments"
  on public.teaching_assignments for select
  using (auth.uid() = teacher_id);

-- Auto-create profile on signup (optional helper)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Insert tupu - itajazwa na admin kupitia service role au insert moja kwa moja
  return new;
end;
$$ language plpgsql security definer;

-- Note: Kwa kuunda watumiaji, tumia Supabase Auth (Admin API/Service role) ili kuunda user
-- kisha weka rekodi kwenye profiles na teaching_assignments.

-- ============================================================
-- Madarasa (Form I - Form VI), mikondo na wanafunzi
-- ============================================================

create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  form text not null check (form in ('Form I','Form II','Form III','Form IV','Form V','Form VI')),
  stream text not null,
  created_at timestamptz not null default now(),
  constraint classes_form_stream_key unique (form, stream)
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  full_name text generated always as (trim(coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,''))) stored,
  sex user_sex not null,
  admission_no text,
  created_at timestamptz not null default now()
);

create unique index if not exists students_admission_no_key
  on public.students (admission_no)
  where admission_no is not null;

create index if not exists students_class_id_idx on public.students (class_id);

alter table public.classes enable row level security;
alter table public.students enable row level security;

create or replace function public.can_manage_classes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('headmaster','academic')
  );
$$;

drop policy if exists "Classes are viewable by authenticated users" on public.classes;
drop policy if exists "Classes can be managed by headmaster and academic" on public.classes;
drop policy if exists "Students are viewable by authenticated users" on public.students;
drop policy if exists "Students can be managed by headmaster and academic" on public.students;

create policy "Classes are viewable by authenticated users"
  on public.classes for select
  using (auth.uid() is not null);

create policy "Classes can be managed by headmaster and academic"
  on public.classes for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "Students are viewable by authenticated users"
  on public.students for select
  using (auth.uid() is not null);

create policy "Students can be managed by headmaster and academic"
  on public.students for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant execute on function public.can_manage_classes() to authenticated;

-- ============================================================
-- Masomo (Subjects)
-- ============================================================

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

create table if not exists public.a_level_settings (
  key text primary key,
  core_subject_count integer not null default 3,
  academic_year text,
  updated_at timestamptz not null default now()
);

insert into public.a_level_settings (key, core_subject_count, academic_year)
values ('default', 3, to_char(now(), 'YYYY'))
on conflict (key) do nothing;

create table if not exists public.a_level_subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null,
  subject_type text not null check (subject_type in ('CORE', 'SUBSIDIARY', 'ADDITIONAL_CORE')),
  subsidiary_rule text,
  has_practical boolean not null default false,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists a_level_subjects_name_key
  on public.a_level_subjects (lower(name));

create unique index if not exists a_level_subjects_code_key
  on public.a_level_subjects (upper(code));

create table if not exists public.a_level_combinations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists a_level_combinations_name_key
  on public.a_level_combinations (lower(name));

create unique index if not exists a_level_combinations_code_key
  on public.a_level_combinations (upper(code));

create table if not exists public.a_level_combination_subjects (
  combination_id uuid not null references public.a_level_combinations(id) on delete cascade,
  subject_id uuid not null references public.a_level_subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (combination_id, subject_id)
);

create table if not exists public.a_level_student_combinations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  combination_id uuid not null references public.a_level_combinations(id) on delete restrict,
  form text not null check (form in ('Form V', 'Form VI')),
  academic_year text not null,
  created_at timestamptz not null default now(),
  constraint a_level_student_combinations_student_year_form_key unique (student_id, form, academic_year)
);

create table if not exists public.a_level_student_subjects (
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.a_level_subjects(id) on delete restrict,
  source text not null default 'COMBINATION' check (source in ('COMBINATION', 'OPTIONAL')),
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);

create index if not exists a_level_student_subjects_source_idx
  on public.a_level_student_subjects (student_id, source);

create table if not exists public.a_level_exam_subjects (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.a_level_subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(exam_id, subject_id)
);

create index if not exists a_level_exam_subjects_exam_id_idx
  on public.a_level_exam_subjects (exam_id);

create table if not exists public.a_level_marks (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.a_level_subjects(id) on delete restrict,
  exam_name text not null,
  academic_year text not null,
  score numeric,
  grade text,
  created_at timestamptz not null default now()
);

create table if not exists public.a_level_combination_transfer_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  previous_combination_id uuid references public.a_level_combinations(id) on delete set null,
  new_combination_id uuid not null references public.a_level_combinations(id) on delete restrict,
  reason text,
  approved boolean not null default false,
  approval_required boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.a_level_settings enable row level security;
alter table public.a_level_subjects enable row level security;
alter table public.a_level_combinations enable row level security;
alter table public.a_level_combination_subjects enable row level security;
alter table public.a_level_student_combinations enable row level security;
alter table public.a_level_student_subjects enable row level security;
alter table public.a_level_exam_subjects enable row level security;
alter table public.a_level_marks enable row level security;
alter table public.a_level_combination_transfer_logs enable row level security;

drop policy if exists "A-level settings are viewable by authenticated users" on public.a_level_settings;
drop policy if exists "A-level settings can be managed by headmaster and academic" on public.a_level_settings;
drop policy if exists "A-level subjects are viewable by authenticated users" on public.a_level_subjects;
drop policy if exists "A-level subjects can be managed by headmaster and academic" on public.a_level_subjects;
drop policy if exists "A-level combinations are viewable by authenticated users" on public.a_level_combinations;
drop policy if exists "A-level combinations can be managed by headmaster and academic" on public.a_level_combinations;
drop policy if exists "A-level combination subjects are viewable by authenticated users" on public.a_level_combination_subjects;
drop policy if exists "A-level combination subjects can be managed by headmaster and academic" on public.a_level_combination_subjects;
drop policy if exists "A-level student combinations are viewable by authenticated users" on public.a_level_student_combinations;
drop policy if exists "A-level student combinations can be managed by headmaster and academic" on public.a_level_student_combinations;
drop policy if exists "A-level student subjects are viewable by authenticated users" on public.a_level_student_subjects;
drop policy if exists "A-level student subjects can be managed by headmaster and academic" on public.a_level_student_subjects;
drop policy if exists "A-level exam subjects are viewable by authenticated users" on public.a_level_exam_subjects;
drop policy if exists "A-level exam subjects can be managed by headmaster and academic" on public.a_level_exam_subjects;
drop policy if exists "A-level marks are viewable by authenticated users" on public.a_level_marks;
drop policy if exists "A-level marks can be managed by headmaster and academic" on public.a_level_marks;
drop policy if exists "A-level transfer logs are viewable by authenticated users" on public.a_level_combination_transfer_logs;
drop policy if exists "A-level transfer logs can be managed by headmaster and academic" on public.a_level_combination_transfer_logs;

create policy "A-level settings are viewable by authenticated users"
  on public.a_level_settings for select
  using (auth.uid() is not null);

create policy "A-level settings can be managed by headmaster and academic"
  on public.a_level_settings for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level subjects are viewable by authenticated users"
  on public.a_level_subjects for select
  using (auth.uid() is not null);

create policy "A-level subjects can be managed by headmaster and academic"
  on public.a_level_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level combinations are viewable by authenticated users"
  on public.a_level_combinations for select
  using (auth.uid() is not null);

create policy "A-level combinations can be managed by headmaster and academic"
  on public.a_level_combinations for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level combination subjects are viewable by authenticated users"
  on public.a_level_combination_subjects for select
  using (auth.uid() is not null);

create policy "A-level combination subjects can be managed by headmaster and academic"
  on public.a_level_combination_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level student combinations are viewable by authenticated users"
  on public.a_level_student_combinations for select
  using (auth.uid() is not null);

create policy "A-level student combinations can be managed by headmaster and academic"
  on public.a_level_student_combinations for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level student subjects are viewable by authenticated users"
  on public.a_level_student_subjects for select
  using (auth.uid() is not null);

create policy "A-level student subjects can be managed by headmaster and academic"
  on public.a_level_student_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level exam subjects are viewable by authenticated users"
  on public.a_level_exam_subjects for select
  using (auth.uid() is not null);

create policy "A-level exam subjects can be managed by headmaster and academic"
  on public.a_level_exam_subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level marks are viewable by authenticated users"
  on public.a_level_marks for select
  using (auth.uid() is not null);

create policy "A-level marks can be managed by headmaster and academic"
  on public.a_level_marks for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "A-level transfer logs are viewable by authenticated users"
  on public.a_level_combination_transfer_logs for select
  using (auth.uid() is not null);

create policy "A-level transfer logs can be managed by headmaster and academic"
  on public.a_level_combination_transfer_logs for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.a_level_settings to authenticated;
grant select, insert, update, delete on public.a_level_subjects to authenticated;
grant select, insert, update, delete on public.a_level_combinations to authenticated;
grant select, insert, update, delete on public.a_level_combination_subjects to authenticated;
grant select, insert, update, delete on public.a_level_student_combinations to authenticated;
grant select, insert, update, delete on public.a_level_student_subjects to authenticated;
grant select, insert, update, delete on public.a_level_exam_subjects to authenticated;
grant select, insert, update, delete on public.a_level_marks to authenticated;
grant select, insert, update, delete on public.a_level_combination_transfer_logs to authenticated;

create or replace function public.sync_a_level_student_subjects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.a_level_student_subjects
    where student_id = old.student_id
      and source = 'COMBINATION'
      and subject_id in (
        select subject_id
        from public.a_level_combination_subjects
        where combination_id = old.combination_id
      );
    return old;
  end if;

  delete from public.a_level_student_subjects
  where student_id = new.student_id
    and source = 'COMBINATION'
    and subject_id in (
      select subject_id
      from public.a_level_combination_subjects
      where combination_id <> new.combination_id
    );

  insert into public.a_level_student_subjects (student_id, subject_id, source)
  select new.student_id, combination_subject.subject_id, 'COMBINATION'
  from public.a_level_combination_subjects combination_subject
  where combination_subject.combination_id = new.combination_id
  on conflict (student_id, subject_id) do update set source = 'COMBINATION';

  return new;
end;
$$;

drop trigger if exists a_level_student_combination_subject_sync on public.a_level_student_combinations;
create trigger a_level_student_combination_subject_sync
after insert or update or delete on public.a_level_student_combinations
for each row
execute function public.sync_a_level_student_subjects();

create or replace function public.resync_a_level_combination_students()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_combination_id uuid;
begin
  if tg_op = 'DELETE' then
    target_combination_id := old.combination_id;
  else
    target_combination_id := new.combination_id;
  end if;

  delete from public.a_level_student_subjects enrollment
  where enrollment.source = 'COMBINATION'
    and enrollment.student_id in (
      select student_id
      from public.a_level_student_combinations
      where combination_id = target_combination_id
    )
    and enrollment.subject_id not in (
      select subject_id
      from public.a_level_combination_subjects
      where combination_id = target_combination_id
    );

  insert into public.a_level_student_subjects (student_id, subject_id, source)
  select student_combination.student_id, combination_subject.subject_id, 'COMBINATION'
  from public.a_level_student_combinations student_combination
  join public.a_level_combination_subjects combination_subject
    on combination_subject.combination_id = student_combination.combination_id
  where student_combination.combination_id = target_combination_id
  on conflict (student_id, subject_id) do update set source = 'COMBINATION';

  return null;
end;
$$;

drop trigger if exists a_level_combination_subject_resync on public.a_level_combination_subjects;
create trigger a_level_combination_subject_resync
after insert or update or delete on public.a_level_combination_subjects
for each row
execute function public.resync_a_level_combination_students();

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

update public.teaching_assignments
set class_name = case upper((regexp_match(class_name, '^Form[[:space:]]+(IV|III|II|I)([[:space:]]|$)', 'i'))[1])
  when 'I' then 'Form I'
  when 'II' then 'Form II'
  when 'III' then 'Form III'
  when 'IV' then 'Form IV'
end
where class_name ~* '^Form[[:space:]]+(IV|III|II|I)([[:space:]]|$)';

delete from public.teaching_assignments older
using public.teaching_assignments newer
where older.teacher_id = newer.teacher_id
  and older.class_name = newer.class_name
  and older.subject_name = newer.subject_name
  and older.ctid < newer.ctid;

create unique index if not exists teaching_assignments_teacher_class_subject_key
  on public.teaching_assignments (teacher_id, class_name, subject_name);

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

-- Auto-generate admission numbers in the database.
create table if not exists public.admission_number_counters (
  year integer primary key,
  last_value integer not null default 0
);

alter table public.admission_number_counters enable row level security;
revoke all on public.admission_number_counters from anon, authenticated;

create or replace function public.next_admission_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  insert into public.admission_number_counters (year, last_value)
  values (p_year, 1)
  on conflict (year) do update
    set last_value = admission_number_counters.last_value + 1
  returning last_value into v_value;

  return 'ADM-' || p_year::text || '-' || lpad(v_value::text, 4, '0');
end;
$$;

revoke all on function public.next_admission_number(integer) from public, anon, authenticated;

create or replace function public.set_student_admission_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.admission_no is null or btrim(new.admission_no) = '' then
    new.admission_no := public.next_admission_number(
      extract(year from coalesce(new.created_at, now()))::integer
    );
  end if;
  return new;
end;
$$;

revoke all on function public.set_student_admission_number() from public, anon, authenticated;

drop trigger if exists set_student_admission_number on public.students;
create trigger set_student_admission_number
before insert or update of admission_no on public.students
for each row execute function public.set_student_admission_number();

insert into public.admission_number_counters (year, last_value)
select
  ((regexp_match(admission_no, '^ADM-([0-9]{4})-([0-9]+)$'))[1])::integer as year,
  max(((regexp_match(admission_no, '^ADM-([0-9]{4})-([0-9]+)$'))[2])::integer) as last_value
from public.students
where admission_no ~ '^ADM-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do update
  set last_value = greatest(admission_number_counters.last_value, excluded.last_value);

update public.students
set admission_no = null
where admission_no is null or btrim(admission_no) = '';
