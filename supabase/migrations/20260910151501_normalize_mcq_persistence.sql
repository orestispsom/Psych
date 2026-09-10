-- Additive MCQ persistence cutover.
-- The legacy study_profiles.mcq_progress column remains untouched as a rollback
-- snapshot while high-frequency question and attempt writes move to normalized rows.

create table if not exists public.user_question_state (
  profile_id text not null references public.study_profiles(id) on delete cascade,
  question_id bigint not null,
  seen_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  consecutive_correct integer not null default 0,
  consecutive_wrong integer not null default 0,
  mastery_level integer not null default 0 check (mastery_level between 0 and 5),
  last_seen_at timestamptz,
  next_review_at timestamptz,
  last_answer_correct boolean,
  last_confidence integer check (last_confidence between 1 and 4),
  confident_wrong_count integer not null default 0,
  average_time_ms integer,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, question_id)
);

create table if not exists public.question_attempts (
  id bigserial primary key,
  client_attempt_id text,
  profile_id text not null references public.study_profiles(id) on delete cascade,
  question_id bigint not null,
  session_id uuid,
  mode text not null check (mode in ('daily', 'random', 'sprint', 'weakness', 'written', 'category', 'bookmarks')),
  selected_option text check (selected_option in ('A', 'B', 'C', 'D', 'E')),
  is_correct boolean not null,
  confidence integer check (confidence between 1 and 4),
  time_taken_ms integer,
  points_awarded integer not null default 0,
  streak_position integer not null default 0,
  attempted_at timestamptz not null default now()
);

create unique index if not exists question_attempts_profile_client_attempt_uidx
  on public.question_attempts(profile_id, client_attempt_id);
create index if not exists idx_question_attempts_profile_attempted_at
  on public.question_attempts(profile_id, attempted_at desc);
create index if not exists idx_user_question_state_profile_next_review
  on public.user_question_state(profile_id, next_review_at);
create index if not exists idx_user_question_state_profile_mastery
  on public.user_question_state(profile_id, mastery_level);

alter table public.user_question_state
  add column if not exists progress_reset_at timestamptz,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_answered_at timestamptz,
  add column if not exists last_selected integer check (last_selected between 0 and 4),
  add column if not exists last_time_taken_ms integer,
  add column if not exists last_points_awarded integer not null default 0;

alter table public.question_attempts
  add column if not exists client_session_id text,
  add column if not exists selected_index integer check (selected_index between 0 and 4),
  add column if not exists point_breakdown jsonb;

grant select, insert, update on public.user_question_state to anon, authenticated;
grant select, insert, update on public.question_attempts to anon, authenticated;
grant usage, select on sequence public.question_attempts_id_seq to anon, authenticated;
alter table public.user_question_state enable row level security;
alter table public.question_attempts enable row level security;

drop policy if exists "Public question state can be read" on public.user_question_state;
create policy "Public question state can be read"
on public.user_question_state for select to anon, authenticated using (true);
drop policy if exists "Public question state can be created" on public.user_question_state;
create policy "Public question state can be created"
on public.user_question_state for insert to anon, authenticated with check (true);
drop policy if exists "Public question state can be updated" on public.user_question_state;
create policy "Public question state can be updated"
on public.user_question_state for update to anon, authenticated using (true) with check (true);

drop policy if exists "Public attempts can be read" on public.question_attempts;
create policy "Public attempts can be read"
on public.question_attempts for select to anon, authenticated using (true);
drop policy if exists "Public attempts can be created" on public.question_attempts;
create policy "Public attempts can be created"
on public.question_attempts for insert to anon, authenticated with check (true);
drop policy if exists "Public attempts can be updated" on public.question_attempts;
create policy "Public attempts can be updated"
on public.question_attempts for update to anon, authenticated using (true) with check (true);

create or replace function public.preserve_question_state_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.progress_reset_at is distinct from old.progress_reset_at then
    if old.progress_reset_at is null
      or (new.progress_reset_at is not null and new.progress_reset_at > old.progress_reset_at) then
      return new;
    end if;
    return old;
  end if;

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

