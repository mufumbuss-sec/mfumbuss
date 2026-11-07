-- Auto-generate student admission numbers.
-- Format: ADM-<year>-<zero-padded sequence>, e.g. ADM-2026-0001.
-- The number is stored in students.admission_no but is not shown in the UI.

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

-- Continue numbering from any existing ADM-YYYY-NNNN values.
insert into public.admission_number_counters (year, last_value)
select
  ((regexp_match(admission_no, '^ADM-([0-9]{4})-([0-9]+)$'))[1])::integer as year,
  max(((regexp_match(admission_no, '^ADM-([0-9]{4})-([0-9]+)$'))[2])::integer) as last_value
from public.students
where admission_no ~ '^ADM-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do update
  set last_value = greatest(admission_number_counters.last_value, excluded.last_value);

-- Fill any legacy rows that have no admission number.
update public.students
set admission_no = null
where admission_no is null or btrim(admission_no) = '';
