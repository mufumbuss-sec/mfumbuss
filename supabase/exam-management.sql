-- Exam Management Schema for Tanzanian NECTA-style results
do $$
begin
  if not exists (
    select 1
    from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typname = 'exam_status'
  ) then
    create type public.exam_status as enum ('Draft', 'Active', 'Processed');
  end if;
end
$$;

create table if not exists public.exam_settings (
  id uuid primary key default uuid_generate_v4(),
  school_name text not null default 'MUFUMBU SECONDARY SCHOOL',
  school_logo_url text,
  grading_scale jsonb not null default '{"A":{"min":75,"max":100},"B":{"min":65,"max":74},"C":{"min":45,"max":64},"D":{"min":30,"max":44},"F":{"min":0,"max":29}}'::jsonb,
  grade_points jsonb not null default '{"A":1,"B":2,"C":3,"D":4,"F":5}'::jsonb,
  division_rules jsonb not null default '{"best_subjects":7,"divisions":[{"name":"DIV I","min":7,"max":17},{"name":"DIV II","min":18,"max":21},{"name":"DIV III","min":22,"max":25},{"name":"DIV IV","min":26,"max":33},{"name":"DIV 0","min":34,"max":35}]}'::jsonb,
  remarks_by_gpa jsonb not null default '{"excellent":{"min":1.0,"max":1.5,"remark":"Excellent"},"very_good":{"min":1.6,"max":2.0,"remark":"Very Good"},"good":{"min":2.1,"max":2.5,"remark":"Good"},"satisfactory":{"min":2.6,"max":3.0,"remark":"Satisfactory"},"weak":{"min":3.1,"max":3.5,"remark":"Weak"},"poor":{"min":3.6,"max":5.0,"remark":"Poor"}}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.exam_settings (school_name)
select 'MUFUMBU SECONDARY SCHOOL'
where not exists (select 1 from public.exam_settings);

create table if not exists public.academic_period_settings (
  id integer primary key default 1 check (id = 1),
  academic_year text not null check (academic_year ~ '^[0-9]{4}$'),
  term text not null check (term in ('Term I', 'Term II')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.academic_period_settings (id, academic_year, term)
values (1, '2026', 'Term I')
on conflict (id) do update
set academic_year = '2026',
    term = 'Term I',
    updated_at = now()
where public.academic_period_settings.academic_year::integer not between 2026 and 2030;

alter table public.academic_period_settings
  drop constraint if exists academic_period_settings_year_range;
alter table public.academic_period_settings
  add constraint academic_period_settings_year_range
  check (academic_year::integer between 2026 and 2030);

alter table public.academic_period_settings enable row level security;
drop policy if exists "Academic period viewable by authenticated" on public.academic_period_settings;
drop policy if exists "Academic period manageable by academic/headmaster" on public.academic_period_settings;
create policy "Academic period viewable by authenticated"
  on public.academic_period_settings for select using (auth.uid() is not null);
create policy "Academic period manageable by academic/headmaster"
  on public.academic_period_settings for all using (public.can_manage_classes());
grant select, insert, update on public.academic_period_settings to authenticated;

create table if not exists public.exams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  class_form text not null check (class_form in ('Form I','Form II','Form III','Form IV','Form V','Form VI')),
  term text not null,
  academic_year text not null,
  start_date date not null,
  end_date date not null,
  status exam_status not null default 'Draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  published boolean default false
);

alter table public.exams
  add column if not exists has_practical boolean not null default false;

create or replace function public.enforce_exam_academic_period()
returns trigger
language plpgsql
as $$
declare
  active_year text;
  active_term text;
begin
  select academic_year, term
    into active_year, active_term
    from public.academic_period_settings
    where id = 1;

  if not found then
    raise exception 'Set the active academic year and term before creating an examination';
  end if;

  if new.academic_year <> active_year or new.term <> active_term then
    raise exception 'Examination year and term must match the active academic period (% / %)', active_year, active_term;
  end if;

  return new;
end;
$$;

drop trigger if exists exams_require_active_academic_period on public.exams;
create trigger exams_require_active_academic_period
  before insert or update of academic_year, term on public.exams
  for each row execute function public.enforce_exam_academic_period();

create table if not exists public.exam_subjects (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz default now(),
  unique(exam_id, subject_id)
);

create table if not exists public.marks (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  theory_score numeric(5,2),
  practical_score numeric(5,2),
  total_score numeric(5,2),
  is_absent boolean default false,
  entered_by uuid references public.profiles(id),
  entered_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(exam_id, student_id, subject_id)
);

alter table public.marks
  drop constraint if exists marks_theory_score_range;
alter table public.marks
  add constraint marks_theory_score_range
  check (theory_score is null or theory_score between 0 and 100) not valid;
alter table public.marks
  drop constraint if exists marks_practical_score_range;
alter table public.marks
  add constraint marks_practical_score_range
  check (practical_score is null or practical_score between 0 and 50) not valid;

create table if not exists public.exam_results (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  total_marks numeric(8,2),
  average numeric(5,2),
  grade text,
  division text,
  points integer,
  position integer,
  is_incomplete boolean default false,
  subject_breakdown jsonb,
  computed_at timestamptz default now(),
  unique(exam_id, student_id)
);

create table if not exists public.exam_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid references public.exams(id),
  user_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.exam_settings enable row level security;
alter table public.exams enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.marks enable row level security;
alter table public.exam_results enable row level security;
alter table public.exam_audit_logs enable row level security;

-- Policies
drop policy if exists "Exam settings viewable by authenticated" on public.exam_settings;
drop policy if exists "Exam settings manageable by academic/headmaster" on public.exam_settings;
create policy "Exam settings viewable by authenticated" on public.exam_settings for select using (auth.uid() is not null);
create policy "Exam settings manageable by academic/headmaster" on public.exam_settings for all using (public.can_manage_classes());

drop policy if exists "Exams viewable by authenticated" on public.exams;
drop policy if exists "Exams manageable by academic/headmaster" on public.exams;
create policy "Exams viewable by authenticated" on public.exams for select using (auth.uid() is not null);
create policy "Exams manageable by academic/headmaster" on public.exams for all using (public.can_manage_classes());

drop policy if exists "Exam subjects viewable by authenticated" on public.exam_subjects;
drop policy if exists "Exam subjects manageable by academic/headmaster" on public.exam_subjects;
create policy "Exam subjects viewable by authenticated" on public.exam_subjects for select using (auth.uid() is not null);
create policy "Exam subjects manageable by academic/headmaster" on public.exam_subjects for all using (public.can_manage_classes());

drop policy if exists "Marks viewable by authenticated" on public.marks;
create policy "Marks viewable by authenticated" on public.marks for select using (auth.uid() is not null);

drop policy if exists "Marks editable by teachers for their assignments or academic" on public.marks;
create policy "Marks editable by teachers for their assignments or academic" on public.marks for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('headmaster','academic')) OR
  exists (
    select 1 from public.teaching_assignments ta
    join public.students s on s.id = student_id
    join public.exams e on e.id = exam_id
    where ta.teacher_id = auth.uid()
      and ta.class_name = e.class_form
      and ta.subject_name = (select name from public.subjects where id = subject_id)
  )
);