create table if not exists public.profile_mcq_state (
  profile_id text primary key references public.study_profiles(id) on delete cascade,
  state jsonb not null default '{"version":2,"dailyChallenges":{},"sprintSessions":[],"writtenExamSessions":[],"writtenExamDraft":null,"vignettes":{"completed":{},"updatedAt":null}}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.profile_mcq_state is
  'Low-frequency MCQ session/profile state. Per-question state and attempts belong in normalized tables.';
comment on column public.study_profiles.mcq_progress is
  'Legacy immutable compatibility snapshot after the normalized MCQ persistence cutover.';

grant select, insert, update on public.profile_mcq_state to anon, authenticated;
alter table public.profile_mcq_state enable row level security;

drop policy if exists "Public profile MCQ state can be read" on public.profile_mcq_state;
create policy "Public profile MCQ state can be read"
on public.profile_mcq_state for select to anon, authenticated using (true);

drop policy if exists "Public profile MCQ state can be created" on public.profile_mcq_state;
create policy "Public profile MCQ state can be created"
on public.profile_mcq_state for insert to anon, authenticated with check (true);

drop policy if exists "Public profile MCQ state can be updated" on public.profile_mcq_state;
create policy "Public profile MCQ state can be updated"
on public.profile_mcq_state for update to anon, authenticated using (true) with check (true);

create or replace function public.preserve_newer_profile_mcq_state()
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
  return new;
end;
$$;

drop trigger if exists preserve_newer_profile_mcq_state_before_update on public.profile_mcq_state;
create trigger preserve_newer_profile_mcq_state_before_update
before update on public.profile_mcq_state
for each row execute function public.preserve_newer_profile_mcq_state();

insert into public.profile_mcq_state (profile_id, state, updated_at)
select
  p.id,
  p.mcq_progress - 'questions' - 'attempts',
  case
    when pg_input_is_valid(p.mcq_progress->>'updatedAt', 'timestamptz')
      then (p.mcq_progress->>'updatedAt')::timestamptz
    else p.updated_at
  end
from public.study_profiles p
on conflict (profile_id) do update
set state = excluded.state,
    updated_at = excluded.updated_at
where excluded.updated_at > profile_mcq_state.updated_at;

with legacy_question_state as (
  select
    p.id as profile_id,
    q.key::bigint as question_id,
    q.value as state,
    coalesce(
      case when pg_input_is_valid(q.value->>'updatedAt', 'timestamptz') then (q.value->>'updatedAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'lastAnsweredAt', 'timestamptz') then (q.value->>'lastAnsweredAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'seenAt', 'timestamptz') then (q.value->>'seenAt')::timestamptz end,
      p.updated_at
    ) as record_updated_at
  from public.study_profiles p
  cross join lateral jsonb_each(
    case when jsonb_typeof(p.mcq_progress->'questions') = 'object'
      then p.mcq_progress->'questions' else '{}'::jsonb end
  ) q
  where q.key ~ '^[0-9]+$'
)
insert into public.user_question_state (
  profile_id, question_id, progress_reset_at, seen_count, correct_count, wrong_count,
  consecutive_correct, consecutive_wrong, mastery_level,
  first_seen_at, last_seen_at, last_answered_at, next_review_at,
  last_answer_correct, last_selected, last_confidence, last_time_taken_ms,
  last_points_awarded, confident_wrong_count, average_time_ms, total_points,
  created_at, updated_at
)
select
  profile_id,
  question_id,
  null,
  greatest(
    coalesce((state->>'seenCount')::integer, 0),
    coalesce((state->>'attempts')::integer, 0),
    coalesce((state->>'correctCount')::integer, 0) + coalesce((state->>'wrongCount')::integer, (state->>'incorrectCount')::integer, 0),
    case when state->>'seenAt' is not null then 1 else 0 end
  ),
  coalesce((state->>'correctCount')::integer, 0),
  coalesce((state->>'wrongCount')::integer, (state->>'incorrectCount')::integer, 0),
  coalesce((state->>'consecutiveCorrect')::integer, (state->>'streak')::integer, 0),
  coalesce((state->>'consecutiveWrong')::integer, 0),
  least(5, greatest(0, coalesce((state->>'masteryLevel')::integer, (state->>'mastery_level')::integer, 0))),
  case when pg_input_is_valid(state->>'seenAt', 'timestamptz') then (state->>'seenAt')::timestamptz end,
  case when pg_input_is_valid(state->>'seenAt', 'timestamptz') then (state->>'seenAt')::timestamptz end,
  case when pg_input_is_valid(state->>'lastAnsweredAt', 'timestamptz') then (state->>'lastAnsweredAt')::timestamptz end,
  case when pg_input_is_valid(state->>'nextReviewAt', 'timestamptz') then (state->>'nextReviewAt')::timestamptz end,
  case when state ? 'lastCorrect' then (state->>'lastCorrect')::boolean end,
  case when state ? 'lastSelected' then (state->>'lastSelected')::integer end,
  case when state ? 'lastConfidence' then (state->>'lastConfidence')::integer end,
  case when state ? 'lastTimeTakenMs' then round((state->>'lastTimeTakenMs')::numeric)::integer end,
  coalesce((state->>'lastPointsAwarded')::integer, 0),
  coalesce((state->>'confidentWrongCount')::integer, 0),
  case when state ? 'averageTimeMs' then round((state->>'averageTimeMs')::numeric)::integer end,
  coalesce((state->>'totalPoints')::integer, 0),
  record_updated_at,
  record_updated_at
from legacy_question_state
on conflict (profile_id, question_id) do update
set seen_count = excluded.seen_count,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    consecutive_correct = excluded.consecutive_correct,
    consecutive_wrong = excluded.consecutive_wrong,
    mastery_level = excluded.mastery_level,
    first_seen_at = excluded.first_seen_at,
    last_seen_at = excluded.last_seen_at,
    last_answered_at = excluded.last_answered_at,
    next_review_at = excluded.next_review_at,
    last_answer_correct = excluded.last_answer_correct,
    last_selected = excluded.last_selected,
    last_confidence = excluded.last_confidence,
    last_time_taken_ms = excluded.last_time_taken_ms,
    last_points_awarded = excluded.last_points_awarded,
    confident_wrong_count = excluded.confident_wrong_count,
    average_time_ms = excluded.average_time_ms,
    total_points = excluded.total_points,
    progress_reset_at = excluded.progress_reset_at,
    updated_at = excluded.updated_at
where excluded.updated_at > user_question_state.updated_at;

with legacy_attempts as (
  select p.id as profile_id, a.value as attempt
  from public.study_profiles p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.mcq_progress->'attempts') = 'array'
      then p.mcq_progress->'attempts' else '[]'::jsonb end
  ) a(value)
  where coalesce(a.value->>'questionId', '') ~ '^[0-9]+$'
)
insert into public.question_attempts (
  client_attempt_id, profile_id, question_id, client_session_id, mode,
  selected_index, selected_option, is_correct, confidence, time_taken_ms,
  point_breakdown, points_awarded, streak_position, attempted_at
)
select
  coalesce(
    nullif(attempt->>'id', ''),
    'legacy:' || md5(profile_id || ':' || attempt::text)
  ),
  profile_id,
  (attempt->>'questionId')::bigint,
  nullif(attempt->>'sessionId', ''),
  attempt->>'mode',
  case when attempt ? 'selected' then (attempt->>'selected')::integer end,
  nullif(attempt->>'selectedOption', ''),
  (attempt->>'isCorrect')::boolean,
  case when attempt ? 'confidence' then (attempt->>'confidence')::integer end,
  case when attempt ? 'timeTakenMs' then round((attempt->>'timeTakenMs')::numeric)::integer end,
  attempt->'pointBreakdown',
  coalesce((attempt->>'pointsAwarded')::integer, 0),
  coalesce((attempt->>'streakPosition')::integer, 0),
  case when pg_input_is_valid(attempt->>'attemptedAt', 'timestamptz')
    then (attempt->>'attemptedAt')::timestamptz else now() end
