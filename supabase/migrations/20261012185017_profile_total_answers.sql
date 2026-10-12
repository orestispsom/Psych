-- Keep lifetime counts independent of mastery and the capped recent history.
-- Aggregate before joining: sorting the large session JSON per question is costly.
create or replace view public.profile_progress_summary
with (security_invoker = true)
as
select
  p.id as profile_id,
  coalesce(q.attempted_questions, 0)::integer as attempted_questions,
  coalesce(q.mastered_questions, 0)::integer as mastered_questions,
  coalesce(oral.mastered_questions, 0)::integer as mastered_oral_questions,
  greatest(coalesce(q.total_answers, 0), coalesce(a.total_answers, 0),
    coalesce((session.state ->> 'totalAnswers')::bigint, 0))::bigint as total_answers
from public.study_profiles p
left join (
  select profile_id,
    count(*) filter (where greatest(seen_count, correct_count + wrong_count) > 0) as attempted_questions,
    count(*) filter (where mastery_level = 5) as mastered_questions,
    sum(correct_count + wrong_count) as total_answers
  from public.user_question_state group by profile_id
) q on q.profile_id = p.id
left join (
  select profile_id, count(*) as total_answers
  from public.question_attempts group by profile_id
) a on a.profile_id = p.id
left join public.profile_mcq_state session on session.profile_id = p.id
left join lateral (
  select count(*)::integer as mastered_questions
  from jsonb_each(case
    when jsonb_typeof(p.oral_progress -> 'mastered') = 'object'
      then p.oral_progress -> 'mastered'
    else '{}'::jsonb
  end) entry
  where entry.value = 'true'::jsonb
) oral on true;
grant select on public.profile_progress_summary to anon, authenticated;
comment on view public.profile_progress_summary is
  'Compact MCQ/oral mastery and lifetime answer totals, including repeated answers.';
