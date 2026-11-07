-- Run this migration in the Supabase SQL Editor.

create table if not exists public.school_settings (
  id smallint primary key default 1 check (id = 1),
  school_name text not null default 'Mufumbu Secondary School',
  district text not null default '',
  region text not null default '',
  address text not null default '',
  school_logo_url text,
  union_logo_url text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.school_settings enable row level security;

drop policy if exists "School settings viewable by authenticated users"
  on public.school_settings;
create policy "School settings viewable by authenticated users"
  on public.school_settings for select
  using (auth.uid() is not null);

drop policy if exists "Headmasters can manage school settings"
  on public.school_settings;
create policy "Headmasters can manage school settings"
  on public.school_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  );

grant select on public.school_settings to authenticated;
grant insert, update on public.school_settings to authenticated;

drop policy if exists "Users can update their own profile"
  on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (first_name, middle_name, last_name, phone, updated_at)
  on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-assets',
  'school-assets',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "School logos are publicly viewable" on storage.objects;
create policy "School logos are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'school-assets');

drop policy if exists "Headmasters can upload school logos" on storage.objects;
create policy "Headmasters can upload school logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'school-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  );

drop policy if exists "Headmasters can update school logos" on storage.objects;
create policy "Headmasters can update school logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'school-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  )
  with check (
    bucket_id = 'school-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  );

drop policy if exists "Headmasters can delete school logos" on storage.objects;
create policy "Headmasters can delete school logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'school-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'headmaster'
    )
  );