from legacy_attempts
on conflict (profile_id, client_attempt_id) do update
set client_session_id = coalesce(question_attempts.client_session_id, excluded.client_session_id),
    selected_index = coalesce(question_attempts.selected_index, excluded.selected_index),
    point_breakdown = coalesce(question_attempts.point_breakdown, excluded.point_breakdown);

-- Populate newly-added detail columns without replacing newer normalized values.
with legacy_question_details as (
  select
    p.id as profile_id,
    q.key::bigint as question_id,
    q.value as state,
    coalesce(
      case when pg_input_is_valid(q.value->>'updatedAt', 'timestamptz') then (q.value->>'updatedAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'lastAnsweredAt', 'timestamptz') then (q.value->>'lastAnsweredAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'seenAt', 'timestamptz') then (q.value->>'seenAt')::timestamptz end,
      p.updated_at
    ) as record_updated_at
  from public.study_profiles p
  cross join lateral jsonb_each(p.mcq_progress->'questions') q
  where q.key ~ '^[0-9]+$'
)
update public.user_question_state n
set first_seen_at = coalesce(
      n.first_seen_at,
      case when pg_input_is_valid(l.state->>'seenAt', 'timestamptz') then (l.state->>'seenAt')::timestamptz end,
      n.last_seen_at
    ),
    last_answered_at = coalesce(
      n.last_answered_at,
      case when pg_input_is_valid(l.state->>'lastAnsweredAt', 'timestamptz') then (l.state->>'lastAnsweredAt')::timestamptz end
    ),
    last_selected = coalesce(n.last_selected, (l.state->>'lastSelected')::integer),
    last_time_taken_ms = coalesce(n.last_time_taken_ms, round((l.state->>'lastTimeTakenMs')::numeric)::integer),
    last_points_awarded = coalesce((l.state->>'lastPointsAwarded')::integer, n.last_points_awarded)
