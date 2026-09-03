-- Non-destructive data-safety migration. No rows are deleted or reset.

alter table public.study_profiles
  add column if not exists theme_preference text not null default 'light'
  check (theme_preference in ('light', 'dark'));

alter table public.question_attempts
  drop constraint if exists question_attempts_mode_check;

alter table public.question_attempts
  add constraint question_attempts_mode_check
  check (mode in ('daily', 'random', 'sprint', 'weakness', 'written', 'category', 'bookmarks'));

create unique index if not exists question_attempts_profile_client_attempt_uidx
  on public.question_attempts (profile_id, client_attempt_id);

revoke delete, truncate on public.study_profiles from anon, authenticated;
revoke delete, truncate on public.user_question_state from anon, authenticated;
revoke delete, truncate on public.question_attempts from anon, authenticated;

drop policy if exists "Public username profiles can manage question state"
  on public.user_question_state;
create policy "Public question state can be read"
  on public.user_question_state for select using (true);
create policy "Public question state can be created"
  on public.user_question_state for insert with check (true);
create policy "Public question state can be updated"
  on public.user_question_state for update using (true) with check (true);

drop policy if exists "Public username profiles can manage attempts"
  on public.question_attempts;
create policy "Public attempts can be read"
  on public.question_attempts for select using (true);
create policy "Public attempts can be created"
  on public.question_attempts for insert with check (true);
create policy "Public attempts can be updated"
  on public.question_attempts for update using (true) with check (true);

create or replace function public.preserve_profile_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.mcq_progress := jsonb_set(
    coalesce(old.mcq_progress, '{}'::jsonb) || coalesce(new.mcq_progress, '{}'::jsonb),
    '{questions}',
    coalesce(old.mcq_progress->'questions', '{}'::jsonb)
      || coalesce(new.mcq_progress->'questions', '{}'::jsonb),
    true
  );
  return new;
end;
$$;

drop trigger if exists preserve_profile_progress_before_update on public.study_profiles;
create trigger preserve_profile_progress_before_update
before update of mcq_progress on public.study_profiles
for each row execute function public.preserve_profile_progress();

revoke execute on function public.preserve_profile_progress() from public, anon, authenticated;

create or replace function public.preserve_question_state_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.updated_at is not null
    and new.updated_at is not null
    and new.updated_at < old.updated_at then
    return old;
  end if;

  new.seen_count := greatest(old.seen_count, new.seen_count);
  new.correct_count := greatest(old.correct_count, new.correct_count);
  new.wrong_count := greatest(old.wrong_count, new.wrong_count);
  new.confident_wrong_count := greatest(old.confident_wrong_count, new.confident_wrong_count);
  new.total_points := greatest(old.total_points, new.total_points);
  return new;
end;
$$;

drop trigger if exists preserve_question_state_counters_before_update on public.user_question_state;
create trigger preserve_question_state_counters_before_update
before update on public.user_question_state
for each row execute function public.preserve_question_state_counters();

revoke execute on function public.preserve_question_state_counters() from public, anon, authenticated;

alter table public.sos_mastery
  drop constraint if exists sos_mastery_section_check;

alter table public.sos_mastery
  add constraint sos_mastery_section_check
  check (section in ('high_yield', 'numbers', 'critical_topics', 'differential_diagnosis'));

create unique index if not exists sos_mastery_profile_entry_uidx
  on public.sos_mastery (profile_id, entry_id);

revoke delete, truncate on public.sos_mastery from anon, authenticated;

create policy "Public SOS mastery can be read"
  on public.sos_mastery for select using (true);
create policy "Public SOS mastery can be created"
  on public.sos_mastery for insert with check (true);
create policy "Public SOS mastery can be updated"
  on public.sos_mastery for update using (true) with check (true);
