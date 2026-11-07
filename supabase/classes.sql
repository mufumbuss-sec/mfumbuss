-- Migration: Madarasa (Form I - Form IV), mikondo na wanafunzi
-- Endesha hii kwenye SQL Editor ya Supabase au kwa scripts/run-sql.ps1

create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  form text not null check (form in ('Form I','Form II','Form III','Form IV')),
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
