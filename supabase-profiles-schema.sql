create table if not exists public.study_profiles (
  id text primary key,
  name text not null,
  mcq_progress jsonb not null default '{"version":1,"questions":{},"updatedAt":null}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_profiles enable row level security;

drop policy if exists "Public profiles can be read" on public.study_profiles;
create policy "Public profiles can be read"
on public.study_profiles
for select
using (true);

drop policy if exists "Public profiles can be created" on public.study_profiles;
create policy "Public profiles can be created"
on public.study_profiles
for insert
with check (true);

drop policy if exists "Public profiles can be updated" on public.study_profiles;
create policy "Public profiles can be updated"
on public.study_profiles
for update
using (true)
with check (true);
