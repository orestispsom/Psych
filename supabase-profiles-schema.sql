create table if not exists public.study_profiles (
  id text primary key,
  name text not null,
  mcq_progress jsonb not null default '{"version":2,"questions":{},"attempts":[],"dailyChallenges":{},"sprintSessions":[],"writtenExamSessions":[],"writtenExamDraft":null,"vignettes":{"completed":{},"updatedAt":null},"updatedAt":null}'::jsonb,
  oral_progress jsonb not null default '{"version":1,"mastered":{},"updatedAt":null}'::jsonb,
  theme_preference text not null default 'light' check (theme_preference in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_profiles
  add column if not exists oral_progress jsonb not null default '{"version":1,"mastered":{},"updatedAt":null}'::jsonb;

alter table public.study_profiles
  add column if not exists theme_preference text not null default 'light'
  check (theme_preference in ('light', 'dark'));

alter table public.study_profiles
  alter column mcq_progress set default '{"version":2,"questions":{},"attempts":[],"dailyChallenges":{},"sprintSessions":[],"writtenExamSessions":[],"writtenExamDraft":null,"vignettes":{"completed":{},"updatedAt":null},"updatedAt":null}'::jsonb;

update public.study_profiles
set mcq_progress = jsonb_set(
  coalesce(mcq_progress, '{}'::jsonb),
  '{vignettes}',
  coalesce(mcq_progress->'vignettes', '{"completed":{},"updatedAt":null}'::jsonb),
  true
)
where not (coalesce(mcq_progress, '{}'::jsonb) ? 'vignettes');

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

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('home_update_message', 'Μοιραστείτε την εφαρμογή υπεύθυνα.')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Public app settings can be read" on public.app_settings;
create policy "Public app settings can be read"
on public.app_settings
for select
using (true);

drop policy if exists "Public update message can be created" on public.app_settings;
create policy "Public update message can be created"
on public.app_settings
for insert
with check (key = 'home_update_message');

drop policy if exists "Public update message can be updated" on public.app_settings;
create policy "Public update message can be updated"
on public.app_settings
for update
using (key = 'home_update_message')
with check (key = 'home_update_message');
