-- Temporary rollout bridge for browser tabs that loaded the pre-cutover bundle.
-- The normalized application never updates study_profiles.mcq_progress, so this
-- trigger is idle for current clients and can be removed after the rollout window.

create or replace function public.bridge_legacy_mcq_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  legacy_updated_at timestamptz;
begin
  if new.mcq_progress is not distinct from old.mcq_progress then
    return new;
  end if;

  legacy_updated_at := case
    when pg_input_is_valid(new.mcq_progress->>'updatedAt', 'timestamptz')
      then (new.mcq_progress->>'updatedAt')::timestamptz
    else new.updated_at
  end;

  insert into public.profile_mcq_state (profile_id, state, updated_at)
  values (new.id, new.mcq_progress - 'questions' - 'attempts', legacy_updated_at)
  on conflict (profile_id) do update
  set state = excluded.state,
      updated_at = excluded.updated_at
  where excluded.updated_at > profile_mcq_state.updated_at;

  with changed_question_state as (
    select
      q.key::bigint as question_id,
      q.value as state,
      coalesce(
        case when pg_input_is_valid(q.value->>'updatedAt', 'timestamptz') then (q.value->>'updatedAt')::timestamptz end,
        case when pg_input_is_valid(q.value->>'lastAnsweredAt', 'timestamptz') then (q.value->>'lastAnsweredAt')::timestamptz end,
        case when pg_input_is_valid(q.value->>'seenAt', 'timestamptz') then (q.value->>'seenAt')::timestamptz end,
        legacy_updated_at
      ) as record_updated_at
    from jsonb_each(
      case when jsonb_typeof(new.mcq_progress->'questions') = 'object'
        then new.mcq_progress->'questions' else '{}'::jsonb end
    ) q
    left join jsonb_each(
      case when jsonb_typeof(old.mcq_progress->'questions') = 'object'
        then old.mcq_progress->'questions' else '{}'::jsonb end
    ) previous on previous.key = q.key
    where q.key ~ '^[0-9]+$'
      and q.value is distinct from previous.value
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
    new.id,
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
  from changed_question_state
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

  insert into public.question_attempts (
    client_attempt_id, profile_id, question_id, client_session_id, mode,
    selected_index, selected_option, is_correct, confidence, time_taken_ms,
    point_breakdown, points_awarded, streak_position, attempted_at
  )
  select
    coalesce(nullif(attempt->>'id', ''), 'legacy:' || md5(new.id || ':' || attempt::text)),
    new.id,
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
      then (attempt->>'attemptedAt')::timestamptz else legacy_updated_at end
  from jsonb_array_elements(
    case when jsonb_typeof(new.mcq_progress->'attempts') = 'array'
      then new.mcq_progress->'attempts' else '[]'::jsonb end
  ) attempt
  where coalesce(attempt->>'questionId', '') ~ '^[0-9]+$'
  on conflict (profile_id, client_attempt_id) do nothing;

  return new;
end;
$$;

drop trigger if exists bridge_legacy_mcq_progress_after_update on public.study_profiles;
create trigger bridge_legacy_mcq_progress_after_update
after update of mcq_progress on public.study_profiles
for each row execute function public.bridge_legacy_mcq_progress();

comment on function public.bridge_legacy_mcq_progress() is
  'Temporary compatibility bridge for pre-cutover browser tabs; remove after the legacy rollout window.';

-- Close the session-state race that occurred before this trigger existed.
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