from legacy_question_details l
where n.profile_id = l.profile_id
  and n.question_id = l.question_id
  and n.updated_at = l.record_updated_at;

with latest_attempt as (
  select distinct on (profile_id, question_id)
    profile_id,
    question_id,
    attempted_at,
    coalesce(
      selected_index,
      case selected_option when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3 when 'E' then 4 end
    ) as selected_index,
    time_taken_ms,
    points_awarded
  from public.question_attempts
  order by profile_id, question_id, attempted_at desc, id desc
)
update public.user_question_state n
set first_seen_at = coalesce(n.first_seen_at, n.last_seen_at),
    last_answered_at = coalesce(n.last_answered_at, a.attempted_at),
    last_selected = coalesce(n.last_selected, a.selected_index),
    last_time_taken_ms = coalesce(n.last_time_taken_ms, a.time_taken_ms),
    last_points_awarded = a.points_awarded
from latest_attempt a
where n.profile_id = a.profile_id
  and n.question_id = a.question_id;

-- Keep the constraint-backed unique indexes and remove only proven redundant copies.
drop index if exists public.sos_mastery_profile_entry_uidx;
drop index if exists public.idx_question_attempts_profile_client_attempt;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace view app_private.mcq_progress_migration_audit
with (security_invoker = true)
as
with legacy_questions as (
  select
    p.id as profile_id,
    q.key::bigint as question_id,
    coalesce(
      case when pg_input_is_valid(q.value->>'updatedAt', 'timestamptz') then (q.value->>'updatedAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'lastAnsweredAt', 'timestamptz') then (q.value->>'lastAnsweredAt')::timestamptz end,
      case when pg_input_is_valid(q.value->>'seenAt', 'timestamptz') then (q.value->>'seenAt')::timestamptz end,
      p.updated_at
    ) as updated_at
  from public.study_profiles p
  cross join lateral jsonb_each(
    case when jsonb_typeof(p.mcq_progress->'questions') = 'object'
      then p.mcq_progress->'questions' else '{}'::jsonb end
  ) q
  where q.key ~ '^[0-9]+$'
), legacy_attempts as (
  select p.id as profile_id, a.value->>'id' as client_attempt_id
  from public.study_profiles p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.mcq_progress->'attempts') = 'array'
      then p.mcq_progress->'attempts' else '[]'::jsonb end
  ) a(value)
)
select
  p.id as profile_id,
  count(distinct lq.question_id) as legacy_question_rows,
  count(distinct uqs.question_id) as normalized_question_rows,
  count(distinct lq.question_id) filter (where uqs.question_id is null) as missing_normalized_questions,
  count(distinct lq.question_id) filter (where uqs.updated_at < lq.updated_at) as stale_normalized_questions,
  (select count(*) from legacy_attempts la where la.profile_id = p.id) as legacy_attempt_rows,
  (select count(*) from legacy_attempts la
    left join public.question_attempts qa
      on qa.profile_id = la.profile_id and qa.client_attempt_id = la.client_attempt_id
    where la.profile_id = p.id and qa.id is null) as missing_normalized_attempts,
  coalesce(s.state = p.mcq_progress - 'questions' - 'attempts', false) as session_state_matches_legacy,
  s.updated_at as session_state_updated_at
from public.study_profiles p
left join legacy_questions lq on lq.profile_id = p.id
left join public.user_question_state uqs on uqs.profile_id = p.id and uqs.question_id = lq.question_id
left join public.profile_mcq_state s on s.profile_id = p.id
group by p.id, p.mcq_progress, s.state, s.updated_at;

comment on view app_private.mcq_progress_migration_audit is
  'Private verification surface for legacy-to-normalized MCQ reconciliation.';

analyze public.user_question_state;
analyze public.question_attempts;
analyze public.profile_mcq_state;