drop policy if exists "Marks updatable by teachers for their assignments or academic" on public.marks;
create policy "Marks updatable by teachers for their assignments or academic" on public.marks for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('headmaster','academic')) OR
  exists (
    select 1 from public.teaching_assignments ta
    join public.students s on s.id = marks.student_id
    join public.exams e on e.id = marks.exam_id
    where ta.teacher_id = auth.uid()
      and ta.class_name = e.class_form
      and ta.subject_name = (select name from public.subjects where id = marks.subject_id)
  )
);

drop policy if exists "Exam results viewable by authenticated" on public.exam_results;
drop policy if exists "Exam results manageable by academic/headmaster" on public.exam_results;
create policy "Exam results viewable by authenticated" on public.exam_results for select using (auth.uid() is not null);
create policy "Exam results manageable by academic/headmaster" on public.exam_results for all using (public.can_manage_classes());

drop policy if exists "Audit logs viewable by academic/headmaster" on public.exam_audit_logs;
drop policy if exists "Audit logs insertable by authenticated" on public.exam_audit_logs;
create policy "Audit logs viewable by academic/headmaster" on public.exam_audit_logs for select using (public.can_manage_classes());
create policy "Audit logs insertable by authenticated" on public.exam_audit_logs for insert with check (auth.uid() is not null);

grant select, insert, update, delete on public.exam_settings to authenticated;
grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_subjects to authenticated;
grant select, insert, update, delete on public.marks to authenticated;
grant select, insert, update, delete on public.exam_results to authenticated;
grant select, insert on public.exam_audit_logs to authenticated;
