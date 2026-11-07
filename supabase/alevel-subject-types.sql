-- Migration: Msingi wa A-Level (Kidato cha Tano na Sita)
-- 1) Aina tatu za masomo: CORE, SUBSIDIARY, ADDITIONAL_CORE
-- 2) Alama ya has_practical kwa masomo ya A-Level
-- 3) Kuruhusu madarasa ya Form V na Form VI
-- 4) Kutofautisha masomo ya combination na masomo ya optional kwa mwanafunzi
-- 5) Kusawazisha masomo ya mwanafunzi combination inapobadilika

-- 1. Aina za masomo
alter table public.a_level_subjects
  drop constraint if exists a_level_subjects_subject_type_check;

alter table public.a_level_subjects
  add constraint a_level_subjects_subject_type_check
  check (subject_type in ('CORE', 'SUBSIDIARY', 'ADDITIONAL_CORE'));

-- 2. Masomo yenye practical
alter table public.a_level_subjects
  add column if not exists has_practical boolean not null default false;

-- 3. Madarasa ya Form V na Form VI
alter table public.classes
  drop constraint if exists classes_form_check;

alter table public.classes
  add constraint classes_form_check
  check (form in ('Form I', 'Form II', 'Form III', 'Form IV', 'Form V', 'Form VI'));

-- 4. Chanzo cha somo kwa mwanafunzi: combination au optional
alter table public.a_level_student_subjects
  add column if not exists source text not null default 'COMBINATION';

alter table public.a_level_student_subjects
  drop constraint if exists a_level_student_subjects_source_check;

alter table public.a_level_student_subjects
  add constraint a_level_student_subjects_source_check
  check (source in ('COMBINATION', 'OPTIONAL'));

create index if not exists a_level_student_subjects_source_idx
  on public.a_level_student_subjects (student_id, source);

-- 5. Trigger: mabadiliko ya combination ya mwanafunzi yasiguse masomo ya optional
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

-- 6. Trigger: masomo ya combination yanapobadilika, wanafunzi wake wasawazishwe
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
