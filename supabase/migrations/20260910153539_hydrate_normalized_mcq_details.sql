-- Follow-up for projects that applied normalize_mcq_persistence before the
-- detail-column hydration was folded into that migration.

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

analyze public.user_question_state;
