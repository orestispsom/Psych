-- Reconcile legacy writes made by already-open clients during the code rollout.
-- Every upsert is monotonic: newer normalized rows always win.

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
  coalesce(nullif(attempt->>'id', ''), 'legacy:' || md5(profile_id || ':' || attempt::text)),
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

analyze public.user_question_state;
analyze public.question_attempts;
analyze public.profile_mcq_state;
