-- Run this migration in the Supabase SQL Editor.

alter table public.school_settings
  add column if not exists headmaster_signature_url text,
  add column if not exists academic_signature_url text,
  add column if not exists class_teacher_signature_url text,
  add column if not exists school_stamp_url text,
  add column if not exists signature_layout jsonb;

comment on column public.school_settings.headmaster_signature_url is
  'Public URL for the headmaster signature shown on report cards.';
comment on column public.school_settings.academic_signature_url is
  'Public URL for the academic teacher signature shown on report cards.';
comment on column public.school_settings.class_teacher_signature_url is
  'Public URL for the class teacher signature shown on report cards.';
comment on column public.school_settings.school_stamp_url is
  'Public URL for the school stamp shown near the headmaster signature.';
comment on column public.school_settings.signature_layout is
  'Normalized report-card signature positions: x, y, width, height percentages.';
